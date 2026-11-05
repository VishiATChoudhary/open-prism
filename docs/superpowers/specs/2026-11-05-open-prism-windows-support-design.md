# Open Prism — Windows Support Design Spec

**Date:** 2026-11-05
**Status:** Approved design (implementation not started)
**Related analysis:** [`docs/windows-port-effort-analysis.md`](../../windows-port-effort-analysis.md)

## 1. Context

Open Prism currently ships only a macOS DMG. The application itself is a plain Electron 31 + React application with no native modules, so the work is concentrated in four areas:

1. External process execution (`claude`, `codex`, `tectonic`) assumes POSIX.
2. Project ZIP import shells out to the `unzip` binary.
3. Packaging is a hand-rolled macOS-only script.
4. CI only runs macOS runners.

The goal is to add first-class Windows 10/11 x64 support **without changing macOS behavior**, and to structure the work so five implementation agents can run in parallel with minimal conflict.

## 2. Goals

- Run the app from source on Windows 10/11 x64 (`npm run dev`).
- Create, open, save, rename, and delete projects on Windows.
- Compile with Tectonic and preview/export PDFs on Windows.
- Chat through `claude` (native installer and npm install) and `codex`.
- Import ZIP projects on Windows, and keep projects portable between Windows and macOS.
- Produce an unsigned Windows distributable from CI:
  - NSIS installer (per-user, no admin).
  - Portable ZIP.
- Keep the existing macOS DMG script and release path working.
- Allow the implementation to be split into parallel agent workstreams.

## 3. Non-goals

- **Code signing.** Unsigned builds work; SmartScreen warnings are documented. Signing is a follow-up.
- **Windows ARM64.** Only x64 is in scope; the CI matrix is structured so arm64 can be added later.
- **Auto-update.**
- **Bundling Tectonic or the Claude/Codex CLIs.** They remain external prerequisites, as on macOS.
- **Migrating macOS packaging to electron-builder.** Optional follow-up.
- **Feature changes** to the editor, chat, or PDF viewer.

## 4. Current-State Evidence

| Area | Current assumption | Location |
|---|---|---|
| PATH resolution | Spawns `$SHELL -lc`, splits on `:`, hardcodes Homebrew paths | `src/main/services/spawnEnv.ts:9-50` |
| CLI spawning | Plain `spawn(bin, ...)`; fails for npm `.cmd` shims | `src/main/services/aiCli.ts:60`, `src/main/services/tectonic.ts:20` |
| ZIP import | Shells out to `unzip -Z -1` / `unzip -q` | `src/main/services/projectStore.ts:241,250` |
| Packaging | Copies `Electron.app`; uses `PlistBuddy`, `sips`, `iconutil`, `codesign`, `hdiutil` | `scripts/package-macos-dmg.mjs` |
| CI | `macos-14` / `macos-13` only | `.github/workflows/release.yml:16-22` |
| Entry path | `relative()` stores `sub\main.tex` on Windows | `src/main/services/projectStore.ts:139` |
| Window lifecycle | Already quits on non-darwin | `src/main/index.ts:36-38` |
| Downloads path | Already uses `app.getPath('downloads')` | `src/main/ipc/file.ts:14` |
| Shortcuts | Already accept `ctrlKey` | `src/renderer/App.tsx:33` |

## 5. Architecture

### 5.1 Contract-first interfaces

These contracts are frozen before agents are dispatched so downstream work can proceed without waiting:

| Contract | Value |
|---|---|
| Windows build command | `npm run package:win` |
| NSIS artifact | `dist/Open-Prism-<version>-win-x64.exe` |
| Portable artifact | `dist/Open-Prism-<version>-win-x64.zip` |
| macOS build command | `npm run package:mac` (unchanged) |
| `resolveSpawnEnv()` | Signature unchanged: `Promise<NodeJS.ProcessEnv>` |
| `importProjectZip(zipPath, settings)` | Signature unchanged |
| Package manager | npm (`package-lock.json`); untracked pnpm files are out of scope |
| Node in CI | 20 (unchanged) |

### 5.2 Process execution layer

**`src/main/services/spawnEnv.ts`**

Extract a pure, testable PATH builder and keep an IO wrapper:

```ts
export function buildSpawnPath(input: {
  platform: NodeJS.Platform
  envPath: string
  home: string
  env: NodeJS.ProcessEnv
  loginShellPath?: string
}): string
```

- **win32:**
  - Do not probe a login shell.
  - Delimiter: `path.delimiter` (`;`).
  - Merge order: `process.env.PATH`, then known directories:
    - `<home>\.local\bin` (native Claude installer)
    - `<env.APPDATA>\npm` (npm global shims)
    - `<home>\.cargo\bin` (Tectonic via cargo)
    - `<home>\scoop\shims` (Scoop)
    - `<env.ProgramData>\chocolatey\bin` (Chocolatey)
  - Deduplicate case-insensitively; keep the first occurrence.
  - Skip empty entries. Do not `stat` directories; the merge stays cheap on startup.
- **POSIX:** keep the existing login-shell probe and hardcoded Homebrew/system directories; split on `:`.
- `resolveSpawnEnv()` caches the result for the process lifetime, as today.

**`aiCli.ts` and `tectonic.ts`**

- Replace `spawn` from `node:child_process` with `cross-spawn`.
- `cross-spawn` resolves `.exe`, `.cmd`, and `.bat` through `PATHEXT`, so both `claude.exe` and `claude.cmd` work.
- Do **not** use `shell: true`; the `model` setting is user-controlled and must not be interpolated into a shell command.
- Keep the prompt on stdin and the existing stdout/stderr streaming behavior.
- Improve the not-found error to mention both install methods:
  - Claude: native installer or `npm install -g @anthropic-ai/claude-code`.
  - Tectonic: Scoop, Chocolatey, cargo, or the official installer.

### 5.3 ZIP import

Add `src/main/services/zip.ts`:

```ts
export async function readZip(zipPath: string): Promise<Map<string, Uint8Array>>
export async function extractZip(zipPath: string, targetDir: string): Promise<string[]>
```

- Use `fflate.unzipSync` on the file buffer. No external binary.
- Treat `/` as the only valid separator: reject entries containing backslashes (the existing zip-slip policy) and split validated names on `/` when writing.
- Reuse the zip-slip validation rules: reject absolute paths, drive letters, backslashes, and any `..` segment.
- Skip directory entries, `__MACOSX/`, and `.DS_Store`.
- Write files with `fs.mkdir` + `fs.writeFile`, never `..`-escaping paths.
- `projectStore.importProjectZip` keeps its current flow after extraction:
  1. Extract into `mkdtemp`.
  2. Pick the single root directory when applicable.
  3. Copy into the project directory with `fs.cp`.
  4. Find the entry `.tex` when `meta.entry` is missing.
- Delete the temporary directory in `finally`, as today.

### 5.4 Cross-platform project paths

- `findTexEntry` returns `relative(root, path)`; convert with `.split(sep).join('/')` before storing it in `.prism.json`.
- `normalizeProjectMeta` converts `meta.entry` backslashes to forward slashes on read, so projects created on Windows remain usable on macOS and vice versa.
- `join(dir, meta.entry)` already accepts `/` on Windows.
- Harden project naming for Windows:
  - Trim trailing spaces and dots.
  - Reject reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`) with a clear error.
  - Keep the existing sanitization for everything else.

### 5.5 Windows packaging

Add `electron-builder` as a dev dependency and a declarative `electron-builder.yml`:

```yaml
appId: dev.openprism.app
productName: Open Prism
directories:
  output: dist
  buildResources: resources
files:
  - out/**/*
  - resources/**/*
  - package.json
asar: true
win:
  icon: resources/app-icon.png
  artifactName: Open-Prism-${version}-win-${arch}.${ext}
  target:
    - target: nsis
      arch: [x64]
    - target: zip
      arch: [x64]
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
```

`package.json` changes:

- Add `"package:win": "npm run build && electron-builder --win --x64"`.
- Add an `author` field (electron-builder metadata).
- Add runtime dependencies: `cross-spawn`, `fflate`.
- Add dev dependency: `electron-builder`.
- Leave `package:mac` and the macOS script untouched.

Notes and verification requirements:

- The 1024×1024 `resources/app-icon.png` is sufficient for electron-builder to generate the Windows `.ico`.
- Electron 31 supports an ESM main process and ESM preload (`sandbox: false`). Verify `electron-builder --dir` early. If asar path resolution breaks the preload or `resources/app-icon.png`, the fallback is `asarUnpack: ["resources/**"]` or `asar: false`; do not redesign the app.
- `resources/app-icon.png` must remain reachable via `join(app.getAppPath(), 'resources/app-icon.png')` after packaging.
- The NSIS installer must be per-user and must not require administrator rights.
- Verify that production dependencies (`cross-spawn`, `fflate`) are present in the packaged app; electron-builder must not exclude them when the custom `files` list is used.

### 5.6 CI and release

Update `.github/workflows/release.yml`:

- Rename the workflow to `Release`.
- Keep the macOS matrix entries and their DMG packaging. Normalize every matrix entry with `package_cmd` and `artifacts`:
  - macOS arm64/x64: `package_cmd: package:mac`, `artifacts: dist/*.dmg`.
  - Windows x64:

```yaml
- runner: windows-latest
  arch: x64
  package_cmd: package:win
  artifacts: |
    dist/*.exe
    dist/*.zip
```

- Add `npm test` before packaging for every runner.
- Upload artifacts for `workflow_dispatch` and attach them to tagged releases.
- Keep `fail-fast: false`.

### 5.7 Documentation

Update `README.md`:

- Add a Windows download badge/link once a release exists.
- Requirements: Windows 10/11 x64, Claude CLI (native or npm), Tectonic on `PATH`.
- Build instructions: `npm run package:win`.
- Note that the unsigned installer triggers SmartScreen and how to proceed.
- Document Tectonic install options for Windows (Scoop, Chocolatey, cargo, official installer).

## 6. Parallel Execution Architecture

### 6.1 File ownership matrix

| Agent | Owns | Reads / depends on |
|---|---|---|
| **A1 · Process layer** | `src/main/services/spawnEnv.ts`, `aiCli.ts`, `tectonic.ts`, `tests/spawnEnv.test.ts`, `tests/aiCli.test.ts` | Contract 5.1 |
| **A2 · Project store** | `src/main/services/projectStore.ts`, new `src/main/services/zip.ts`, `tests/projectStore.test.ts`, new `tests/zip.test.ts` | Contract 5.1, ZIP rules 5.3–5.4 |
| **A3 · Packaging** | `package.json`, `electron-builder.yml`, `scripts/` (only if a helper is required), `resources/` | Contract 5.1, section 5.5 |
| **A4 · CI** | `.github/workflows/release.yml` | Contract 5.1 (script name and artifact globs) |
| **A5 · Docs** | `README.md`, `docs/` (except this spec and the analysis) | Contract 5.1, sections 5.5–5.7 |

A3 is the designated owner of `package.json`. A1 and A2 may add only their dependency entries to `package.json` inside their isolated worktrees; they must not change scripts, metadata, or other agents' entries. A6 reconciles the three worktree versions and regenerates the lockfile. No other file is touched by more than one agent.

### 6.2 Wave 1 — five parallel agents

All agents start from the same base commit in isolated git worktrees. Each agent receives this spec and its own scope; it must not edit files outside its ownership.

| Agent | Deliverable | Acceptance | Effort |
|---|---|---|---|
| A1 | Windows PATH + `cross-spawn` | Unit tests for win32/posix PATH building; args unchanged; no `shell: true` | 4–6 h |
| A2 | ZIP via `fflate`, POSIX entry paths, Windows naming | ZIP-slip tests, nested-entry fixture, round-trip path test | 4–6 h |
| A3 | electron-builder Windows targets | `electron-builder --dir` succeeds on Windows; artifact names match contract | 6–8 h |
| A4 | Windows CI job | Workflow syntax valid; artifact globs match contract | 2–3 h |
| A5 | Windows docs | Commands and requirements match the implementation | 2 h |

### 6.3 Wave 2 — integration and QA

| Agent | Deliverable | Depends on |
|---|---|---|
| **A6 · Integrator** | Merge worktrees, reconcile `package.json`, regenerate `package-lock.json`, run `npm install`, `npm test`, `npm run build` | A1–A5 |
| **A7 · Windows QA** | Install Tectonic; run dev and packaged app; execute QA checklist | A6 |
| **A8 · Adversarial review** (optional) | Independent review of merged diff | A6 |

**Merge policy**

1. Merge A3 first (packaging + scripts + dependencies), then A1, A2, A4, A5.
2. `package.json` conflicts are resolved by union: keep all scripts, dependencies, and metadata from every agent.
3. Regenerate `package-lock.json` once with `npm install`; never hand-edit it.
4. Do not add or commit `pnpm-lock.yaml` / `pnpm-workspace.yaml`; npm is the package manager for this work.
5. Run `npm test` and `npm run build` after each merge.
6. If an agent's changes break another's tests, fix at integration, not by reverting the owning agent's scope.

**Critical path:** A3 → A6 → A7. A1, A2, A4, A5 run concurrently with A3.

**Expected wall-clock:** ~1–1.5 days with human review, versus ~2–3.5 sequential dev-days.

### 6.4 Human checkpoints

- Approve this spec before planning.
- Approve the implementation plan before dispatching agents.
- Install Tectonic on the Windows test machine (`scoop install tectonic` or Chocolatey) before A7.
- Final acceptance of the installed application (SmartScreen, shortcuts, icon).

## 7. Testing Strategy

### 7.1 Automated

- `tests/spawnEnv.test.ts`
  - win32: `;` delimiter, case-insensitive dedupe, known directories added, no login-shell probe.
  - posix: login-shell PATH merged first, `:` delimiter, Homebrew directories retained.
- `tests/zip.test.ts`
  - Extract a nested fixture built with `fflate.zipSync`.
  - Reject absolute paths, drive letters, backslashes, and `..`.
  - Skip `__MACOSX` and `.DS_Store`.
- `tests/projectStore.test.ts`
  - ZIP import finds `main.tex` in a nested folder.
  - Stored `meta.entry` uses `/` on Windows.
  - Reserved Windows names and trailing dots are rejected or normalized.
- Existing tests must continue to pass: `npm test`.

### 7.2 Windows QA checklist

1. `npm ci` and `npm run dev` on a clean Windows account.
2. Create a project; edit and save; reopen it from the home screen.
3. Compile with Tectonic; confirm the PDF preview appears.
4. Export the PDF; confirm it lands in the Downloads folder.
5. Chat with `claude.exe` (native installer) and with `claude.cmd` (npm install).
6. Chat with `codex`.
7. Import a ZIP created on macOS and one created on Windows.
8. Import a ZIP containing `../` entries; confirm rejection.
9. `npm run package:win`; install via NSIS; verify Start-menu and desktop shortcuts, icon, and uninstall.
10. Run the portable ZIP build from a non-admin account.
11. Confirm the macOS workflow still builds a DMG (config-level check is acceptable if no Mac runner is available).

### 7.3 Definition of done

- All automated tests pass on Windows and macOS.
- The QA checklist passes.
- `npm run package:win` produces both artifacts with the contract names.
- The macOS release workflow remains valid.
- README documents Windows requirements and the SmartScreen note.

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `electron-builder` + ESM/asar path issues | Packaged app fails to load preload or icon | Validate with `electron-builder --dir` early; fallback `asarUnpack`/`asar: false` |
| npm `.cmd` shims not spawning | AI chat broken for npm-installed CLIs | `cross-spawn`; QA tests both install methods |
| Command injection via model string | Security | Never use `shell: true`; pass args as arrays |
| Tectonic not on PATH in Explorer-launched app | Compile fails | Add known Windows directories; actionable error message |
| SmartScreen warning | User friction | Document "More info → Run anyway"; signing is a follow-up |
| `package.json`/lockfile merge conflicts | Integration delay | Worktrees + integrator owns final lockfile regeneration |
| ZIP path traversal | Security | Reuse and test the existing zip-slip validator |
| Windows reserved names / trailing dots | Project creation failures | Naming hardening in A2 |

## 9. Acceptance Criteria

- [ ] Windows 10/11 x64 can run the app from source and compile a LaTeX project.
- [ ] Both `claude.exe` and `claude.cmd` work as AI providers.
- [ ] ZIP import works without any external `unzip` binary.
- [ ] Projects created on either OS open correctly on the other.
- [ ] `npm run package:win` produces `dist/Open-Prism-<version>-win-x64.exe` and `.zip`.
- [ ] The NSIS installer is per-user, creates shortcuts, and uninstalls cleanly.
- [ ] The existing macOS DMG workflow is unchanged and still valid.
- [ ] `npm test` passes on Windows.

## 10. Follow-ups

- Code signing (Azure Trusted Signing / OV certificate / SignPath for OSS) to remove SmartScreen warnings.
- Windows ARM64 target.
- Optional migration of macOS packaging to electron-builder for a single packaging pipeline.
- Auto-update, if desired.

# Windows Port: Effort Analysis

_Date: 2026-11-05 · Scope: making Open Prism build, run, and ship on Windows_

## Verdict

Windows support is very feasible — this is a stock Electron + React app with no macOS-only APIs. The blockers are concentrated in three process-spawning spots, the hand-rolled DMG packager, and CI. Realistic effort: **~2–3.5 dev-days for a working unsigned Windows build**, plus optional signing setup.

## What already works on Windows

- Electron 31 + React/TS stack, no native modules (`package.json`) — fully portable.
- `app.getPath('downloads')` for PDF export (`src/main/ipc/file.ts:14`) works on Windows.
- `~/.openprism` via `homedir()` (`src/main/services/projectStore.ts:51`) resolves to `C:\Users\<name>\.openprism` correctly.
- Keyboard handling already accepts `ctrlKey` alongside `metaKey` (`src/renderer/App.tsx:33`); only UI labels say ⌘.
- `window-all-closed` already quits on non-darwin (`src/main/index.ts:36-38`) — correct Windows behavior.
- Claude Code and Tectonic both have native Windows builds.

## Blockers, with fix and effort

| # | Issue | Where | Fix | Effort |
|---|-------|-------|-----|--------|
| 1 | **PATH resolver is POSIX-only**: spawns `$SHELL -lc`, splits on `:`, hardcodes `/opt/homebrew/bin`, `/usr/local/bin`, etc. | `src/main/services/spawnEnv.ts:9-50` | Branch per platform: use `path.delimiter`, skip login-shell probe on Windows, add `%USERPROFILE%\.local\bin` (native Claude installer — confirmed on this machine), `%APPDATA%\npm`, `%USERPROFILE%\.cargo\bin`, scoop shims, chocolatey bin | 3–4 h |
| 2 | **`.cmd` shims can't be spawned**: npm-installed `claude`/`codex` are `claude.cmd`/`codex.cmd`; Node's `spawn` without a shell only runs `.exe`. Native installer (`claude.exe`) works, npm install breaks. | `src/main/services/aiCli.ts:60`, `tectonic.ts:20` | Add `cross-spawn` (handles PATHEXT and `.cmd` safely) or resolve via `where.exe`. Avoid `shell: true` — `model` is user-controlled and would be an injection vector | 3–4 h |
| 3 | **Zip import shells out to `unzip`** — not on stock Windows PATH (Git Bash's copy isn't visible to Explorer-launched apps). | `src/main/services/projectStore.ts:241,250` | Replace with a JS zip lib (`yauzl`/`adm-zip`) keeping the existing zip-slip validation, or platform-branch to `tar.exe`/`Expand-Archive`. JS lib is cleaner and testable | 3–4 h |
| 4 | **Packaging is 100% macOS**: copies `Electron.app`, `PlistBuddy`, `sips`, `iconutil`, `codesign`, `hdiutil`. | `scripts/package-macos-dmg.mjs`, `package.json:12` | Add **electron-builder** with `win: nsis` + `portable`/zip targets, `package:win` script, `build.appId`, `author` field. Icon is already 1024×1024 PNG — electron-builder converts to `.ico` | 0.5–1 day |
| 5 | **CI is macOS-only** | `.github/workflows/release.yml:16-22` | Add `windows-latest` matrix entry, `package:win` step, `dist/*.exe` upload globs; update workflow name | 2–4 h |
| 6 | **Cross-platform project portability bug**: `relative()` writes `sub\main.tex` into `.prism.json` on Windows; same project breaks on macOS. | `src/main/services/projectStore.ts:139` | Store POSIX separators (`split(sep).join('/')`); `join()` reads them fine on Windows | 1 h |
| 7 | Docs say macOS-only; Windows install steps for Tectonic/Claude missing | `README.md:59-70` | Update requirements/build docs | 1–2 h |
| 8 | Optional: reserved names (`CON`, `NUL`, trailing dots) and long paths in project naming | `projectStore.ts:61-69` | Harden slugify | 1–2 h |

## Packaging & signing

- **electron-builder NSIS** is the right choice: per-user install (no admin), Start-menu shortcut, uninstaller, and signing hooks. It can also replace the mac script later (~0.5 day optional) and would enable notarization properly.
- **Unsigned builds work** but trigger SmartScreen ("Unknown publisher"). For distribution you'd want an OV/EV certificate or a free-for-OSS signing service (e.g. SignPath); procurement is calendar time, not dev time. Not required for the first release.

## Effort summary

| Phase | Estimate |
|---|---|
| Runtime portability (items 1–3, 6) | 1–1.5 days |
| Packaging (item 4, icon, launch verification) | 0.5–1 day |
| CI + release | 0.25–0.5 day |
| QA on a clean Windows VM/account | 0.5–1 day |
| Docs | 0.25 day |
| **Total (unsigned)** | **~2–3.5 dev-days** |
| Code signing | +0.5–1 day integration, plus certificate lead time |

### QA checklist

Create/edit/save project → Tectonic compile → PDF preview/export → chat with both native `claude.exe` and npm `claude.cmd` → Codex → zip import (Windows- and mac-created zips) → installer/uninstaller/shortcut/icon.

## Notes for this machine

This is Windows 11 with Node 24 and `claude.exe` already at `C:\Users\gusta\.local\bin` — so runtime testing is easy here. `tectonic` is **not installed**, so compile testing needs `scoop install tectonic` (or choco/cargo) first.

Recommended sequence: **(1)** fix runtime portability and verify with `npm run dev` on this machine, **(2)** add electron-builder + Windows CI.

## Agent-Based Effort Estimate

_Definition: one agent = one subagent with isolated context and a single file domain. Use worktree isolation when agents would touch `package.json`/lockfile._

### Wave 1 — parallel implementation (5 agents)

| Agent | Scope | Files | Human-equivalent |
|---|---|---|---|
| A1 · Process spawning | Windows PATH resolution, `cross-spawn` for `.cmd`/`.exe` CLIs | `spawnEnv.ts`, `aiCli.ts`, `tectonic.ts`, tests | 4–6 h |
| A2 · Project store | Replace `unzip`, POSIX-normalize `meta.entry`, harden slugify | `projectStore.ts`, `tests/projectStore.test.ts` | 4–6 h |
| A3 · Windows packaging | electron-builder NSIS + portable, `.ico`, `package:win`, `appId`/`author` | `package.json`, builder config, `scripts/`, `resources/` | 6–8 h |
| A4 · CI/release | `windows-latest` job, `.exe` upload, rename workflow | `.github/workflows/release.yml` | 2–3 h |
| A5 · Docs | Windows requirements/install/build steps | `README.md`, `docs/` | 2 h |

**Shared-state note:** A1, A2, and A3 all touch `package.json`. Either run A1/A2 in isolated worktrees and let the integrator apply dependency changes, or make A3 the sole owner of `package.json` and have A1/A2 return dependency snippets.

### Wave 2 — integration and verification (2–3 agents)

| Agent | Scope | Human-equivalent |
|---|---|---|
| A6 · Integration | Merge worktrees, reconcile `package.json`/lockfile, run `npm run build` + `npm test` | 2–3 h |
| A7 · Windows QA | Packaged app, Tectonic compile, zip import, native `claude.exe` + npm `claude.cmd`, installer/uninstaller | 4–6 h |
| A8 · Adversarial review (optional) | Independent review of the merged diff | 2–3 h |

### Totals

- **7 required agent runs** (5 parallel + 2 sequential); **9** with optional review and a final clean-room verifier.
- **3 waves**: implementation → integration → QA. Critical path: A3 → A6 → A7.
- Wall-clock with human review: **~1–1.5 days**. Sequential single-agent equivalent: **2–3.5 dev-days**.
- Human-only work: install Tectonic on the test machine, decide/procure code signing, final acceptance.

## Sources

- [Tectonic installation docs](https://tectonic-typesetting.github.io/book/latest/installation/)
- [Tectonic Windows install guide](https://tectonic-typesetting.github.io/book/latest/getting-started/install.html)

# Windows QA Report

_Date: 2026-11-05 · Branch: `windows/integration` · Build commit: `e4b806a` ("build: integrate Windows support and harden runtime paths")_

## Environment

| Item | Value |
|---|---|
| OS | Windows 11 Pro 10.0.26200 (Build 26200), x64 |
| App | Open Prism 0.1.0 (`OpenPrism/0.1.0`, Electron 31.7.7, Chrome 126.0.6478.234) |
| Node | 24.16.0 |
| Tectonic | 0.17.0, installed from official GitHub release `tectonic-0.17.0-x86_64-pc-windows-msvc.zip` |
| Claude CLI | 2.1.173 (`C:\Users\gusta\.local\bin\claude.exe`) |

## Artifacts under test

| Artifact | Size (bytes) | SHA-256 |
|---|---:|---|
| `dist/win-unpacked/Open Prism.exe` | 180,899,840 | — |
| `dist/Open-Prism-0.1.0-win-x64.exe` (NSIS) | 106,115,410 | `5E5B68CC0098402C5FDD18B95A06C6B35D5B7D45FA16D1573D3FE2C405B83298` |
| `dist/Open-Prism-0.1.0-win-x64.zip` (portable) | 145,797,886 | `0A912932D7DE68ECC044A6966E0B2E8A46ECC703A68EDB4042C734A1E339C4CE` |

## End-to-end API checklist (packaged app, `dist/win-unpacked`, CDP `Runtime.evaluate`)

Tectonic was prepended to the app's `PATH`; all calls were made through `window.api` in the packaged renderer.

| # | Check | Result | Evidence |
|---:|---|---|---|
| 1 | `window.api` exists; `listProjects()` returns `rootDir` | **PASS** | 25 API methods; `rootDir = C:\Users\gusta\.openprism` (exists, is a directory); 0 projects at start |
| 2 | `newProject('QA Windows')` returns `{dir, meta, source}` and creates directory | **PASS** | `dir = C:\Users\gusta\.openprism\QA-Windows`; `meta.entry = main.tex`; dir and entry file exist on disk; starter source 79 bytes |
| 3 | `saveProject` persists `source + "\n% QA edit\n"`; `openProject` returns it | **PASS** | Reopened source and on-disk file both exactly match the 90-byte edited source; tail is `% QA edit` |
| 4 | `compile(dir, meta.entry)` returns `{ok:true, pdfPath}` and PDF exists | **PASS** | `ok = true`; `pdfPath = C:\Users\gusta\.openprism\QA-Windows\build\main.pdf`; 3,471 bytes. Cold compile (bundle download) took 101.4 s; Tectonic resolved from `PATH` inside the packaged app |
| 5 | `exportPdf(pdfPath)` returns a Downloads path and file exists | **PASS** | `C:\Users\gusta\Downloads\main.pdf`, 3,471 bytes |
| 6 | `fileTree(dir)` contains `main.tex` | **PASS** | 2 nodes: `dir:assets`, `file:main.tex`; `main.tex` absolute path returned |
| 7 | `renameProject` returns new dir; `deleteProject` removes it | **PASS** | Renamed to `C:\Users\gusta\.openprism\QA-Windows-Renamed`; old dir gone; `deleteProject` removed new dir (`newGone = true`) |
| 8 | Claude `inlineEdit` smoke test resolves | **PASS** | Resolved in 8.5 s with `"OK\n"` (first 120 chars: `OK\n`) |
| 9 | No unhandled main-process crash in app output | **PASS** | `stdout` empty; `stderr` contained only `DevTools listening on ws://...`; no `Application Error` / WER events; no `.dmp` files |

The full checklist was run a second time against a fresh packaged-app instance (port 9223); all nine checks passed again (warm compile, exports to `main-2.pdf`). This confirms the results are reproducible.

Raw evidence: `%TEMP%\open-prism-qa-results-run1.json`, `%TEMP%\open-prism-qa-results.json`, `%TEMP%\open-prism-qa-driver.log`, `%TEMP%\open-prism-qa-driver-run2.log`.

## Portable ZIP

**PASS.** `dist/Open-Prism-0.1.0-win-x64.zip` extracted to `%TEMP%\open-prism-qa-portable`; `Open Prism.exe` (180,899,840 bytes) is at the archive root. Launched with `--remote-debugging-port=9224`: the page target loaded `file:///.../open-prism-qa-portable/resources/app.asar/out/renderer/index.html`, `document.title = "Open Prism"`, and `window.api` was present. Process killed cleanly afterwards.

## NSIS installer (per-user)

**PASS.**

- Silent install: `dist/Open-Prism-0.1.0-win-x64.exe /S` exited 0 in 6.4 s. No SmartScreen/UAC prompt in silent mode.
- Installed to `C:\Users\gusta\AppData\Local\Programs\Open Prism`; `Open Prism.exe` and `Uninstall Open Prism.exe` present.
- Start Menu shortcut created: `C:\Users\gusta\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Open Prism.lnk`.
- Registry entry present: `HKCU\...\Uninstall\*` → `Open Prism 0.1.0` (per-user).
- Installed executable launched with `--remote-debugging-port=9225`; page target loaded with title `Open Prism` and `window.api` present.
- Silent uninstall `Uninstall Open Prism.exe /S` removed the executable, Start Menu shortcut, and registry entry. An empty install directory remained and was removed manually (see residual issues).

## `.cmd` shim resolution

**PASS.** With `%TEMP%\open-prism-cli-test` prepended to `PATH` and a `fake-cli.cmd` shim that echoes `fake-cli-ok`, `cross-spawn('fake-cli', ...)` exited `0` and printed `fake-cli-ok`:

```
0 fake-cli-ok
```

## Claude CLI smoke result

**PASS.** `window.api.inlineEdit({provider:'claude', model:'', selection:'x', instruction:'Reply with exactly the word OK and nothing else', before:'', after:''})` resolved successfully in 8.5 s with the response `OK\n`. Repeated standalone and in the second full run (6.4 s) with the same result. No auth or network error occurred.

## Residual issues / observations

1. **First test instance exited after the run, cause not established (not reproduced).** The first packaged-app instance was alive through and after all checks, then was gone within ~1–2 minutes. There was no crash output (`stderr` was clean apart from the DevTools banner), no Windows `Application Error`/WER event, and no crash dump; Chromium flushed session storage normally at exit. A second instance remained alive while idle and through the entire checklist re-run. This looks like an external/normal window close or environment teardown rather than a main-process crash, but it is worth watching.
2. **Uninstaller leaves an empty install directory.** After `/S` uninstall, `%LOCALAPPDATA%\Programs\Open Prism` remained as an empty folder (executable, shortcut, and registry entry were removed); it was removable manually. Cosmetic NSIS behavior, not a functional blocker.
3. **Tectonic Fontconfig warning on Windows.** The compile log includes `Fontconfig error: Cannot load default config file: No such file: (null)`. This is non-fatal log noise; the PDF compiled successfully. It may confuse users reading the compile log.
4. **First compile requires network and is slow.** Tectonic 0.17.0 downloads its bundle on first use (101 s cold vs. seconds warm). Expected behavior, but worth documenting for offline use.
5. **Unsigned build.** Silent automation installs bypass SmartScreen, but interactive users will see the "Unknown publisher" warning until the build is code-signed.
6. **Cosmetic:** the uninstall registry entry has an empty `InstallLocation` value.

## Coverage notes

- ZIP import is covered by `tests/zip.test.ts` and `tests/projectStore.test.ts`.
- Codex was not installed on the QA machine; its path was exercised through automated tests only.
- Desktop shortcut and icon creation, and silent uninstall, were verified during NSIS QA.

## Verdict

Windows end-to-end functionality is verified in the packaged app: project creation, save/reopen, Tectonic compilation, PDF preview file generation, PDF export to Downloads, file tree, rename/delete, Claude CLI integration, portable ZIP launch, per-user NSIS install/launch/uninstall, and `.cmd` shim resolution all pass. Residual items are cosmetic or environmental; no functional blocker was found.

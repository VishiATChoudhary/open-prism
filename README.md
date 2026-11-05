<p align="center">
  <img src="resources/app-icon.png" alt="Open Prism app icon" width="96" height="96" />
</p>

<h1 align="center">Open Prism</h1>

<p align="center">
  A LaTeX workspace powered by your local <strong>Claude CLI</strong> — describe a document in plain language and watch Claude write, compile, and fix the LaTeX for you.
</p>

<p align="center">
  <a href="https://github.com/VishiATChoudhary/open-prism/releases/latest">
    <img alt="Download for macOS" src="https://img.shields.io/badge/Download-macOS%20DMG-2f81f7?style=for-the-badge&logo=apple&logoColor=white" />
  </a>
  <a href="https://github.com/VishiATChoudhary/open-prism/releases/latest">
    <img alt="Download for Windows" src="https://img.shields.io/badge/Download-Windows%20x64-2f81f7?style=for-the-badge" />
  </a>
  <a href="#develop">
    <img alt="Run locally" src="https://img.shields.io/badge/Run-Locally-8b5cf6?style=for-the-badge&logo=electron&logoColor=white" />
  </a>
  <a href="#license">
    <img alt="MIT license" src="https://img.shields.io/badge/License-MIT-111827?style=for-the-badge" />
  </a>
</p>

<p align="center">
  <img alt="Open Prism home screen" src="home.png" />
</p>

<p align="center">
  <img alt="Open Prism editor view" src="editor.png" />
</p>

## What It Is

Open Prism is a desktop LaTeX environment built around the **Claude CLI**.
Instead of bolting an API key onto a chat box, it spawns your locally installed,
already-authenticated [`claude`](https://docs.claude.com/en/docs/claude-code)
command — so the same Claude you run in your terminal drafts and revises the
LaTeX, while you compile with Tectonic, inspect the PDF, and export to Downloads.

Why drive Claude through its CLI:

- **No API keys in the app.** Auth lives in your Claude CLI; Open Prism never
  stores or sees a key.
- **Your plan, your usage.** Requests run through your existing Claude
  subscription/login, not a separate billing path.
- **Local and private.** The model is reached by spawning a local process on
  your `PATH` — nothing is proxied through a third-party server.

`codex` is also supported as an alternative provider, but Claude is the
first-class path.

## Highlights

| Draft with Claude | Compile | Iterate | Export |
| --- | --- | --- | --- |
| Chat in plain language; your local Claude CLI returns editable LaTeX. | Compile with Tectonic from inside the app. | Show Claude the errors, let it repair them, keep editing. | Save the latest compiled PDF directly to your Downloads folder. |

## Download

Get the latest build from the
[Releases page](https://github.com/VishiATChoudhary/open-prism/releases/latest).

- macOS DMG (Apple Silicon and Intel)
- Windows x64 installer and portable ZIP (extract the ZIP and run `Open Prism.exe`)

The macOS app is ad-hoc signed and not Apple-notarized. On first launch, macOS
may require you to right-click the app and choose **Open**.

The Windows installer and portable executable are currently unsigned, so
SmartScreen may show "Unknown publisher" or "Windows protected your PC". Choose
**More info → Run anyway**.

## Requirements

- macOS 12+ for the macOS app, or Windows 10/11 x64 for the Windows app
- The [`claude` CLI](https://docs.claude.com/en/docs/claude-code) installed, authenticated, and on your `PATH` (or `codex` as an alternative)
  - Windows: install with the native installer (`irm https://claude.ai/install.ps1 | iex`) or a global npm install (`npm install -g @anthropic-ai/claude-code`); make sure `claude` ends up on your `PATH`
- [Tectonic](https://tectonic-typesetting.github.io) available on your `PATH`
  - Windows: `scoop install tectonic` (recommended), the official Windows ZIP from GitHub Releases (extract it and add the folder to `PATH`), or `cargo install tectonic` (requires Rust and C/C++ toolchains). Chocolatey's community package is outdated and not recommended.
- Node.js 20+ if you are developing locally

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Create a macOS DMG:

```bash
npm run package:mac
```

`npm run package:mac` must run on macOS and writes the DMG to `dist/`.

Create the Windows installer and portable ZIP:

```bash
npm run package:win
```

`npm run package:win` must run on Windows and writes
`Open-Prism-<version>-win-x64.exe` (NSIS) and
`Open-Prism-<version>-win-x64.zip` (portable) to `dist/`.

## How It Works

Open Prism stores projects in `~/.openprism` (`C:\Users\<you>\.openprism` on
Windows). Each project is a plain folder with your source files, assets, build
output, and a `.prism.json` metadata file.

The workspace includes:

- a file explorer for project folders
- a CodeMirror LaTeX editor
- a chat pane connected to your chosen local AI CLI
- a pdf.js preview pane
- a compile log for Tectonic errors
- save, compile, and PDF export actions in the top bar

## Project Shape

```text
~/.openprism/
  my-paper/
    main.tex
    assets/
    build/
      main.pdf
    .prism.json
  settings.json
```

On Windows, `~/.openprism` means `C:\Users\<you>\.openprism`.

## License

MIT

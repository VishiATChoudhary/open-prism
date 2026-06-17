<p align="center">
  <img src="resources/app-icon.png" alt="Open Prism app icon" width="96" height="96" />
</p>

<h1 align="center">Open Prism</h1>

<p align="center">
  A local-first AI LaTeX workspace for turning plain-language document ideas into compiled PDFs.
</p>

<p align="center">
  <a href="https://github.com/VishiATChoudhary/open-prism/releases/latest">
    <img alt="Download for macOS" src="https://img.shields.io/badge/Download-macOS%20DMG-2f81f7?style=for-the-badge&logo=apple&logoColor=white" />
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

## What It Is

Open Prism is a desktop writing environment for LaTeX documents. Describe what
you want in chat, let your local AI CLI draft or revise the LaTeX, compile with
Tectonic, inspect the PDF, and export the finished document to Downloads.

It is built around local tools. Open Prism talks to your installed `claude` or
`codex` CLI instead of storing API keys inside the app.

## Highlights

| Draft | Compile | Iterate | Export |
| --- | --- | --- | --- |
| Chat in plain language and receive editable LaTeX. | Compile with Tectonic from inside the app. | View errors, ask the assistant to repair them, and keep editing. | Save the latest compiled PDF directly to `~/Downloads`. |

## Download

Get the latest macOS build from the
[Releases page](https://github.com/VishiATChoudhary/open-prism/releases/latest).

The current packaged app is ad-hoc signed and not Apple-notarized. On first
launch, macOS may require you to right-click the app and choose **Open**.

## Requirements

- macOS for the packaged desktop app
- [Tectonic](https://tectonic-typesetting.github.io) available on your `PATH`
- `claude` and/or `codex` CLI installed, authenticated, and available on your `PATH`
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

The generated installer is written to `dist/`.

## How It Works

Open Prism stores projects in `~/.openprism`. Each project is a plain folder
with your source files, assets, build output, and a `.prism.json` metadata file.

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

## License

MIT

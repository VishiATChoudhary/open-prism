# Open Prism

Open-source desktop clone of ChatGPT's "Prism": describe a document in chat, an
AI writes the LaTeX, you compile it to PDF with Tectonic and iterate. The AI is
reached by spawning your locally installed `claude` or `chatgpt` CLI. No API
keys are stored in the app.

## Download

Grab the latest macOS `.dmg` from the
[**Releases page**](https://github.com/VishiATChoudhary/open-prism/releases/latest)
(Apple Silicon `arm64` and Intel `x64` builds). The app is ad-hoc signed, not
notarized — on first launch, right-click the app and choose **Open** to bypass
Gatekeeper.

## Requirements

- Node.js 20+
- [Tectonic](https://tectonic-typesetting.github.io) on your `PATH`
- A `claude` and/or `chatgpt` CLI installed and authenticated on your `PATH`

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## How It Works

- On startup, Open Prism creates `~/.openprism` and stores projects there.
- The first screen is a project home listing the folders under `~/.openprism`.
- Create a project from the home screen, or click an existing project to enter
  its editor, chat, and PDF workspace.
- Left pane: CodeMirror LaTeX editor on top, chat on bottom.
- Right pane: pdf.js viewer and a collapsible compile-error log.
- Chat sends your message plus the current source to the CLI; the reply's
  `latex` fenced code block replaces the editor content.
- Compilation is manual with the Compile button or Cmd/Ctrl+Enter.
- Documents are plain folders under `~/.openprism`: `main.tex`, `assets/`,
  `build/main.pdf`, and `.prism.json` for entry, provider/model, and chat
  history. Global defaults live in `~/.openprism/settings.json`.

## License

MIT

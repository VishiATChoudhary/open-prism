# Open Prism — AI LaTeX Compiler + PDF Viewer (Design)

Date: 2026-06-16
Status: Approved (pending spec review)

## Summary

Open-source desktop clone of ChatGPT's "Prism": describe a document in chat, an
AI writes/edits LaTeX, the user compiles to PDF and iterates. The app is a local
Electron desktop application. AI is reached by spawning a locally installed CLI
(`claude` or `codex`) — no API keys stored in the app. LaTeX is compiled with
Tectonic. UI is minimalist, built from shadcn/ui components.

## Goals

- Prism-like interface: source editor + chat on the left, PDF viewer on the right.
- AI generates and edits the active `.tex` via the user's existing CLI auth.
- Manual, explicit compilation to PDF using Tectonic.
- Documents stored as real on-disk project folders.
- Minimalist look using shadcn/ui.

## Non-Goals (v1)

- No direct API/SDK calls or key management (CLI only).
- No auto-recompile on edit (manual only).
- No multi-user / cloud sync / accounts.
- No heavy E2E test suite.
- No accept/reject diff UI for AI edits (direct replace + editor undo).

## Tech Choices

- Build/runtime: Electron via `electron-vite`.
- UI: React + Tailwind CSS + shadcn/ui.
- Editor: CodeMirror 6 (LaTeX syntax) — chosen over Monaco for leanness.
- PDF: `pdfjs-dist` (pdf.js) rendered to canvas.
- Compile: Tectonic (the user's required LaTeX engine; never pdflatex/xelatex/lualatex/latexmk).

## Architecture

Three Electron layers, strict separation:

- **Main process (Node)** — owns the filesystem and child processes. Exposes IPC
  handlers:
  - `project:new`, `project:open`, `project:save`
  - `file:read`, `file:write`
  - `compile` — spawn Tectonic, return PDF path or error log
  - `ai:chat` — spawn `claude`/`codex` CLI, stream stdout back to renderer
  - `settings:get`, `settings:set`
- **Preload** — `contextBridge` exposes a typed `window.api.*` surface. Security:
  `contextIsolation: true`, `nodeIntegration: false`, `sandbox` where feasible.
- **Renderer (React)** — UI only. All privileged actions go through `window.api`.

## Layout

Left column splits vertically (resizable): CodeMirror editor on top, chat docked
on the bottom. Right column is a full-height PDF viewer. A top bar holds project
name, Compile button, and Settings.

```
┌───────────────────────────────────────────────────────┐
│ topbar: project · Compile (⌘↵) · settings             │
├─────────────────────────┬─────────────────────────────┤
│ SOURCE EDITOR           │  PDF VIEWER                 │
│ (CodeMirror, .tex)      │  (pdf.js canvas, scroll/zoom)│
├─────────────────────────┤                             │
│ CHAT (docked bottom)    │                             │
│ messages + input + send │                             │
└─────────────────────────┴─────────────────────────────┘
```

shadcn components used: `Resizable` (panels), `Button`, `Textarea`, `Input`,
`ScrollArea`, `Select`, `Sonner` (toasts), `Collapsible` (error log).

## Data Flow

### Compile (manual)
1. User clicks Compile or presses ⌘↵.
2. Renderer sends current editor `.tex` content to main.
3. Main writes the entry `.tex`, runs `tectonic <entry>` in the project dir.
4. Success → return PDF path; renderer reloads it in pdf.js.
5. Failure → return Tectonic log; renderer shows it in a collapsible panel below
   the PDF. Non-blocking.

### AI chat
1. User types a message in the chat input.
2. Renderer builds the prompt: system instructions + current `.tex` + user message
   + recent chat history.
3. Main spawns the configured CLI (`claude -p ...` or `codex exec ...`) and streams
   stdout back to the chat bubble.
4. On completion, the renderer extracts the first fenced ```latex block from the
   reply and **directly replaces** the editor content (undo available; manual
   compile is the safety gate). If no block is found, the reply is treated as a
   plain chat answer and the editor is left unchanged.
5. User manually compiles when ready.

## Project Format

A document is a folder on disk:

```
MyDoc/
  main.tex          # entry point
  assets/           # images and other includes
  build/main.pdf    # Tectonic output
  .prism.json       # { entry, provider, model, chatHistory }
```

- **New** scaffolds the folder with a starter `main.tex` and `.prism.json`.
- **Open** is a folder picker; the app reads `.prism.json` (defaults if absent).
- **Save** writes the editor buffer to the entry `.tex` and persists `.prism.json`.

## Settings

- Provider: `claude` | `codex` (which CLI binary to spawn).
- Model: free-text/passed-through flag (optional).
- Persisted per-project in `.prism.json`; a global default lives in Electron
  `userData`.

## Error Handling

- Tectonic binary missing → toast with install hint; compile disabled gracefully.
- CLI binary missing / not authed → toast with hint; chat send fails non-fatally.
- Compile errors → collapsible Tectonic log panel under the PDF, non-blocking.
- File IO errors → toast; never crash the renderer.

## Testing

- Unit tests (pure functions, no Electron):
  - prompt builder (system + source + message + history assembly).
  - LaTeX fenced-block extractor (handles ```latex, ```tex, none, multiple).
- Manual smoke test of compile + chat loop for v1. No automated E2E.

## Module Boundaries

- `main/ipc/*` — one file per IPC domain (project, file, compile, ai, settings).
- `main/services/tectonic.ts` — spawn + parse Tectonic.
- `main/services/aiCli.ts` — spawn + stream the AI CLI.
- `shared/prompt.ts` — pure prompt builder (tested).
- `shared/latex.ts` — pure fenced-block extractor (tested).
- `renderer/` — React UI, each pane a focused component.

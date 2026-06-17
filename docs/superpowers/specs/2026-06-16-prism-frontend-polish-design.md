# Open Prism — Frontend Polish (Design)

Date: 2026-06-16
Status: Pending user approval

## Summary

Redesign the Open Prism Electron app UI to a reference-level (mistral.ai / oryzo.ai
/ landonorris) aesthetic: dark, precise, "instrument" feel. Centerpieces: an
aesthetic chat window, an animated LLM-thinking loader, and a live CLI reasoning
log surfaced during generation. No landing page, no image assets — all visuals are
hand-built CSS / SVG / canvas.

## Decisions (locked)

- Scope: polish the existing Electron app UI only. No marketing/landing page.
- Visuals: pure code (CSS gradients, noise, animated SVG). No binary image assets.
- Reasoning log depth: **plain stream only**. Keep `claude -p`. Surface the raw
  streamed stdout tokens as a live "thinking" log under the loader. No switch to
  `stream-json`; works for both `claude` and `codex` providers. No changes to
  `main/services/aiCli.ts` or `main/ipc/ai.ts`.

## Aesthetic Direction

- Near-black base background (`240 8% 6%`), warm-white foreground.
- Single restrained accent: a "prism" spectral gradient (violet → cyan) used ONLY
  on active / loading / focus states — never as decoration.
- Tight type scale (Inter, system fallback). Hairline borders. One radius token.
- ~3% grain/noise overlay via CSS for depth. Soft elevation only on the chat input
  card and the floating thinking loader. No decorative drop shadows.
- `prefers-reduced-motion` respected globally.

## Chat Window

- Message bubbles: user right-aligned pill; assistant left, full-width, thin
  spectral left-border. Tiny SVG marks (prism glyph = assistant, dot = you).
- Assistant messages render markdown + fenced code (mono, per-block copy button).
- When a reply contains a LaTeX block that is applied to the editor, show an inline
  "↳ applied to document" chip on that message.
- Input: auto-grow textarea in a floating elevated card; ⌘↵ / Enter hint; the send
  button morphs to a stop affordance while streaming.
- Empty state: centered prism glyph + 3 example-prompt chips that populate the input
  on click.

## LLM Thinking Loader + Reasoning Log (centerpiece)

- On send, a Thinking Panel mounts in the assistant message slot.
- Loader: pure CSS/SVG prism refraction animation (a beam splitting into a spectrum),
  looping, with a phase shimmer and an elapsed-time counter.
- Reasoning log: the raw streamed tokens from the CLI render live, line-wrapped,
  monospace, under the loader. Auto-scrolls. It is the actual model output streaming
  in — no fabricated steps.
- When the final answer resolves, the panel collapses: loader is replaced by the
  finished assistant message; the reasoning log collapses to a one-line, expandable
  "Show reasoning" summary preserved on that message.

## Motion System

- Add `framer-motion`.
- Spring-based transitions: message enter (fade + rise), loader mount/unmount, panel
  collapse, layout shifts on pane resize.
- Global ease/duration tokens (150–250ms). All motion gated by `prefers-reduced-motion`.

## Architecture / Files

Renderer-only changes plus styling tokens. No main-process or IPC changes.

- `src/renderer/index.css` — color tokens, grain overlay, font import, motion tokens.
- `tailwind.config.js` — spectral/accent colors, keyframes, motion utilities.
- `src/renderer/components/ChatPane.tsx` — slim orchestrator; split into:
  - `chat/ChatMessage.tsx` — one message (markdown, code blocks, applied chip).
  - `chat/ThinkingPanel.tsx` — loader + live reasoning log + elapsed timer.
  - `chat/ReasoningLog.tsx` — the streamed-token log (live + collapsed states).
  - `chat/ChatInput.tsx` — auto-grow input card, send/stop morph.
  - `chat/EmptyState.tsx` — prism glyph + example chips.
  - `chat/PrismGlyph.tsx` — shared SVG mark + loader primitive.
- `src/renderer/components/TopBar.tsx`, `EditorPane.tsx`, `PdfPane.tsx`,
  `ErrorLog.tsx` — visual pass to match the new tokens (no logic change).
- `src/renderer/state/useProject.ts` — store the per-message reasoning text so the
  collapsed "Show reasoning" survives after streaming (additive field on messages).

## Data Flow (unchanged transport)

1. User sends → existing `window.api.chat(..., onChunk)` streams stdout chunks.
2. Each chunk appends to the live reasoning log in `ThinkingPanel` (existing
   `streaming` state, relocated into the new components).
3. On resolve, the accumulated text becomes the assistant message; the streamed text
   is retained as that message's collapsible reasoning.
4. LaTeX block extraction + editor replace + toast: unchanged.

## Error Handling

- Chat/compile errors: unchanged toasts. On chat error the thinking panel unmounts
  cleanly and shows nothing partial as a committed message.

## Testing

- Existing unit tests (prompt builder, latex extractor) stay green.
- Add a small render test for `ReasoningLog` collapse/expand state.
- Manual smoke: send a prompt, watch loader + live log, confirm collapse + apply chip.

## Non-Goals

- No `stream-json` / tool-event parsing (explicitly deferred).
- No landing page, no image generation, no new providers.
- No changes to compile, project, or settings logic.

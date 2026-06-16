import { createTheme } from '@uiw/codemirror-themes'
import { tags as t } from '@lezer/highlight'

/** Dark "instrument" CodeMirror theme tuned to the app's spectral palette. */
export const prismEditorThemeDark = createTheme({
  theme: 'dark',
  settings: {
    background: 'hsl(232 16% 6%)',
    foreground: 'hsl(40 18% 86%)',
    caret: 'hsl(266 84% 70%)',
    selection: 'hsl(266 84% 66% / 0.25)',
    selectionMatch: 'hsl(190 90% 58% / 0.18)',
    lineHighlight: 'hsl(230 14% 10% / 0.6)',
    gutterBackground: 'hsl(232 16% 6%)',
    gutterForeground: 'hsl(230 8% 34%)',
    gutterBorder: 'transparent',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
  },
  styles: [
    { tag: t.comment, color: 'hsl(230 8% 42%)', fontStyle: 'italic' },
    { tag: [t.keyword, t.controlKeyword, t.modifier], color: 'hsl(266 84% 72%)' },
    { tag: [t.tagName, t.heading], color: 'hsl(190 90% 62%)' },
    { tag: [t.string, t.special(t.string)], color: 'hsl(152 60% 60%)' },
    { tag: [t.number, t.bool, t.atom], color: 'hsl(28 90% 64%)' },
    { tag: [t.bracket, t.brace, t.punctuation], color: 'hsl(230 10% 52%)' },
    { tag: [t.variableName, t.propertyName], color: 'hsl(40 18% 86%)' },
    { tag: [t.function(t.variableName), t.labelName], color: 'hsl(224 88% 72%)' },
    { tag: [t.typeName, t.className], color: 'hsl(190 80% 66%)' }
  ]
})

/** Light "instrument" CodeMirror theme — warm paper tones, same spectral hues. */
export const prismEditorThemeLight = createTheme({
  theme: 'light',
  settings: {
    background: 'hsl(40 30% 98%)',
    foreground: 'hsl(232 22% 18%)',
    caret: 'hsl(266 84% 56%)',
    selection: 'hsl(266 84% 60% / 0.18)',
    selectionMatch: 'hsl(190 90% 44% / 0.16)',
    lineHighlight: 'hsl(40 24% 92% / 0.7)',
    gutterBackground: 'hsl(40 30% 98%)',
    gutterForeground: 'hsl(232 10% 60%)',
    gutterBorder: 'transparent',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
  },
  styles: [
    { tag: t.comment, color: 'hsl(232 8% 52%)', fontStyle: 'italic' },
    { tag: [t.keyword, t.controlKeyword, t.modifier], color: 'hsl(266 74% 52%)' },
    { tag: [t.tagName, t.heading], color: 'hsl(190 80% 38%)' },
    { tag: [t.string, t.special(t.string)], color: 'hsl(152 52% 36%)' },
    { tag: [t.number, t.bool, t.atom], color: 'hsl(24 80% 46%)' },
    { tag: [t.bracket, t.brace, t.punctuation], color: 'hsl(232 10% 50%)' },
    { tag: [t.variableName, t.propertyName], color: 'hsl(232 22% 18%)' },
    { tag: [t.function(t.variableName), t.labelName], color: 'hsl(224 72% 50%)' },
    { tag: [t.typeName, t.className], color: 'hsl(190 70% 40%)' }
  ]
})

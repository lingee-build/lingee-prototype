import { useEffect, useRef } from "react"
import { defaultKeymap, history, historyKeymap, indentMore } from "@codemirror/commands"
import { json } from "@codemirror/lang-json"
import { bracketMatching, indentOnInput, foldGutter, foldKeymap, HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { EditorState } from "@codemirror/state"
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder } from "@codemirror/view"
import { tags } from "@lezer/highlight"

const appearance = EditorView.theme({
  "&": { height: "100%", backgroundColor: "var(--background-base)", color: "var(--text-base)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-family-mono, monospace)", fontSize: "13px", lineHeight: "24px", fontFeatureSettings: "var(--font-family-mono--font-feature-settings)" },
  ".cm-content": { paddingBlock: "4px" },
  ".cm-gutters": { backgroundColor: "var(--background-stronger)", color: "var(--text-weaker)", border: "none" },
  ".cm-lineNumbers .cm-gutterElement": { minWidth: "4ch", padding: "0 8px 0 12px" },
  ".cm-foldGutter .cm-gutterElement": { display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "0 4px" },
  ".cm-foldMarker": { display: "flex", alignItems: "center", height: "24px", cursor: "pointer" },
})
const colors = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.string, color: "var(--syntax-string)" },
  { tag: tags.propertyName, color: "var(--syntax-property)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--syntax-primitive)" },
]))

function foldMarker(open: boolean) {
  const marker = document.createElement("span")
  marker.className = "cm-foldMarker"
  marker.setAttribute("aria-hidden", "true")
  marker.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${open ? "M4 6l4 4 4-4" : "M6 4l4 4-4 4"}"/></svg>`
  return marker
}

export function EvaluationJsonEditor({ value, invalid, onChange }: {
  value: string; invalid: boolean; onChange: (value: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const editor = useRef<EditorView>(null)
  const initial = useRef(value)
  const change = useRef(onChange)
  change.current = onChange
  useEffect(() => {
    if (!host.current) return
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({ doc: initial.current, extensions: [
        appearance, colors, json(), lineNumbers(), foldGutter({ markerDOM: foldMarker }), history(), drawSelection(),
        bracketMatching(), indentOnInput(), highlightActiveLine(), highlightActiveLineGutter(), EditorView.lineWrapping,
        placeholder('{"customer": {"code": "C001"}}'),
        EditorView.contentAttributes.of({
          "aria-labelledby": "evaluation-placeholder-label",
          "aria-describedby": "evaluation-placeholder-hint evaluation-placeholder-diagnostics",
          spellcheck: "false",
        }),
        keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, { key: "Mod-]", run: indentMore }]),
        EditorView.updateListener.of(update => {
          if (update.docChanged) change.current(update.state.doc.toString())
        }),
      ] }),
    })
    editor.current = view
    return () => { editor.current = null; view.destroy() }
  }, [])
  useEffect(() => {
    const view = editor.current
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
    view?.contentDOM.setAttribute("aria-invalid", String(invalid))
  }, [value, invalid])
  return <div className="eval-json-editor-content" ref={host} />
}

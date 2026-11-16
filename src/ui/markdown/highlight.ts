import { bundledLanguages, createHighlighter, type BundledLanguage, type Highlighter, type ThemeRegistrationAny } from "shiki"
import { kcodeTheme } from "./markdown-assets.gen"

let highlighter: Promise<Highlighter> | undefined
const cache = new Map<string, string>()
const pending = new Map<string, Promise<void>>()

const keyOf = (code: string, lang: string) => `${lang}\u0000${code}`

/** 已高亮过的代码直接取缓存（同步），流式输出时不会来回闪 */
export const highlighted = (code: string, lang: string) => cache.get(keyOf(code, lang))

/** 异步高亮一段代码，完成后回调一次；语言按需加载，主题与线上相同（KCode） */
export function highlight(code: string, lang: string, done: () => void) {
  const key = keyOf(code, lang)
  if (cache.has(key)) return
  const running = pending.get(key)
  if (running) return void running.then(done)
  const task = (async () => {
    highlighter ??= createHighlighter({ themes: [kcodeTheme as unknown as ThemeRegistrationAny], langs: [] })
    const shiki = await highlighter
    const language = lang in bundledLanguages ? lang : "text"
    if (!shiki.getLoadedLanguages().includes(language)) await shiki.loadLanguage(language as BundledLanguage)
    cache.set(key, shiki.codeToHtml(code, { lang: language, theme: "KCode", tabindex: false }))
  })()
    .catch(() => undefined)
    .finally(() => pending.delete(key))
  pending.set(key, task)
  void task.then(done)
}

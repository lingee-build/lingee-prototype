import { evaluationEn, evaluationZh } from "./evaluation"
import { create } from "zustand"
import { dict as appEn } from "./dict/app/en"
import { dict as appZh } from "./dict/app/zh"
import { dict as uiEn } from "./dict/ui/en"
import { dict as uiZh } from "./dict/ui/zh"
import { localEn, localZh } from "./local"

export type Locale = "zh" | "en"
export const LOCALES: readonly Locale[] = ["zh", "en"]

const dicts: Record<Locale, Record<string, string>> = {
  en: { ...uiEn, ...appEn, ...localEn, ...evaluationEn },
  zh: { ...uiEn, ...appEn, ...localEn, ...uiZh, ...appZh, ...localZh, ...evaluationZh },
}

const STORAGE_KEY = "lingee-prototype.locale"

export const useLocaleStore = create<{ locale: Locale; setLocale: (locale: Locale) => void }>((set) => ({
  locale: localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "zh",
  setLocale: (locale) => {
    localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.lang = locale
    set({ locale })
  },
}))

export type Translate = (key: string, params?: Record<string, string | number | boolean>) => string

export function translate(locale: Locale, key: string, params?: Record<string, string | number | boolean>) {
  const template = dicts[locale][key] ?? key
  if (!params) return template
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => String(params[name] ?? ""))
}

/** 文案 key 与线上完全一致，直接照抄原工程的 t("...") 调用即可 */
export function useT(): Translate {
  const locale = useLocaleStore((s) => s.locale)
  return (key, params) => translate(locale, key, params)
}

export const localeLabel = (locale: Locale) => translate(locale, `language.${locale}`)

import { create } from "zustand"
import { resolveThemeVariant, themeToCss } from "@/vendor/kcode-ui/theme/resolve"
import type { DesktopTheme } from "@/vendor/kcode-ui/theme/types"
import nova from "@/vendor/kcode-ui/theme/themes/nova.json"

export type ColorScheme = "system" | "light" | "dark"

const STORAGE_KEY = "kcode-color-scheme"
const STYLE_ID = "oc-theme"
const media = window.matchMedia("(prefers-color-scheme: dark)")

const resolveMode = (scheme: ColorScheme) => (scheme === "system" ? (media.matches ? "dark" : "light") : scheme)

/** 与线上一致：由 nova 主题种子色推导出整套 token，写进 :root */
function apply(scheme: ColorScheme) {
  const mode = resolveMode(scheme)
  const dark = mode === "dark"
  const theme = nova as DesktopTheme
  const style = document.getElementById(STYLE_ID) ?? document.head.appendChild(Object.assign(document.createElement("style"), { id: STYLE_ID }))
  style.textContent = `:root {\n  color-scheme: ${mode};\n  --text-mix-blend-mode: ${dark ? "plus-lighter" : "multiply"};\n  ${themeToCss(resolveThemeVariant(dark ? theme.dark : theme.light, dark))}\n}`
  document.documentElement.dataset.theme = "nova"
  document.documentElement.dataset.colorScheme = mode
}

export const useThemeStore = create<{ colorScheme: ColorScheme; setColorScheme: (scheme: ColorScheme) => void }>((set) => ({
  colorScheme: (localStorage.getItem(STORAGE_KEY) as ColorScheme | null) ?? "system",
  setColorScheme: (colorScheme) => {
    localStorage.setItem(STORAGE_KEY, colorScheme)
    apply(colorScheme)
    set({ colorScheme })
  },
}))

export function initTheme() {
  apply(useThemeStore.getState().colorScheme)
  media.addEventListener("change", () => {
    const scheme = useThemeStore.getState().colorScheme
    if (scheme === "system") apply(scheme)
  })
}

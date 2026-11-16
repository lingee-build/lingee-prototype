import { icons, iconViewBox, type IconName } from "@/ui/icon/icons.gen"
import { SKILL_TABS, getSkillDisplayName } from "./skill-entries"

const svg = (name: IconName) =>
  `<svg viewBox="${iconViewBox(name)}" fill="none" style="width:100%;height:100%">${icons[name]}</svg>`

/**
 * 输入框里的技能胶囊。编辑器是非受控的 contenteditable，胶囊作为不可编辑节点直接插进 DOM，
 * 内联样式逐项照搬原工程的 createPill。
 */
export function createSkillPill(name: string, onRemove: () => void) {
  const pill = document.createElement("span")
  pill.dataset.type = "agent"
  pill.dataset.name = name
  pill.dataset.content = `/${name}`
  pill.contentEditable = "false"
  Object.assign(pill.style, {
    userSelect: "text",
    cursor: "default",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    padding: "4px 8px",
    borderRadius: "12px",
    backgroundColor: "var(--primary-50)",
    verticalAlign: "top",
    whiteSpace: "nowrap",
    marginBottom: "8px",
  })

  const icon = document.createElement("span")
  icon.className = "pill-icon"
  icon.setAttribute("aria-hidden", "true")
  Object.assign(icon.style, { width: "16px", height: "16px", color: "var(--primary-600)" })
  icon.innerHTML = svg(SKILL_TABS.find((tab) => tab.name === name)?.iconName ?? "skill-bolt")

  const text = document.createElement("span")
  text.textContent = getSkillDisplayName(name)
  Object.assign(text.style, {
    color: "var(--primary-600)",
    fontFamily: '"PingFang SC", sans-serif',
    fontSize: "14px",
    fontWeight: "500",
    lineHeight: "22px",
  })

  const close = document.createElement("span")
  close.className = "pill-close"
  close.setAttribute("aria-hidden", "true")
  Object.assign(close.style, { width: "16px", height: "16px", flexShrink: "0", color: "var(--primary-400)", cursor: "pointer" })
  close.innerHTML = svg("close-small-fill")
  close.addEventListener("mousedown", (e) => {
    e.preventDefault()
    e.stopPropagation()
    pill.remove()
    onRemove()
  })

  pill.replaceChildren(icon, text, close)
  return pill
}

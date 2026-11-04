import { useState, forwardRef, useEffect, useImperativeHandle, useRef, type KeyboardEvent } from "react"
import { cx } from "@/lib/cx"
import { parseSlash } from "./skill-entries"
import { createSkillPill } from "./skill-pill"

/** 光标前正在输入的触发词："/" 调技能或指令，"@" 引用文件 */
export interface Trigger {
  type: "slash" | "at"
  query: string
}

export interface EditorHandle {
  focus: () => void
  clear: () => void
  /** 用一段文本整体替换内容；前导 "/技能名" 会渲染成胶囊 */
  set: (text: string) => void
  /** 取出要发送的纯文本（胶囊还原成 "/技能名"、"@路径"） */
  value: () => string
  /** 把当前触发词替换成技能胶囊 / 文件引用 / 普通文本 */
  completeSkill: (name: string) => void
  completeFile: (path: string) => void
  completeText: (text: string) => void
}

interface EditorProps {
  placeholder: string
  defaultSkill?: string
  newSession: boolean
  hasAttachments?: boolean
  enhancing?: boolean
  onChange: (state: { empty: boolean; skill?: string; text: string; skillWidth: number }) => void
  onTrigger: (trigger: Trigger | null) => void
  /** 补全弹层打开时由它优先处理方向键 / 回车 / Esc；返回 true 表示已处理 */
  onKeyIntercept: (event: KeyboardEvent<HTMLDivElement>) => boolean
  onSubmit: () => void
  onFocusChange: (focused: boolean) => void
}

const readText = (el: HTMLElement) =>
  Array.from(el.childNodes)
    .map((node) => (node instanceof HTMLElement && node.dataset.content ? node.dataset.content : (node.textContent ?? "")))
    .join("")
    .replace(/ /g, " ")

function createFilePill(path: string) {
  const pill = document.createElement("span")
  pill.dataset.type = "file"
  pill.dataset.path = path
  pill.dataset.content = `@${path}`
  pill.contentEditable = "false"
  pill.textContent = `@${path}`
  return pill
}

/** 富文本输入区：非受控 contenteditable，支持技能胶囊、文件引用、Enter 发送、Shift+Enter 换行 */
export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(props, ref) {
  const [hasSkill, setHasSkill] = useState(false)
  const el = useRef<HTMLDivElement>(null)
  const latest = useRef(props)
  latest.current = props
  /** 触发词在文本节点里的范围，补全时整段替换 */
  const triggerRange = useRef<Range | null>(null)

  const notify = () => {
    const node = el.current
    if (!node) return
    // 清掉浏览器在空 contenteditable 里自动塞的占位 <br>，否则占位文案不会回来
    if (!node.textContent && !node.querySelector("[data-type]")) node.replaceChildren()
    const pill = node.querySelector<HTMLElement>("[data-type=agent]")
    setHasSkill(!!pill)
    const text = readText(node)
    latest.current.onChange({ empty: (pill ? text.replace(pill.dataset.content || "", "") : text).trim() === "", skill: pill?.dataset.name, text, skillWidth: pill ? pill.getBoundingClientRect().width + 8 : 0 })
  }

  /** 光标移动不产生 input 事件，所以输入、按键抬起、鼠标抬起后都要重新探测一次触发词 */
  const detectTrigger = () => {
    const selection = window.getSelection()
    const anchor = selection?.anchorNode
    triggerRange.current = null
    if (!selection?.isCollapsed || !anchor || anchor.nodeType !== Node.TEXT_NODE || !el.current?.contains(anchor)) {
      return latest.current.onTrigger(null)
    }
    const before = (anchor.textContent ?? "").slice(0, selection.anchorOffset)
    const match = before.match(/(^|[\s ])([/@])([^\s /@]*)$/)
    if (!match) return latest.current.onTrigger(null)
    const range = document.createRange()
    range.setStart(anchor, selection.anchorOffset - match[3].length - 1)
    range.setEnd(anchor, selection.anchorOffset)
    triggerRange.current = range
    latest.current.onTrigger({ type: match[2] === "/" ? "slash" : "at", query: match[3] })
  }

  const caretToEnd = () => {
    const node = el.current
    if (!node) return
    node.focus()
    const range = document.createRange()
    range.selectNodeContents(node)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  /** 用节点替换触发词，并在后面补一个空格、把光标放到空格之后 */
  const complete = (node: Node) => {
    const range = triggerRange.current
    if (!range) return
    range.deleteContents()
    const space = document.createTextNode(" ")
    range.insertNode(space)
    range.insertNode(node)
    const selection = window.getSelection()
    const after = document.createRange()
    after.setStartAfter(space)
    after.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(after)
    triggerRange.current = null
    latest.current.onTrigger(null)
    notify()
  }

  useImperativeHandle(ref, () => ({
    focus: caretToEnd,
    clear() {
      el.current?.replaceChildren(...(latest.current.defaultSkill ? [createSkillPill(latest.current.defaultSkill, notify), document.createTextNode(" ")] : []))
      latest.current.onTrigger(null)
      notify()
    },
    set(text) {
      const node = el.current
      if (!node) return
      const parsed = parseSlash(text)
      const skill = parsed.skill || latest.current.defaultSkill
      const body = parsed.body
      node.replaceChildren(
        ...(skill ? [createSkillPill(skill, notify), document.createTextNode(` ${body}`)] : [document.createTextNode(body)]),
      )
      notify()
      caretToEnd()
    },
    value: () => (el.current ? readText(el.current).trim() : ""),
    completeSkill: (name) => complete(createSkillPill(name, notify)),
    completeFile: (path) => complete(createFilePill(path)),
    completeText: (text) => complete(document.createTextNode(text)),
  }))

  useEffect(() => {
    if (props.defaultSkill && !el.current?.textContent) {
      el.current?.replaceChildren(createSkillPill(props.defaultSkill, notify), document.createTextNode(" "))
    }
    notify()
  }, [props.defaultSkill])

  return (
    <div
      ref={el}
      data-component="prompt-input"
      role="textbox"
      aria-multiline="true"
      aria-label={props.placeholder}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      autoCapitalize="sentences"
      autoCorrect="on"
      {...{ autoComplete: "off" }}
      inputMode="text"
      style={{ paddingBottom: hasSkill ? 6 : 14 }}
      onInput={() => {
        notify()
        detectTrigger()
      }}
      onKeyUp={(e) => {
        if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") detectTrigger()
      }}
      onMouseUp={detectTrigger}
      onFocus={() => props.onFocusChange(true)}
      onBlur={() => {
        props.onFocusChange(false)
        props.onTrigger(null)
      }}
      onPaste={(e) => {
        e.preventDefault()
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"))
      }}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return
        if (props.onKeyIntercept(e)) return
        if (e.key !== "Enter" || e.shiftKey) return
        e.preventDefault()
        props.onSubmit()
      }}
      className={cx(
        "select-text w-full px-4 pb-4 text-[16px] leading-[30px] text-[var(--prompt-input-text)] focus:outline-none whitespace-pre-wrap",
        "[&_[data-type=file]]:text-syntax-property [&_[data-type=agent]]:text-syntax-type [&_[data-type=agent]]:mr-[8px]",
        props.newSession && "mb-4",
        props.hasAttachments ? "pt-0" : "pt-4",
        props.enhancing && "enhance-text-shimmer",
      )}
    />
  )
})

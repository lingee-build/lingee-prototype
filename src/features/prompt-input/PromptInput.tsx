import { useEffect, useRef, useState } from "react"
import { DockContainer, DockShellForm, DockTray, IconButton, Icon, Tooltip } from "@/ui"
import { useSync } from "@/stores/sync"
import { EnhanceButton } from "./EnhanceButton"
import { ContextUsage } from "./ContextUsage"
import { Attachments, type Attachment } from "./Attachments"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { usePrompt } from "@/stores/prompt"
import { AttachMenu } from "./AttachMenu"
import { Editor, type EditorHandle } from "./Editor"
import { ModeChip } from "./ModeChip"
import { ModelSelector } from "./ModelSelector"
import { ProjectPicker } from "./ProjectPicker"
import { PromptPopover, type PopoverItem } from "./PromptPopover"
import { useCompletion } from "./use-completion"

export interface PromptDraft { text?: string; files?: File[] }
export interface PromptInputProps {
  /** 可选的视图草稿容器，由工作区持有；不写入服务器或浏览器持久存储。 */
  viewDraft?: PromptDraft
  contextSlot?: import("react").ReactNode
  onDraftChange?: (hasContent: boolean) => void
  /** 所在项目；新会话时在输入框下方展示项目选择 */
  projectId: string
  /** 有值表示在已有会话中（外框变细、下拉向上展开） */
  sessionId?: string
  working: boolean
  /** 入口引导，仅在首次可用且输入为空时填入，不自动发送。 */
  initialText?: string
  /** 空输入时显示的引导文案，不作为发送内容。 */
  placeholder?: string
  /** 当前工作区固定使用的技能，不写入输入草稿。 */
  defaultSkill?: string
  onSubmit: (text: string, files?: File[]) => void | Promise<void>
  onAbort: () => void
  onCreateProject: () => void
  onSkillChange?: (skill: string | undefined) => void
}

/**
 * 输入框：编辑区 + 底部工具条（+ 菜单 / 模式胶囊 / 模型 / 发送）。
 * 外层结构、类名与原工程 components/prompt-input.tsx 保持一致，逻辑按能力拆到同目录的小文件里。
 */
export function PromptInput(props: PromptInputProps) {
  const t = useT()
  const editor = useRef<EditorHandle>(null)
  const restoredText = useRef(props.viewDraft?.text)
  const initialTextApplied = useRef(restoredText.current !== undefined)
  const [focused, setFocused] = useState(false)
  const [empty, setEmpty] = useState(true)
  const [skillWidth, setSkillWidth] = useState(0)
  const [attachments, setAttachments] = useState<Attachment[]>(() => (props.viewDraft?.files || []).map(file => ({ id: crypto.randomUUID(), file, url: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined })))
  const attachmentsRef = useRef(attachments)
  attachmentsRef.current = attachments
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const [enhancing, setEnhancing] = useState(false)
  const [original, setOriginal] = useState<string>()
  const enhanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const project = useSync((state) => state.projects.find((item) => item.id === props.projectId))
  const [shake, setShake] = useState(false)
  const { mode, draft, takeDraft } = usePrompt()
  const inSession = props.sessionId !== undefined
  const disabled = enhancing || (!props.working && empty && !attachments.length)
  const hoodVisible = inSession && project?.git
  const restoreFocus = () => editor.current?.focus()
  const placeholder = props.placeholder ?? t(mode === "quest" ? "prompt.placeholder.quest" : "prompt.placeholder.normal", { example: "", agent: "" })

  // "/" 与 "@" 的补全：选中后把触发词替换成胶囊 / 文件引用 / 指令文本
  const applyCompletion = (item: PopoverItem) => {
    if (item.type === "file") return editor.current?.completeFile(item.path)
    if (item.command.kind === "skill") return editor.current?.completeSkill(item.command.id)
    editor.current?.completeText(item.command.title)
  }
  const completion = useCompletion(props.projectId, applyCompletion)

  useEffect(() => {
    if (restoredText.current !== undefined) editor.current?.set(restoredText.current)
  }, [])
  useEffect(() => {
    if (props.viewDraft) props.viewDraft.files = attachments.map(item => item.file)
    props.onDraftChange?.(!!props.viewDraft?.text?.trim() || attachments.length > 0)
  }, [attachments, props.viewDraft])

  // 外部来源写入的草稿：推荐卡片、技能入口发给新任务页；开发页的「编辑」发给刚建好的那个会话
  useEffect(() => {
    const text = takeDraft(props.sessionId)
    if (text !== undefined) editor.current?.set(text)
  }, [draft.seq, props.sessionId])

  useEffect(() => {
    if (!props.initialText || initialTextApplied.current) return
    initialTextApplied.current = true
    if (!editor.current?.value().trim()) editor.current?.set(props.initialText)
  }, [props.initialText])

  // 切换会话 / 项目后把焦点还给输入框
  useEffect(() => {
    editor.current?.focus()
  }, [props.sessionId, props.projectId])

  const clearAttachments = () => {
    attachmentsRef.current.forEach((item) => { if (item.url) URL.revokeObjectURL(item.url) })
    setAttachments([])
  }
  useEffect(() => () => {
    clearTimeout(enhanceTimer.current)
    attachmentsRef.current.forEach((item) => { if (item.url) URL.revokeObjectURL(item.url) })
  }, [])
  const attachmentContext = useRef({ projectId: props.projectId, sessionId: props.sessionId })
  useEffect(() => {
    if (attachmentContext.current.projectId === props.projectId && attachmentContext.current.sessionId === props.sessionId) return
    attachmentContext.current = { projectId: props.projectId, sessionId: props.sessionId }
    clearAttachments()
    clearTimeout(enhanceTimer.current)
    setEnhancing(false)
    setOriginal(undefined)
  }, [props.projectId, props.sessionId])

  const addFiles = (files: FileList | null) => {
    const selected = Array.from(files ?? []).map((file) => ({ id: crypto.randomUUID(), file, url: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined }))
    if (selected.length) setAttachments((current) => [...current, ...selected])
    restoreFocus()
  }
  const enhance = () => {
    if (enhancing) { clearTimeout(enhanceTimer.current); setEnhancing(false); return }
    if (original !== undefined) { editor.current?.set(original); setOriginal(undefined); return }
    const text = editor.current?.value() ?? ""
    if (!text) return
    setEnhancing(true)
    // Local prototype response; no product endpoint or user data leaves the browser.
    enhanceTimer.current = setTimeout(() => {
      setOriginal(text)
      editor.current?.set(`${text.trim()}\n\n${t("proto.prompt.enhanceRequirements")}`)
      setEnhancing(false)
    }, 700)
  }
  const submit = async () => {
    if (enhancing || (empty && !attachments.length && !props.working)) return
    if (props.working) return props.onAbort()
    const text = [editor.current?.value() ?? "", ...attachments.map((item) => `@${item.file.webkitRelativePath || item.file.name}`)].filter(Boolean).join("\n")
    if (!text) return
    try { await props.onSubmit(text, attachments.map(item => item.file)) } catch { return }
    clearAttachments()
    setOriginal(undefined)
    editor.current?.clear()
  }

  return (
    <div
      className={cx(
        "relative size-full flex flex-col gap-0",
        inSession &&
          !completion.trigger &&
          "before:content-[''] before:absolute before:-top-[80px] before:left-0 before:right-0 before:h-[80px] before:bg-[linear-gradient(to_bottom,var(--prompt-input-before-bg-start),var(--prompt-input-before-bg-end))] before:pointer-events-none before:z-[1]",
      )}
    >
      {completion.trigger && (
        <PromptPopover
          type={completion.trigger.type}
          items={completion.items}
          activeKey={completion.activeKey}
          newSession={!inSession}
          onSelect={applyCompletion}
          onActive={completion.setActiveKey}
        />
      )}
      {hoodVisible && (
        <div data-component="composer-banner-hood" className="relative z-[2] shrink-0 flex flex-col rounded-[30px_30px_0_0] backdrop-blur-[2px] text-[14px] leading-[22px] px-4" style={{ background: "var(--hood-bg)", width: "calc(100% - 40px)", margin: "0 auto", maxWidth: 760 }}>
          <div data-component="prompt-session-header" data-banner="branch" className="relative inline-flex w-full items-center justify-between pt-[9px] pb-[7px] min-h-[44px]">
            <div className="flex items-center flex-nowrap gap-x-5 min-w-0">
              <Tooltip placement="top" value={project.worktree}><span className="flex items-center gap-1 min-w-0 max-w-[280px] text-[var(--neutral-600)]"><Icon name="folder-group" size="small" /><span className="truncate prompt-hood-name">{project.name}</span></span></Tooltip>
              {project.branch && <Tooltip placement="top" value={project.branch}><span className="flex items-center gap-1 min-w-0 max-w-[240px] text-[var(--neutral-600)]"><Icon name="git-branch-network" size="small" /><span className="truncate prompt-hood-name">{project.branch}</span></span></Tooltip>}
            </div>
          </div>
        </div>
      )}
      <div
        className={cx("z-[3] flex flex-col gap-0 transition-colors duration-200 ease-out rounded-[30px]", inSession ? hoodVisible ? "p-0" : "p-[1px]" : "p-[3px]")}
        style={{ background: focused ? "var(--primary-500-6)" : "var(--neutral-50)", boxShadow: hoodVisible ? "0px -3px 10px 0px var(--shadow-colorblack-subtle)" : undefined }}
      >
        <DockContainer
          data-in-session={inSession ? "" : undefined}
          className={cx("group/prompt-input !p-0", inSession ? "h-auto min-h-[96px]" : "min-h-[unset] !border-0")}
        >
          <DockShellForm
            className="flex h-full min-h-0 flex-col"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <div
              className="relative flex-1 min-h-0 max-h-[220px] overflow-y-auto no-scrollbar"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) editor.current?.focus()
              }}
            >
              <Attachments items={attachments} onRemove={(id) => {
                const item = attachments.find((item) => item.id === id)
                if (item?.url) URL.revokeObjectURL(item.url)
                setAttachments((items) => items.filter((item) => item.id !== id))
              }} />
              {props.contextSlot}
              <div className="relative">
                <Editor
                  ref={editor}
                  placeholder={placeholder}
                  defaultSkill={props.defaultSkill}
                  newSession={!inSession}
                  hasAttachments={!!attachments.length}
                  enhancing={enhancing}
                  onFocusChange={setFocused}
                  onSubmit={submit}
                  onTrigger={completion.setTrigger}
                  onKeyIntercept={completion.intercept}
                  onChange={(state) => {
                    if (props.viewDraft) props.viewDraft.text = state.text
                    props.onDraftChange?.(!state.empty || attachmentsRef.current.length > 0)
                    setEmpty(state.empty)
                    setSkillWidth(state.skillWidth)
                    props.onSkillChange?.(state.skill)
                  }}
                />
                {empty && (
                  <div style={{ paddingLeft: 16 + skillWidth }} className={cx("absolute top-0 inset-x-0 px-4 text-[16px] leading-[30px] text-[var(--prompt-input-placeholder)] pointer-events-none whitespace-nowrap truncate", attachments.length ? "pt-0" : "pt-4")}>
                    {placeholder}
                  </div>
                )}
              </div>
            </div>

            <input ref={fileInput} type="file" multiple className="hidden" onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = "" }} />
            <input ref={folderInput} type="file" multiple {...{ webkitdirectory: "" }} className="hidden" onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = "" }} />
            <DockTray attach="top" className="shrink-0">
              <div className="prompt-input-bar flex items-center justify-between gap-1 min-w-0 px-2.5 pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <AttachMenu placement={inSession ? "top-start" : "bottom-start"} onPick={(folder) => (folder ? folderInput : fileInput).current?.click()} restoreFocus={restoreFocus} />
                  </div>
                </div>
                <div className="prompt-input-bar flex items-center gap-2 min-w-0 flex-1 relative">
                  <div className="chips-row flex items-center gap-2 min-w-0 flex-1" />
                  <ModeChip restoreFocus={restoreFocus} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {inSession && <ContextUsage projectId={props.projectId} restoreFocus={restoreFocus} />}
                  <ModelSelector placement={inSession ? "top-end" : "bottom-end"} restoreFocus={restoreFocus} />
                </div>
                <EnhanceButton state={enhancing ? "loading" : props.working || empty ? "disabled" : original !== undefined ? "applied" : "idle"} onClick={enhance} />
                <div
                  className="inline-flex"
                  onPointerDown={() => {
                    if (!disabled) return
                    setShake(false)
                    requestAnimationFrame(() => setShake(true))
                  }}
                >
                  <Tooltip placement="top" value={t(props.working ? "prompt.action.stop" : "prompt.action.send")}>
                    <IconButton
                      data-action="prompt-submit"
                      type="submit"
                      size="normal"
                      disabled={disabled}
                      icon={props.working ? "stop" : "arrow-up"}
                      iconClass="text-[var(--neutral-400)]"
                      iconSize="normal"
                      variant="ghost"
                      className={cx(
                        "size-9 min-w-9 min-h-9 rounded-[50%]",
                        disabled ? "bg-[rgba(0,0,0,0.03)]" : "bg-[var(--primary-600)] [&_[data-slot=icon-svg]]:!text-[var(--white-100)]",
                        shake && "prompt-submit-shake",
                      )}
                      onAnimationEnd={() => setShake(false)}
                      aria-label={t(props.working ? "prompt.action.stop" : "prompt.action.send")}
                    />
                  </Tooltip>
                </div>
              </div>
            </DockTray>
          </DockShellForm>
        </DockContainer>
        {!inSession && <ProjectPicker projectId={props.projectId} onCreateProject={props.onCreateProject} />}
      </div>
    </div>
  )
}


import { displayInfoErrors, normalizeDisplayInfo } from "./display-info"
import { usePanel } from "@/stores/panel"
import { useParams } from "react-router"
import { evaluationRepairTarget } from "@/services/evaluation-repair"
import { ControlledConfirmDialog } from "@/ui/dialog/ConfirmDialog"
import { useNavigate } from "react-router"
import { ObjectEvaluationReport } from "@/features/evaluation/ObjectEvaluationReport"
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { IconButton, SegmentedControl, showToast, useDialog } from "@/ui"
import { useT } from "@/i18n"
import type { Agent } from "@/mock/fixtures/dev"
import { agentService } from "@/services"
import { BasicInfoTab } from "./BasicInfoTab"
import { ChangelogSection } from "./ChangelogSection"
import { diffChanges, formOf, type AgentForm } from "./form"
import { KnowledgeBaseTab } from "./knowledge/KnowledgeBaseTab"
import { RoleSettingsTab } from "./RoleSettingsTab"
import { SkillConfigTab } from "./SkillConfigTab"
import "./agent-config.css"

const TABS = ["basic", "role", "skills", "knowledge"] as const
type ConfigTab = (typeof TABS)[number] | "evaluation"

export interface AgentConfigHandle {
  /** 校验并保存；成功返回保存后的智能体，失败返回 undefined（提示已弹出） */
  save: () => Promise<Agent | undefined>
  dirty: () => boolean
}

interface Props {
  agent: Agent
  readonly?: boolean
  /** 页签栏右侧的操作区（详情弹窗放「编辑」，抽屉放「保存 / 提交」） */
  action?: ReactNode
  /** 页签栏下方的插槽，只在「基础信息」页签显示（详情弹窗把名称 / 状态 / 编码放这里） */
  subHeader?: ReactNode
  /** 顶部提示条（如本地修改未提交），显示在页签上方 */
  banner?: ReactNode
  onRefresh?: () => void
  onNameChange?: (name: string) => void
  onSaved?: (agent: Agent) => void
}

/**
 * 智能体配置面板：四个页签（基础信息 / 角色设定 / 技能 / 知识）。
 * 开发页的详情弹窗（只读）和会话右侧的配置抽屉（可编辑）共用它。结构对齐原工程的 AgentConfigPanel。
 */
export const AgentConfigPanel = forwardRef<AgentConfigHandle, Props>(function AgentConfigPanel(props, ref) {
  const t = useT()
  const navigate = useNavigate()
  const dialog = useDialog()
  const [confirmEvaluation, setConfirmEvaluation] = useState(false)
  const [evaluationUrl, setEvaluationUrl] = useState("")
  const openEvaluation = () => {
    dialog.close()
    navigate(evaluationUrl || `/dev/agent/${encodeURIComponent(props.agent.id)}/evaluation`)
  }
  const { sessionId: repairSessionId } = useParams()
  const repairTarget = repairSessionId ? evaluationRepairTarget(repairSessionId) : undefined
  const [tab, setTab] = useState<ConfigTab>(() => repairTarget?.objectType === "agent" && repairTarget.objectId === props.agent.id ? "evaluation" : "basic")
  const reportRequest = usePanel(s => s.evaluationReport)
  useEffect(() => {
    if (reportRequest?.objectId === `agent:${props.agent.id}`) setTab("evaluation")
  }, [reportRequest, props.agent.id])
  const [form, setForm] = useState<AgentForm>(() => formOf(props.agent))
  // 上一次落盘的内容：用来判断有没有未保存的改动、生成改动摘要
  const saved = useRef(formOf(props.agent))
  const readonly = !!props.readonly
  const [displayAttempt, setDisplayAttempt] = useState(0)
  const sections = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!displayAttempt || tab !== "basic") return
    // 等编辑器切到出错的场景页签后再定位
    const frame = window.setTimeout(() => {
    const target = sections.current?.querySelector<HTMLElement>("[data-invalid], [data-display-invalid]")
    for (let parent = target?.parentElement; parent && parent !== sections.current; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement) parent.open = true
    }
    const focus = target?.matches("input, textarea") ? target : target?.querySelector<HTMLElement>("input, button")
    focus?.focus({ preventScroll: true })
    target?.scrollIntoView({ block: "center", behavior: "instant" })
    }, 50)
    return () => window.clearTimeout(frame)
  }, [displayAttempt, tab])

  // 换了一个智能体，或外部（会话里的模型）改了它：重置表单
  useEffect(() => {
    setDisplayAttempt(0)
    saved.current = formOf(props.agent)
    setForm(formOf(props.agent))
  }, [props.agent])

  useEffect(() => props.onNameChange?.(form.name), [form.name])

  const set = (patch: Partial<AgentForm>) => setForm((prev) => ({ ...prev, ...patch }))
  const changes = () => diffChanges(saved.current, form, t)

  useImperativeHandle(ref, () => ({
    dirty: () => changes().length > 0,
    async save() {
      if (form.name.length > 200) return void showToast({ variant: "error", title: t("kcode.agentConfig.nameTooLong") })
      if (!form.name.trim() || !form.desc.trim()) return void showToast({ variant: "error", title: t("kcode.agentConfig.submitMissing") })
      if (Object.keys(displayInfoErrors(form.displayInfo)).length) {
        setTab("basic")
        setDisplayAttempt(attempt => attempt + 1)
        return void showToast({ variant: "error", title: t("proto.agentDisplay.fix") })
      }
      const normalized = { ...form, displayInfo: normalizeDisplayInfo(form.displayInfo) }
      const next = await agentService.save(props.agent.id, normalized, changes())
      if (!next) return void showToast({ variant: "error", title: t("kcode.agentConfig.saveFailed") })
      saved.current = normalized
      props.onSaved?.(next)
      return next
    },
  }))

  return (
    <div
      className="agent-config-panel flex flex-col gap-5 h-full"
      style={{ "--border-weak-base": "var(--border-agent-config)", "--input-base": "var(--input-agent-config)" } as CSSProperties}
    >
      {props.banner}
      <div
        className="light-segmented shrink-0 flex items-center justify-between"
      >
        <div className="agent-config-tab-scroll flex-1">
          <SegmentedControl value={tab} onChange={value => setTab(value as ConfigTab)} items={[...TABS.map(value => ({ value, label: t(`kcode.agentConfig.tab.${value}`) })), { value: "evaluation", label: "评测报告" }]} />
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-2">
          {props.onRefresh && <IconButton icon="refresh" variant="ghost" iconSize="small" className="h-7 w-7" title={t("session.files.refresh")} onClick={props.onRefresh} />}
          {props.action}
        </div>
      </div>
      <ControlledConfirmDialog open={confirmEvaluation} onClose={() => setConfirmEvaluation(false)}
        title="放弃修改并进入评测？" description="智能体配置有未保存的修改，继续将丢弃这些修改"
        cancelText="继续编辑" confirmText="放弃并进入评测" variant="danger" onConfirm={openEvaluation} />
      {tab === "evaluation" && <ObjectEvaluationReport objectId={`agent:${props.agent.id}`} open={url => {
        if (!readonly && changes().length) { setEvaluationUrl(url); setConfirmEvaluation(true) }
        else { dialog.close(); navigate(url) }
      }} />}
      {props.subHeader && tab === "basic" && <div className="shrink-0">{props.subHeader}</div>}
      {tab === "role" && (
        <div className="flex-1 min-h-0 pb-5">
          <RoleSettingsTab form={form} set={set} readonly={readonly} />
        </div>
      )}
      {tab === "basic" && (
        <div ref={sections} className="agent-config-sections flex-1 min-h-0 overflow-y-auto pb-5">
          <BasicInfoTab agentId={props.agent.id} form={form} set={set} readonly={readonly} displayAttempt={displayAttempt}
            history={<ChangelogSection changelog={props.agent.changelog} />} />
        </div>
      )}
      {tab === "skills" && (
        <div className="flex-1 min-h-0">
          <SkillConfigTab form={form} set={set} readonly={readonly} projectId={props.agent.projectId} />
        </div>
      )}
      {tab === "knowledge" && (
        <div className="flex-1 min-h-0">
          <KnowledgeBaseTab form={form} set={set} readonly={readonly} />
        </div>
      )}
    </div>
  )
})

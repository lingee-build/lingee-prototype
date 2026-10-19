import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { IconButton, SegmentedControl, showToast } from "@/ui"
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
type ConfigTab = (typeof TABS)[number]

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
  /** 隐藏基础信息里的头像 + 名称卡片（subHeader 已经展示过） */
  hideIdentity?: boolean
  onRefresh?: () => void
  onNameChange?: (name: string) => void
  onSaved?: (agent: Agent) => void
}

/**
 * 智能体配置面板：四个页签（基础信息 / 角色设定 / 技能配置 / 知识）。
 * 开发页的详情弹窗（只读）和会话右侧的配置抽屉（可编辑）共用它。结构对齐原工程的 AgentConfigPanel。
 */
export const AgentConfigPanel = forwardRef<AgentConfigHandle, Props>(function AgentConfigPanel(props, ref) {
  const t = useT()
  const [tab, setTab] = useState<ConfigTab>("basic")
  const [form, setForm] = useState<AgentForm>(() => formOf(props.agent))
  // 上一次落盘的内容：用来判断有没有未保存的改动、生成改动摘要
  const saved = useRef(formOf(props.agent))
  const preset = !!props.agent.preset
  const readonly = !!props.readonly

  // 换了一个智能体，或外部（会话里的模型）改了它：重置表单
  useEffect(() => {
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
      const next = await agentService.save(props.agent.id, form, changes())
      if (!next) return void showToast({ variant: "error", title: t("kcode.agentConfig.saveFailed") })
      saved.current = form
      props.onSaved?.(next)
      return next
    },
  }))

  return (
    <div
      className="agent-config-panel flex flex-col gap-5 h-full"
      style={{ "--border-weak-base": "var(--border-agent-config)", "--input-base": "var(--input-agent-config)" } as CSSProperties}
    >
      <div
        className="light-segmented shrink-0 flex items-center justify-between"
      >
        <div className="agent-config-tab-scroll flex-1">
          <SegmentedControl value={tab} onChange={(value) => setTab(value as ConfigTab)} items={TABS.map((value) => ({ value, label: t(`kcode.agentConfig.tab.${value}`) }))} />
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-2">
          {props.onRefresh && <IconButton icon="refresh" variant="ghost" iconSize="small" className="h-7 w-7" title={t("session.files.refresh")} onClick={props.onRefresh} />}
          {props.action}
        </div>
      </div>
      {props.subHeader && tab === "basic" && <div className="shrink-0">{props.subHeader}</div>}
      {tab === "role" && (
        <div className="flex-1 min-h-0 pb-5">
          <RoleSettingsTab form={form} set={set} readonly={readonly || preset} />
        </div>
      )}
      {tab === "basic" && (
        <div className="agent-config-sections flex-1 min-h-0 overflow-y-auto pb-5">
          <BasicInfoTab agentId={props.agent.id} form={form} set={set} readonly={readonly} hideIdentity={props.hideIdentity} />
          <ChangelogSection changelog={props.agent.changelog} compact={props.hideIdentity} />
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

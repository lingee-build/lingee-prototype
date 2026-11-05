import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { BrandButton, Dialog, DropdownMenu, Icon, useDialog } from "@/ui"
import { useT } from "@/i18n"
import { cx } from "@/lib/cx"
import type { Agent, Skill, SkillScope } from "@/mock/fixtures/dev"
import { agentService, consoleScopeService } from "@/services"
import { DynamicSkillIcon } from "@/features/dev-page/DynamicSkillIcon"

/**
 * 技能发布范围：「上架商城」「下发 Build」两个独立开关。
 * - Build 不存范围，展示时都从 Console 实时取；只有首次发布时由 Build 带上值。
 * - 首次发布默认：智能体可见 + 市场可见，可改。
 * - 随智能体首次发布：两个都不开，不能改。
 * - 发布后只能由企业管理员在 Console 修改。
 * - 审核锁：同一个技能同一时间只能在一个审核单里（单独提交或随某个智能体提交）。
 */
export const SCOPE_HINT_FIRST = "仅首次发布可选，后续调整请联系管理员。"
export const SCOPE_HINT_UPDATE = "仅首次发布可选，后续调整请联系管理员。"
export const SCOPE_HINT_AGENT = ""
export const SCOPE_HINT_CONSOLE = "如需调整请联系管理员。"
export const PACKAGE_SCOPE_NOTE = "不上架商城，需上架请单独提交。"

/** 首次发布 = 从未发布过。首次提交被驳回或撤回后再提交仍算首次；发布后的修改被驳回则不算 */
export const isFirstSubmission = (skill: Pick<Skill, "everPublished">) => !skill.everPublished
/** 首次发布的默认值：智能体可见 + 市场可见 */
export const defaultScopeOf = (): SkillScope => ({ mall: true, build: false })

/** 技能的本地状态：已保存（发布后本地有修改未提交）/ 审核中 / 正常 */
export type MarketLocalState = "changed" | "reviewing" | undefined
export const marketLocalState = (skill?: Pick<Skill, "changed" | "enterpriseStatus">): MarketLocalState => !skill ? undefined : skill.changed ? "changed" : skill.enterpriseStatus === "submitted" ? "reviewing" : undefined

/** 本项目里引用了这个技能的智能体（按技能 name） */
export const referencingAgents = (agents: Agent[] | undefined, skill: Pick<Skill, "name" | "projectId">, exceptId?: string) =>
  (agents ?? []).filter((agent) => agent.id !== exceptId && agent.projectId === skill.projectId && agent.skills.some((x) => x.skillName === skill.name))

/** 审核锁的说明：随哪个智能体审核中 */
export function useAuditAgentName(skill?: Pick<Skill, "auditAgentId">) {
  const agents = useQuery({ queryKey: ["agents"], queryFn: agentService.list, staleTime: 0, enabled: !!skill?.auditAgentId })
  if (!skill?.auditAgentId) return undefined
  return agents.data?.find((agent) => agent.id === skill.auditAgentId)?.name ?? "智能体"
}
export const auditLockTip = (agentName: string) => `随「${agentName}」审核中`

const InfoNote = (props: { children: React.ReactNode; tone?: "info" | "warn" }) => (
  <div className={cx("flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] leading-[18px]", props.tone === "warn" ? "bg-[var(--orange-50)] text-[var(--orange-600)]" : "bg-[rgba(73,93,255,0.06)] text-text-base")}>
    <Icon name="info-fill" size="small" className={cx("mt-[1px] size-4 shrink-0", props.tone === "warn" ? "" : "text-[#495DFF]")} />
    <span>{props.children}</span>
  </div>
)

/** 发布范围的三个取值；「智能体可见」固定勾选 */
export const SCOPE_OPTIONS: Array<{ key: "agent" | keyof SkillScope; label: string; desc: string }> = [
  { key: "agent", label: "智能体可见", desc: "智能体能调用该技能" },
  { key: "mall", label: "市场可见", desc: "上架技能市场" },
  { key: "build", label: "开发板块可见", desc: "开发板块可下载安装该技能" },
]
export const scopeLabels = (value: SkillScope) => SCOPE_OPTIONS.filter((o) => o.key === "agent" || value[o.key]).map((o) => o.label)

/** 发布范围下拉（多选）：样式对齐「默认模型等级」下拉——触发器是文字 + 箭头，每项两行，左侧多选框 */
export function ScopeChecks(props: { value: SkillScope; onChange: (value: SkillScope) => void; disabled?: boolean; readOnly?: boolean; compact?: boolean }) {
  const text = scopeLabels(props.value).join("、")
  const size = props.compact ? "text-[12px] leading-[18px]" : "text-[14px] leading-5"
  if (props.readOnly) return <div className={cx("flex h-8 items-center px-2 text-text-strong", size)}>{text}</div>
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu placement="bottom-end" gutter={4}>
        <DropdownMenu.Trigger
          disabled={props.disabled}
          className={cx(
            "flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-text-strong transition-colors duration-150 hover:bg-[var(--surface-base)] [&[data-expanded]]:bg-[var(--surface-base)] disabled:cursor-not-allowed disabled:opacity-50",
            size,
          )}
        >
          <span className="max-w-[260px] truncate">{text}</span>
          <Icon name="chevron-down-16" size="small" className="text-text-weak" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="model-level-menu" style={{ minWidth: 260, padding: 3, zIndex: 1000 }}>
            {SCOPE_OPTIONS.map((option) => {
              const fixed = option.key === "agent"
              const checked = fixed || props.value[option.key as keyof SkillScope]
              return (
                <DropdownMenu.Item
                  key={option.key}
                  onSelect={(e) => { e.preventDefault(); if (!fixed) props.onChange({ ...props.value, [option.key]: !checked }) }}
                  style={{ height: "auto", flexDirection: "column", alignItems: "stretch", gap: 2, padding: "8px 12px", borderRadius: 20, cursor: fixed ? "default" : undefined }}
                >
                  <div className="flex items-center gap-2.5">
                    <input type="checkbox" readOnly tabIndex={-1} checked={checked} disabled={fixed} className="pointer-events-none size-4 shrink-0 accent-[#495DFF]" />
                    <span className="min-w-0 flex-1 truncate text-[15px] leading-[22px] font-[500] text-text-strong">{option.label}</span>
                  </div>
                  <span className="pl-[26px] text-[12px] leading-4 text-text-weak">{option.desc}{fixed ? "，默认不可取消" : ""}</span>
                </DropdownMenu.Item>
              )
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </div>
  )
}

/** 提交技能第 1 步：选择路径（企业分发 / 个人自用） */
export function SkillSubmitPathDialog(props: { onConfirm: (route: "enterprise" | "personal") => void }) {
  const t = useT()
  const dialog = useDialog()
  const [route, setRoute] = useState<"enterprise" | "personal">("enterprise")
  const option = (value: "enterprise" | "personal", icon: "building" | "user", iconClass: string) => (
    <button
      type="button"
      onClick={() => setRoute(value)}
      className={cx(
        "w-full cursor-pointer rounded-[16px] border-2 bg-transparent px-5 py-5 text-left",
        route === value ? "border-[#495DFF]" : "border-[var(--border-weak-base)]",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cx("flex size-7 items-center justify-center rounded-[8px]", iconClass)}>
          <Icon name={icon} size="small" className="size-4" />
        </span>
        <span className="text-[16px] font-medium text-text-strong">{t(`kcode.skillSubmit.pathSelect.${value}`)}</span>
      </div>
      <div className="mt-2 text-[13px] leading-[20px] text-text-weak">{t(`kcode.skillSubmit.pathSelect.${value}Desc`)}</div>
    </button>
  )
  return (
    <Dialog title={t("kcode.skillSubmit.pathSelect.title")} fit className="w-[520px] !rounded-[24px] overflow-hidden">
      <div className="space-y-3 px-5 pb-5">
        {option("enterprise", "building", "bg-[rgba(73,93,255,0.08)] text-[#495DFF]")}
        {option("personal", "user", "bg-[var(--orange-50)] text-[var(--orange-600)]")}
        <InfoNote>{t(route === "enterprise" ? "kcode.skillSubmit.pathSelect.enterpriseHint" : "kcode.skillSubmit.pathSelect.personalHint")}</InfoNote>
        <div className="flex justify-end gap-3 pt-6">
          <BrandButton variant="auxiliary" size="normal" onClick={dialog.close}>{t("kcode.skillSubmit.pathSelect.cancel")}</BrandButton>
          <BrandButton variant="primary" size="normal" onClick={() => { dialog.close(); props.onConfirm(route) }}>{t("kcode.skillSubmit.pathSelect.submit")}</BrandButton>
        </div>
      </div>
    </Dialog>
  )
}

/** 已发布技能的当前发布范围（从 Console 取，只读），批量列表行尾用 */
export function CurrentScope(props: { name: string }) {
  const query = useQuery({ queryKey: ["consoleScope", props.name], queryFn: () => consoleScopeService.get(props.name), staleTime: 0, gcTime: 0, retry: false })
  if (query.isError) return <button type="button" className="cursor-pointer border-none bg-transparent p-0 text-[12px] text-[var(--orange-600)]" onClick={(e) => { e.preventDefault(); void query.refetch() }}>加载失败，重试</button>
  if (query.isPending) return <span className="inline-block h-3 w-20 animate-pulse rounded bg-[var(--neutral-130)]" />
  return <span title={SCOPE_HINT_UPDATE}><ScopeChecks compact readOnly value={query.data} onChange={() => undefined} /></span>
}

/** 单个技能企业分发的第 1 步「发布范围」：技能和发布范围合在一张卡片里；已发布的技能从 Console 取当前值，只读 */
export function MarketScopeStep(props: { skill: Skill; scope: SkillScope; onChange: (scope: SkillScope) => void; referencedBy?: string }) {
  const first = isFirstSubmission(props.skill)
  const current = useQuery({
    queryKey: ["consoleScope", props.skill.name],
    queryFn: () => consoleScopeService.get(props.skill.name),
    enabled: !first,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
  return (
    <div className="rounded-xl border border-[var(--border-weak-base)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <DynamicSkillIcon name={props.skill.displayName} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-text-strong">{props.skill.displayName}</div>
          <div className="text-[12px] text-text-weak">{first ? "首次发布" : "更新技能内容"}</div>
        </div>
      </div>
      <div className="mx-4 h-px bg-[var(--border-weak-base)]" />
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[14px] leading-5 text-text-strong">发布范围</span>
          <span className="text-[12px] leading-4 text-text-weak">{SCOPE_HINT_FIRST}</span>
        </div>
        {first ? (
          <ScopeChecks value={props.scope} onChange={props.onChange} />
        ) : current.isError ? (
          <button type="button" className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-[13px] text-[var(--orange-600)]" onClick={() => void current.refetch()}>加载失败，重试</button>
        ) : current.isPending ? (
          <span className="h-4 w-24 shrink-0 animate-pulse rounded bg-[var(--neutral-130)]" />
        ) : (
          <ScopeChecks value={current.data} onChange={() => undefined} readOnly />
        )}
      </div>
    </div>
  )
}

/** 「更多信息」里的发布范围两项：每次打开从 Console 取；未发布的技能不显示 */
export function ScopeInfoItems(props: { skill: Skill }) {
  const query = useQuery({
    queryKey: ["consoleScope", props.skill.name],
    queryFn: () => consoleScopeService.get(props.skill.name),
    enabled: !!props.skill.everPublished,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
  if (!props.skill.everPublished) return null
  if (query.isError)
    return (
      <li className="text-[var(--orange-600)]">
        发布范围加载失败
        <button type="button" className="ml-2 cursor-pointer border-none bg-transparent p-0 text-[14px] text-[#495DFF]" onClick={() => void query.refetch()}>重试</button>
      </li>
    )
  if (query.isPending) return <li>发布范围：加载中…</li>
  return <li className="col-span-2" title={SCOPE_HINT_CONSOLE}>发布范围：{scopeLabels(query.data).join("、")}</li>
}

/** 智能体提交前校验：引用的技能都已发布且没有未提交的修改，智能体才能提交 */
export type SkillReadiness = "ready" | "unpublished" | "changed" | "rejected" | "reviewing"
export const skillReadiness = (skill: Skill): SkillReadiness =>
  skill.enterpriseStatus === "submitted" ? "reviewing"
    : skill.enterpriseStatus === "rejected" ? "rejected"
      : !skill.everPublished ? "unpublished"
        : skill.changed ? "changed" : "ready"

const READINESS_TEXT: Record<Exclude<SkillReadiness, "ready">, { sub: string; action?: string }> = {
  unpublished: { sub: "未提交", action: "去提交" },
  changed: { sub: "有修改未提交", action: "去提交" },
  rejected: { sub: "已驳回", action: "去修改" },
  reviewing: { sub: "审核中" },
}

function SkillRow(props: { skill: Skill; sub: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border-weak-base)] px-3 py-3">
      <DynamicSkillIcon name={props.skill.displayName} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-text-strong">{props.skill.displayName}</div>
        <div className="text-[12px] leading-[18px] text-text-weak">{props.sub}</div>
      </div>
      {props.right}
    </div>
  )
}

/** 提交智能体：只提交智能体本身。引用的技能需全部已发布、无未提交修改 */
export function AgentSubmitCheckDialog(props: { agent: Agent; skills: Skill[]; onConfirm: () => void; onGoSubmit: (skill: Skill) => void }) {
  const dialog = useDialog()
  const pending = props.skills.filter((skill) => skillReadiness(skill) !== "ready")
  const ready = props.skills.filter((skill) => skillReadiness(skill) === "ready")
  return (
    <Dialog title="提交智能体审核" fit className="w-[560px] !rounded-[24px] overflow-hidden">
      <div className="space-y-4 px-5 pb-5">
        <section>
          <div className="mb-2 text-[14px] font-medium text-text-strong">智能体</div>
          <div className="rounded-xl border border-[var(--border-weak-base)] px-3 py-3 text-[14px] font-medium text-text-strong">{props.agent.name}</div>
        </section>
        <section>
          <div className="mb-2 text-[14px] font-medium text-text-strong">引用的技能 <span className="font-normal text-text-weak">{props.skills.length}</span></div>
          <div className="max-h-[360px] space-y-2 overflow-y-auto">
            {pending.map((skill) => {
              const text = READINESS_TEXT[skillReadiness(skill) as Exclude<SkillReadiness, "ready">]
              return (
                <SkillRow
                  key={skill.id}
                  skill={skill}
                  sub={<span className="text-[var(--orange-600)]">{text.sub}</span>}
                  right={text.action && <BrandButton variant="auxiliary" size="small" onClick={() => { dialog.close(); props.onGoSubmit(skill) }}>{text.action}</BrandButton>}
                />
              )
            })}
            {ready.map((skill) => <SkillRow key={skill.id} skill={skill} sub="已发布" />)}
          </div>
          {pending.length > 0 && <div className="mt-2 text-[12px] leading-[18px] text-text-weak">技能全部审核通过后才能提交智能体。</div>}
        </section>
        <div className="flex justify-end gap-3">
          <BrandButton variant="auxiliary" size="normal" onClick={dialog.close}>取消</BrandButton>
          <BrandButton variant="primary" size="normal" disabled={pending.length > 0} onClick={() => { dialog.close(); props.onConfirm() }}>确认提交</BrandButton>
        </div>
      </div>
    </Dialog>
  )
}

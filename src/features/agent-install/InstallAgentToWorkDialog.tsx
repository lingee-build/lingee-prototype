import { useEffect, useRef, useState, type ReactNode } from "react"
import { useNavigate } from "react-router"
import { BrandButton, Dialog, Icon, useDialog } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { publicUrl } from "@/lib/public-url"
import type { Agent } from "@/mock/fixtures/dev"
import { skillService } from "@/services"
import { pickAvatar } from "@/features/agent-config/form"
import { DynamicSkillIcon } from "@/features/dev-page/DynamicSkillIcon"
import { useEditSession } from "@/features/dev-page/use-edit-session"
import { GroupBlock, LIST_BOX, ProgressHeader } from "@/features/skill-batch/steps"
import { useAuth } from "@/stores/auth"
import { DEMO_TENANT, instanceKey, useWorkAgents } from "@/stores/work-agents"
import { CATEGORY_LABEL, knowledgeRefsOf, mcpRefsOf, runInstallChecks, type CheckCategory, type CheckIssue } from "./install-package"

type Phase = "confirm" | "checking" | "failed" | "submitting" | "success"
type ItemStatus = "pending" | "running" | "pass" | "fail"

/** 步骤条：确认内容 → 检测 → 提交（检测失败停在第 2 步） */
const STEPS = ["确认内容", "检测", "提交"]
const PHASE_STEP: Record<Phase, number> = { confirm: 1, checking: 2, failed: 2, submitting: 3, success: 4 }

const ITEM_MS = 260
const AGENT_ID = "__agent"

/** 检测对象：智能体配置本身 + 每个关联技能；工具存在性只针对技能（工具由技能声明） */
interface Target {
  id: string
  name: string
  kind: "agent" | "skill"
  cats: CheckCategory[]
}

const ITEM_LABEL = (target: Target, cat: CheckCategory) =>
  cat === "spec" ? (target.kind === "agent" ? "智能体配置规范" : "技能包规范（SKILL.md）") : cat === "security" ? "敏感信息与危险代码扫描" : "声明的工具在 Build 开发环境中存在"

const keyOf = (targetId: string, cat: CheckCategory) => `${targetId}:${cat}`

/**
 * 智能体「提交 → 个人自用」向导：选完路径后进入。
 * 外壳与各步形态沿用技能提交向导（BatchDialog / steps.tsx）：
 * 检测页 = 进度条 + 逐对象可展开的检测项；不通过 = 分组列表（不通过 / 通过）+ 失败原因与修复指引；
 * 提交中 = 进度条 + 逐项结果；完成 = 汇总。智能体与关联技能需全部通过才能提交，检测通过后自动提交到 Work。
 */
export function InstallAgentToWorkDialog(props: { agent: Agent }) {
  const { agent } = props
  const t = useT()
  const { close } = useDialog()
  const navigate = useNavigate()
  const editSession = useEditSession()
  const account = useAuth((s) => s.account) ?? ""
  const key = instanceKey(DEMO_TENANT.id, account, agent.id)
  const exists = useWorkAgents((s) => s.developed.some((x) => x.key === key))
  const fixed = useWorkAgents((s) => s.fixed.includes(agent.id))
  const install = useWorkAgents((s) => s.install)
  const markFixed = useWorkAgents((s) => s.markFixed)

  const targets: Target[] = [
    { id: AGENT_ID, name: agent.name, kind: "agent", cats: ["spec", "security"] },
    ...agent.skills.map((s) => ({ id: s.skillName, name: s.name, kind: "skill" as const, cats: ["spec", "security", "tool"] as CheckCategory[] })),
  ]
  const pairs = targets.flatMap((target) => target.cats.map((cat) => ({ target, cat })))

  const [phase, setPhase] = useState<Phase>("confirm")
  const [overwrite, setOverwrite] = useState(false)
  const [status, setStatus] = useState<Record<string, ItemStatus>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({})
  const [issues, setIssues] = useState<CheckIssue[]>([])
  const [progress, setProgress] = useState(0)
  /** 提交中：已完成写入的对象数 */
  const [uploaded, setUploaded] = useState(0)
  /** 开始提交时是否已有实例，用于结果文案（成功后 exists 会变成 true） */
  const wasInstalled = useRef(exists)
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const busy = phase === "checking" || phase === "submitting"
  const current = PHASE_STEP[phase]

  const issuesOf = (target: Target, cat?: CheckCategory) =>
    issues.filter((x) => (target.kind === "agent" ? !x.skillName || x.skillName === agent.name : x.skillName === target.name) && (!cat || x.category === cat))
  const targetStatus = (target: Target): ItemStatus => {
    const list = target.cats.map((cat) => status[keyOf(target.id, cat)] ?? "pending")
    if (list.includes("running")) return "running"
    if (list.includes("fail") && list.every((x) => x === "pass" || x === "fail")) return "fail"
    if (list.every((x) => x === "pass")) return "pass"
    if (list.some((x) => x !== "pending")) return "running"
    return "pending"
  }

  const cancelRun = () => {
    window.clearTimeout(timer.current)
    setPhase("confirm")
  }

  const submit = () => {
    setPhase("submitting")
    setUploaded(0)
    setProgress(0)
    const tick = (i: number) => {
      setUploaded(i)
      setProgress(Math.round((i / targets.length) * 100))
      if (i < targets.length) {
        timer.current = window.setTimeout(() => tick(i + 1), 320)
        return
      }
      install({
        tenantId: DEMO_TENANT.id,
        account,
        sourceAgentId: agent.id,
        sourceProjectId: agent.projectId,
        name: agent.name,
        desc: agent.desc,
        avatar: agent.avatar || pickAvatar(agent.id),
        skills: agent.skills.map((s) => ({ name: s.skillName, displayName: s.name, desc: s.desc })),
        // 引用关系仍随包记录（不复制资源本身），只是不在提交界面展示
        knowledgeRefs: knowledgeRefsOf(agent),
        mcpRefs: mcpRefsOf(agent),
      })
      timer.current = window.setTimeout(() => setPhase("success"), 300)
    }
    timer.current = window.setTimeout(() => tick(1), 320)
  }

  const start = async () => {
    wasInstalled.current = exists
    setPhase("checking")
    setStatus({})
    setProgress(0)
    setExpanded({ [targets[0].id]: true })
    const skills = await skillService.list()
    const found = runInstallChecks(agent, skills, fixed)
    setIssues(found)
    const failed = (target: Target, cat: CheckCategory) =>
      found.some((x) => (target.kind === "agent" ? !x.skillName || x.skillName === agent.name : x.skillName === target.name) && x.category === cat)
    const step = (i: number) => {
      if (i > 0) {
        const prev = pairs[i - 1]
        setStatus((cur) => ({ ...cur, [keyOf(prev.target.id, prev.cat)]: failed(prev.target, prev.cat) ? "fail" : "pass" }))
      }
      setProgress(Math.round((i / pairs.length) * 100))
      if (i === pairs.length) {
        timer.current = window.setTimeout(() => (found.length ? setPhase("failed") : submit()), 400)
        return
      }
      const next = pairs[i]
      setStatus((cur) => ({ ...cur, [keyOf(next.target.id, next.cat)]: "running" }))
      // 检测到哪个对象就展开哪个，和技能检测页一样跟随进度
      if (i === 0 || pairs[i - 1].target.id !== next.target.id) setExpanded((cur) => ({ ...cur, [next.target.id]: true }))
      timer.current = window.setTimeout(() => step(i + 1), ITEM_MS)
    }
    step(0)
  }

  const goFix = () => {
    markFixed(agent.id)
    const list = issues.map((x, i) => `${i + 1}. [${CATEGORY_LABEL[x.category]}]${x.skillName ? `「${x.skillName}」` : ""}${x.problem}`).join("\n")
    close()
    void editSession({
      title: `修复【${agent.name}】提交检测问题`,
      draft: `/ai-partner-creator 编辑【${agent.name}】：修复个人自用时检测出的问题：\n${list}`,
      projectId: agent.projectId,
      target: { agent: agent.id },
    })
  }

  const iconOf = (target: Target, size: number, gray?: boolean) => (
    <div className="shrink-0" style={gray ? { filter: "grayscale(.6)" } : undefined}>
      {target.kind === "agent" ? (
        <img src={publicUrl(agent.avatar || pickAvatar(agent.id))} alt="" style={{ width: size, height: size }} />
      ) : (
        <DynamicSkillIcon name={target.name} size={size} />
      )}
    </div>
  )
  const kindTag = (target: Target) => (
    <span className="shrink-0 rounded-[4px] bg-[var(--surface-base)] px-1 text-[10px] leading-4 text-text-weak">{target.kind === "agent" ? "智能体" : "技能"}</span>
  )

  const failTargets = targets.filter((x) => issuesOf(x).length > 0)
  const passTargets = targets.filter((x) => issuesOf(x).length === 0)
  const runningTarget = targets.find((x) => targetStatus(x) === "running")

  const cancelButton = (
    <BrandButton variant="auxiliary" size="normal" onClick={() => close()}>
      {t("kcode.skillDev.action.cancel")}
    </BrandButton>
  )

  return (
    <Dialog
      fit
      className="w-[560px] !self-center !rounded-[24px] overflow-hidden shadow-[0px_6px_16px_0px_rgba(0,0,0,0.12)]"
      onEscapeKeyDown={(e) => busy && e.preventDefault()}
    >
      <div className="relative flex flex-col w-full px-5 pt-5 pb-5">
        <button
          type="button"
          aria-label="关闭"
          className="absolute top-4 right-4 z-[2] size-8 flex items-center justify-center rounded-[8px] cursor-pointer border-none bg-transparent hover:bg-[var(--surface-base)] disabled:cursor-default disabled:opacity-50"
          onClick={() => close()}
          disabled={busy}
        >
          <Icon name="close" size="small" className="size-4 text-text-base" />
        </button>

        <div className="pr-8 mb-4 text-[18px] font-medium leading-[28px] text-text-strong shrink-0">提交智能体 · 个人自用</div>

        {/* 步骤条：样式与技能提交向导一致 */}
        <div className="flex items-center mb-5 shrink-0">
          {STEPS.map((label, i) => (
            <div className="contents" key={label}>
              {i > 0 && <div className={cx("flex-1 h-0.5 mx-1.5 mb-[18px] rounded-full", current > i ? "bg-[#B7C1FF]" : "bg-[rgba(0,0,0,0.08)]")} />}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className={cx(
                    "size-8 rounded-full flex items-center justify-center text-[14px]",
                    current === i + 1 && "bg-[#495DFF] text-[#fff]",
                    current > i + 1 && "bg-[color-mix(in_srgb,var(--primary-600)_10%,transparent)] text-[#495DFF]",
                    current < i + 1 && "bg-[var(--surface-base)] text-text-weak",
                  )}
                >
                  {current > i + 1 ? "✓" : i + 1}
                </div>
                <span className={cx("text-[12px] whitespace-nowrap", current === i + 1 ? "text-[#495DFF] font-medium" : "text-text-weak")}>{label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          {phase === "confirm" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 rounded-[16px] border border-[var(--border-weak-base)] px-4 py-3">
                <img src={publicUrl(agent.avatar || pickAvatar(agent.id))} alt="" className="size-10 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[14px] font-medium leading-[22px] text-text-strong">{agent.name}</span>
                  <span className="line-clamp-2 text-[12px] leading-[18px] text-text-weak">{agent.desc}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-14-medium text-text-strong">关联技能（{agent.skills.length}）</span>
                  <span className="text-12-regular text-text-weak">随智能体一起提交，不在 Work 生成独立技能</span>
                </div>
                {agent.skills.length === 0 ? (
                  <span className="text-13-regular text-text-weak">未关联技能</span>
                ) : (
                  <div className={LIST_BOX}>
                    {agent.skills.map((s) => (
                      <div key={s.id} className="flex items-center gap-2.5 border-b border-[var(--border-weak-base)] px-3.5 py-2.5 last:border-b-0">
                        <DynamicSkillIcon name={s.name} size={30} />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[13px] font-medium text-text-strong">{s.name}</span>
                          <span className="truncate text-[11px] text-text-weak">{s.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {exists && (
                <div className="flex items-start gap-2 rounded-[10px] border border-[var(--warning-300)] bg-[var(--warning-50)] px-3 py-2">
                  <Icon name="warning-circle" size="small" className="mt-0.5 shrink-0 text-[var(--warning-600)]" />
                  <div className="flex flex-col gap-1">
                    <span className="text-13-medium text-[var(--warning-700)]">Work 中已有「{agent.name}」，再次提交将覆盖原有智能体及包内技能。</span>
                    <label className="flex cursor-pointer items-center gap-1.5 text-13-regular text-text-base">
                      <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.currentTarget.checked)} />
                      我已了解，确认覆盖
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 检测中：同技能检测页——进度条 + 逐对象可展开，按类别列出检测项 */}
          {phase === "checking" && (
            <>
              <ProgressHeader label={runningTarget ? `${runningTarget.name} · 检测中…` : "检测中…"} value={progress} />
              <div className={cx(LIST_BOX, "max-h-[300px]")}>
                {targets.map((target) => {
                  const st = targetStatus(target)
                  const summary =
                    st === "running"
                      ? { text: "检测中…", color: "text-[#495DFF]" }
                      : st === "pass"
                        ? { text: "检测通过", color: "text-[#16a34a]" }
                        : st === "fail"
                          ? { text: "检测不通过", color: "text-[#dc2626]" }
                          : { text: "等待检测…", color: "text-text-weak" }
                  const open = !!expanded[target.id]
                  return (
                    <div key={target.id} className="border-b border-[var(--border-weak-base)] last:border-b-0">
                      <div
                        className="flex items-center gap-2 px-3.5 py-2 cursor-pointer select-none bg-[color-mix(in_srgb,var(--primary-600)_10%,transparent)]"
                        onClick={() => setExpanded((cur) => ({ ...cur, [target.id]: !open }))}
                      >
                        <Icon name="chevron-right" size="small" className="size-3 text-text-weak shrink-0 transition-transform" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }} />
                        {iconOf(target, 22)}
                        <span className="text-[12px] font-semibold text-text-strong truncate">{target.name}</span>
                        {kindTag(target)}
                        <span className={`text-[11px] ml-auto shrink-0 ${summary.color}`}>{summary.text}</span>
                      </div>
                      {open && (
                        <div className="px-3.5 pb-2 pt-1">
                          {target.cats.map((cat) => {
                            const s = status[keyOf(target.id, cat)] ?? "pending"
                            const reasons = s === "fail" ? issuesOf(target, cat) : []
                            return (
                              <div className="mb-1.5" key={cat}>
                                <div className="text-[11px] font-semibold text-[#6366f1] tracking-wide py-0.5">{CATEGORY_LABEL[cat]}</div>
                                <div className="flex items-start gap-2 pl-3 py-[3px]">
                                  <span className="size-[18px] flex items-center justify-center shrink-0 mt-[1px]">
                                    {s === "pending" && <span className="text-[11px] text-text-weak">○</span>}
                                    {s === "running" && <Icon name="loading" size="small" className="size-3 animate-spin text-[#495DFF]" />}
                                    {s === "pass" && <span className="text-[11px] text-[#16a34a]">✓</span>}
                                    {s === "fail" && <span className="text-[11px] text-[#dc2626]">✕</span>}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[12px] text-[var(--neutral-600)]">{ITEM_LABEL(target, cat)}</div>
                                    {reasons.map((x, i) => (
                                      <div key={i} className="text-[11px] mt-0.5 leading-snug break-all text-[#dc2626]">{x.problem}</div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* 检测不通过：同技能检查结果页——汇总句 + 分组（不通过 → 通过），失败原因按类别分行 + 修复指引 */}
          {phase === "failed" && (
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <span className="text-[13px] text-text-base shrink-0">
                共检测 {targets.length} 项，{passTargets.length} 项通过，{failTargets.length} 项不通过
              </span>
              <span className="text-[12px] text-text-weak shrink-0">
                智能体及关联技能需全部检测通过才能提交到 Work，请修复后重新提交。
                {wasInstalled.current && "Work 中原有的智能体未被覆盖，可继续使用。"}
              </span>
              <div className={cx(LIST_BOX, "max-h-[300px]")}>
                <GroupBlock title="检测不通过，无法提交" tone="fail" count={`${failTargets.length} 个`} closed={!!closedGroups.fail} onToggle={() => setClosedGroups((c) => ({ ...c, fail: !c.fail }))}>
                  {failTargets.map((target) => {
                    const list = issuesOf(target)
                    const byCat = target.cats.map((cat) => ({ cat, list: list.filter((x) => x.category === cat) })).filter((x) => x.list.length > 0)
                    return (
                      <div key={target.id} className="px-3.5 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          {iconOf(target, 30, true)}
                          <span className="text-[13px] font-medium text-text-strong truncate">{target.name}</span>
                          {kindTag(target)}
                        </div>
                        <div className="pl-[40px] flex flex-col gap-0.5">
                          {byCat.map(({ cat, list }) => (
                            <span key={cat} className="text-[11px] text-[#dc2626] leading-snug">
                              {CATEGORY_LABEL[cat]}：{list.map((x) => x.problem).join("；")}
                            </span>
                          ))}
                          <span className="text-[11px] text-text-weak leading-snug">修复指引：{list.map((x) => x.suggestion).join("；")}</span>
                        </div>
                      </div>
                    )
                  })}
                </GroupBlock>
                {passTargets.length > 0 && (
                  <GroupBlock title="检测通过" tone="neutral" count={`${passTargets.length} 个`} closed={!!closedGroups.pass} onToggle={() => setClosedGroups((c) => ({ ...c, pass: !c.pass }))}>
                    {passTargets.map((target) => (
                      <div key={target.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                        {iconOf(target, 30)}
                        <span className="text-[13px] font-medium text-text-strong truncate">{target.name}</span>
                        {kindTag(target)}
                      </div>
                    ))}
                  </GroupBlock>
                )}
              </div>
            </div>
          )}

          {/* 提交中：同技能提交中——进度条 + 逐项结果 */}
          {phase === "submitting" && (
            <>
              <ProgressHeader label={`正在提交：${agent.name}`} value={progress} />
              <div className="flex flex-col gap-2">
                {targets.map((target, i) => (
                  <Row key={target.id}>
                    {i < uploaded ? (
                      <Icon name="circle-check" size="small" className="size-4 text-[var(--success-500)] shrink-0" />
                    ) : i === uploaded ? (
                      <Icon name="loading" size="small" className="size-4 animate-spin text-[var(--primary-500)] shrink-0" />
                    ) : (
                      <span className="size-4 shrink-0" />
                    )}
                    <span className="text-[13px] text-text-strong truncate">{target.name}</span>
                    {kindTag(target)}
                  </Row>
                ))}
              </div>
            </>
          )}

          {/* 完成：同技能提交汇总 */}
          {phase === "success" && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[var(--success-50)]">
                <Icon name="circle-check" size="medium" className="size-6 text-[var(--success-500)]" />
              </div>
              <span className="text-[16px] font-medium text-text-strong">{wasInstalled.current ? "覆盖提交成功" : "提交成功"}</span>
              <span className="text-[13px] text-[var(--neutral-500)]">「{agent.name}」及 {agent.skills.length} 个关联技能已提交到 Work，可在「智能体 - 我开发的」中使用。</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 mt-auto pt-5 shrink-0">
          {phase === "confirm" && (
            <>
              {cancelButton}
              <BrandButton variant="primary" size="normal" disabled={exists && !overwrite} onClick={() => void start()}>
                {exists ? "覆盖并提交" : "下一步"}
              </BrandButton>
            </>
          )}
          {busy && (
            <>
              <BrandButton variant="auxiliary" size="normal" onClick={cancelRun} disabled={phase === "submitting"}>
                {t("kcode.skillDev.action.cancel")}
              </BrandButton>
              <BrandButton variant="primary" size="normal" disabled>
                {phase === "checking" ? "检测中…" : t("kcode.skillDev.batch.dialog.uploading")}
              </BrandButton>
            </>
          )}
          {phase === "failed" && (
            <>
              {cancelButton}
              <BrandButton variant="auxiliary" size="normal" onClick={goFix} className="!border-[#fca5a5] !text-[#dc2626]">
                {t("kcode.skillDev.batch.dialog.goFix")}
              </BrandButton>
            </>
          )}
          {phase === "success" && (
            <>
              <BrandButton variant="auxiliary" size="normal" onClick={() => close()}>
                {t("kcode.skillDev.batch.dialog.close")}
              </BrandButton>
              <BrandButton
                variant="primary"
                size="normal"
                onClick={() => {
                  close()
                  navigate("/work/agent?tab=developed")
                }}
              >
                前往 Work
              </BrandButton>
            </>
          )}
        </div>
      </div>
    </Dialog>
  )
}

function Row(props: { children: ReactNode }) {
  return <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[var(--neutral-50)]">{props.children}</div>
}

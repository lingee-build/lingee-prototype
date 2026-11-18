import { showToast } from "@/ui"
import { useRef, useState } from "react"
import type { Skill } from "@/mock/fixtures/dev"
import { CHECK_ORDER, emptyCheckItems, presetCheckResults, type CheckItemKey, type CheckResult } from "@/mock/fixtures/skill-check"
import { n3KindOf } from "@/features/skill-batch/fix-prompt"
import { sleep } from "@/mock/latency"

export type BatchMode = "submit" | "check" | "delete"
export type BatchRoute = "enterprise" | "personal"
export type Phase = "select" | "deleteConfirm" | "checking" | "decision" | "uploading" | "summary"

export interface BatchItem {
  skill: Skill
  selected: boolean
  status: "pending" | "running" | "pass" | "fail"
  expanded: boolean
  checkItems: Record<CheckItemKey, CheckResult>
  /** 汇总后的不通过原因；空数组表示通过 */
  reasons: string[]
  message?: string
}

export const BATCH_MAX = 20

/**
 * 批量操作向导的状态机：选择 → 检查 → 决策 → 提交 → 汇总（删除走 确认 → 汇总）。
 * 检查和提交都是 mock：按预置结果逐项推进，用定时器模拟耗时。
 * 独立检查不含资源存在性（分工见 US-2026-060940）；提交模式进入确认页时模拟 Console 实时检查，缺失项拦下列入不通过组。
 * 提交不再按「无变化」置灰（重复提交的责任交还用户，一致性由确认页一致组与通道状态行提示）。
 */
export function useBatchRun(options: { mode: BatchMode; route: BatchRoute; skills: Skill[]; skipSelect: boolean }) {
  const { mode, route } = options
  const [phase, setPhase] = useState<Phase>(mode === "delete" ? "deleteConfirm" : "select")
  const [progress, setProgress] = useState(0)
  const [items, setItems] = useState<BatchItem[]>(() =>
    options.skills.map((skill) => ({ skill, selected: true, status: "pending", expanded: true, checkItems: emptyCheckItems(), reasons: [] })),
  )
  /** 确认页（decision）的逐技能勾选；null = 未动过，默认通过项全选 */
  const [confirmSel, setConfirmSel] = useState<Set<string> | null>(null)
  const cancelled = useRef(false)
  const patch = (id: string, change: Partial<BatchItem> | ((item: BatchItem) => Partial<BatchItem>)) =>
    setItems((all) => all.map((x) => (x.skill.id === id ? { ...x, ...(typeof change === "function" ? change(x) : change) } : x)))

  const scoped = items.filter((x) => x.selected)
  const passItems = scoped.filter((x) => x.reasons.length === 0)
  const failItems = scoped.filter((x) => x.reasons.length > 0)
  const confirmSet = confirmSel ?? new Set(passItems.map((x) => x.skill.id))

  const runCheck = async () => {
    cancelled.current = false
    setPhase("checking")
    setProgress(0)
    const targets = items.filter((x) => x.selected)
    const presetOf = (id: string, key: CheckItemKey) => presetCheckResults[id]?.[key] ?? { status: "pass" as const }
    const total = targets.length * CHECK_ORDER.length
    let done = 0
    for (const target of targets) {
      const id = target.skill.id
      patch(id, { status: "running", checkItems: emptyCheckItems(), reasons: [] })
      const reasons: string[] = []
      for (const key of CHECK_ORDER) {
        if (cancelled.current) return
        patch(id, (x) => ({ checkItems: { ...x.checkItems, [key]: { status: "running" } } }))
        await sleep(90 + Math.random() * 120)
        const result = presetOf(id, key)
        if (result.status === "fail") reasons.push(result.reason ?? key)
        patch(id, (x) => ({ checkItems: { ...x.checkItems, [key]: result } }))
        setProgress(Math.round((++done / total) * 100))
      }
      // 检查不通过的技能默认展开，通过的收起，方便一眼看到问题
      patch(id, { status: reasons.length > 0 ? "fail" : "pass", reasons, expanded: reasons.length > 0 })
    }
    await sleep(300)
    if (cancelled.current) return
    // 提交模式：模拟提交时 Console 实时检查资源存在性，缺失项拦下列入不通过组（去修复 / 上传只走通过项）
    if (mode === "submit") {
      for (const target of targets) {
        const skill = target.skill
        const result = skill.n3Resolved
          ? { status: "pass" as const }
          : (presetCheckResults[skill.id]?.N3 ?? { status: "pass" as const })
        // 个人自用通道的目标环境含个人源（PRD 需求项 5）：个人源工具直接可用，不报不通过
        if (route === "personal" && result.status === "fail" && n3KindOf(result) === "personal") continue
        if (result.status === "fail") {
          patch(skill.id, (x) => ({
            status: "fail",
            reasons: [...x.reasons, `资源检查：${result.reason ?? "引用资源缺失"}`],
            checkItems: { ...x.checkItems, N3: result },
          }))
        }
      }
    }
    setPhase("decision")
  }

  const runUpload = async (onDone: (succeeded: Skill[]) => void) => {
    cancelled.current = false
    setPhase("uploading")
    setProgress(0)
    // 只提交确认页勾选且检查通过的技能
    const targets = items.filter((x) => x.selected && x.reasons.length === 0 && confirmSet.has(x.skill.id))
    setItems((all) => all.map((x) => (targets.includes(x) ? { ...x, status: "pending" } : x)))
    for (const [index, target] of targets.entries()) {
      if (cancelled.current) return
      patch(target.skill.id, { status: "running" })
      await sleep(600 + Math.random() * 400)
      patch(target.skill.id, { status: "pass" })
      setProgress(Math.round(((index + 1) / targets.length) * 100))
    }
    onDone(targets.map((x) => x.skill))
    setPhase("summary")
  }

  const runDelete = async (onDone: (deleted: Skill[]) => void | Promise<void>) => {
    const targets = items.filter((x) => x.selected)
    setPhase("uploading")
    setProgress(0)
    try {
      await onDone(targets.map(x => x.skill))
      targets.forEach(target => patch(target.skill.id, { status: "pass" }))
      setProgress(100)
      setPhase("summary")
    } catch (error) {
      setPhase("deleteConfirm")
      showToast({ variant: "error", title: "删除失败", description: error instanceof Error ? error.message : "请恢复存储后重试" })
    }
  }

  return {
    phase,
    progress,
    items,
    scoped,
    passItems,
    failItems,
    selectedCount: items.filter((x) => x.selected).length,
    /** 确认页当前勾选集合（默认通过项全选） */
    confirmSet,
    confirmCount: passItems.filter((x) => confirmSet.has(x.skill.id)).length,
    toggleConfirm: (id: string) => {
      const next = new Set(confirmSet)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setConfirmSel(next)
    },
    running: scoped.find((x) => x.status === "running"),
    toggleSelect: (id: string, selected: boolean) => patch(id, { selected }),
    toggleExpanded: (id: string) => patch(id, (x) => ({ expanded: !x.expanded })),
    runCheck,
    runUpload,
    runDelete,
    /** 取消进行中的检查 / 提交，回到选择步 */
    cancel() {
      cancelled.current = true
      setConfirmSel(null)
      setItems((all) => all.map((x) => ({ ...x, status: "pending", reasons: [], checkItems: emptyCheckItems() })))
      setPhase("select")
    },
  }
}

export type BatchRun = ReturnType<typeof useBatchRun>

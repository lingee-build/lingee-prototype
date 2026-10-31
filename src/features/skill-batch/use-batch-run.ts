import { showToast } from "@/ui"
import { useRef, useState } from "react"
import type { Skill } from "@/mock/fixtures/dev"
import { CHECK_ORDER, emptyCheckItems, presetCheckResults, type CheckItemKey, type CheckResult } from "@/mock/fixtures/skill-check"
import { sleep } from "@/mock/latency"

export type BatchMode = "submit" | "check" | "delete"
export type BatchRoute = "enterprise" | "personal"
export type Phase = "select" | "deleteConfirm" | "checking" | "resource" | "decision" | "uploading" | "summary"

export interface BatchItem {
  skill: Skill
  selected: boolean
  /** 没有需要提交的改动时给出原因，这类技能在选择步置灰不可选 */
  skipReason?: string
  status: "pending" | "running" | "pass" | "fail"
  expanded: boolean
  checkItems: Record<CheckItemKey, CheckResult>
  /** 汇总后的不通过原因；空数组表示通过 */
  reasons: string[]
  message?: string
}

export const BATCH_MAX = 20

const skipReasonOf = (skill: Skill, mode: BatchMode, route: BatchRoute) => {
  if (mode !== "submit" || skill.changed) return undefined
  if (route === "personal") return skill.personalInstalled ? "unchanged" : undefined
  return skill.enterpriseStatus === "submitted" || skill.enterpriseStatus === "published" ? "unchanged" : undefined
}

/**
 * 批量操作向导的状态机：选择 → 检查 → 资源更新 → 决策 → 提交 → 汇总（删除走 确认 → 汇总）。
 * 检查和提交都是 mock：按预置结果逐项推进，用定时器模拟耗时。
 */
export function useBatchRun(options: { mode: BatchMode; route: BatchRoute; skills: Skill[]; skipSelect: boolean }) {
  const { mode, route } = options
  const [phase, setPhase] = useState<Phase>(mode === "delete" ? "deleteConfirm" : "select")
  const [progress, setProgress] = useState(0)
  const [items, setItems] = useState<BatchItem[]>(() =>
    options.skills.map((skill) => {
      const skipReason = skipReasonOf(skill, mode, route)
      return { skill, skipReason, selected: !skipReason, status: "pending", expanded: true, checkItems: emptyCheckItems(), reasons: [] }
    }),
  )
  const cancelled = useRef(false)
  const patch = (id: string, change: Partial<BatchItem> | ((item: BatchItem) => Partial<BatchItem>)) =>
    setItems((all) => all.map((x) => (x.skill.id === id ? { ...x, ...(typeof change === "function" ? change(x) : change) } : x)))

  const scoped = items.filter((x) => x.selected && !x.skipReason)
  const passItems = scoped.filter((x) => x.reasons.length === 0)
  const failItems = scoped.filter((x) => x.reasons.length > 0)

  const runCheck = async () => {
    cancelled.current = false
    setPhase("checking")
    setProgress(0)
    const targets = items.filter((x) => x.selected && !x.skipReason)
    const total = targets.length * CHECK_ORDER.length
    let done = 0
    let needResource = false
    for (const target of targets) {
      const id = target.skill.id
      patch(id, { status: "running", checkItems: emptyCheckItems(), reasons: [] })
      const reasons: string[] = []
      for (const key of CHECK_ORDER) {
        if (cancelled.current) return
        patch(id, (x) => ({ checkItems: { ...x.checkItems, [key]: { status: "running" } } }))
        await sleep(90 + Math.random() * 120)
        const result = presetCheckResults[id]?.[key] ?? { status: "pass" }
        if (result.status === "fail") reasons.push(result.reason ?? key)
        if (key === "N3" && result.status === "fail") needResource = true
        patch(id, (x) => ({ checkItems: { ...x.checkItems, [key]: result } }))
        setProgress(Math.round((++done / total) * 100))
      }
      // 检查不通过的技能默认展开，通过的收起，方便一眼看到问题
      patch(id, { status: reasons.length > 0 ? "fail" : "pass", reasons, expanded: reasons.length > 0 })
    }
    await sleep(300)
    if (cancelled.current) return
    // 只有缺资源时才真正停在「资源更新」这一步
    if (needResource) {
      setPhase("resource")
      setProgress(0)
      for (const step of [30, 65, 100]) {
        await sleep(450)
        if (cancelled.current) return
        setProgress(step)
      }
    }
    setPhase("decision")
  }

  const runUpload = async (onDone: (succeeded: Skill[]) => void) => {
    cancelled.current = false
    setPhase("uploading")
    setProgress(0)
    const targets = items.filter((x) => x.selected && !x.skipReason && x.reasons.length === 0)
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
    selectedCount: items.filter((x) => x.selected && !x.skipReason).length,
    disabledCount: items.filter((x) => x.skipReason).length,
    running: scoped.find((x) => x.status === "running"),
    toggleSelect: (id: string, selected: boolean) => patch(id, { selected }),
    toggleExpanded: (id: string) => patch(id, (x) => ({ expanded: !x.expanded })),
    runCheck,
    runUpload,
    runDelete,
    /** 取消进行中的检查 / 提交，回到选择步 */
    cancel() {
      cancelled.current = true
      setItems((all) => all.map((x) => ({ ...x, status: "pending", reasons: [], checkItems: emptyCheckItems() })))
      setPhase("select")
    },
  }
}

export type BatchRun = ReturnType<typeof useBatchRun>

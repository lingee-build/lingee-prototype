import { useEffect, useState } from "react"
import { Button } from "@/ui"
import { type EvalRun } from "@/services/evaluation"
import { pointsScopeNote, pointsSourceText, pointsText, refreshRunPoints, resumeRunPoints, runPoints } from "@/services/evaluation-points"

const demonstrations = [["pending", "统计中"], ["unavailable", "查询失败"], ["exhausted", "查询重试结束"]] as const
type Demonstration = "normal" | typeof demonstrations[number][0]

export function RunPointsSummary({ objectId, run }: { objectId: string; run: EvalRun }) {
  const [demonstration, setDemonstration] = useState<Demonstration>("normal")
  const loading = run.pointsQuery?.status === "loading"

  useEffect(() => () => resumeRunPoints(objectId, run.id), [objectId, run.id])

  function simulate(mode: Demonstration) {
    if (loading) return
    setDemonstration(mode)
    if (mode === "normal") resumeRunPoints(objectId, run.id)
    void refreshRunPoints(objectId, run.id, mode)
  }

  return <div className="eval-run-points">
    <p className="eval-muted eval-run-points-value" aria-live="polite" aria-atomic="true">本次运行 · {pointsText(runPoints(run))}{pointsSourceText(run) && ` · ${pointsSourceText(run)}`}</p>
    <details className="eval-points-demo" aria-label="点数状态演示">
      <summary>点数状态演示<span className="eval-beta">仅原型</span></summary>
      <div className="eval-actions eval-points-demo-actions">
        {demonstrations.map(([mode, label]) => <Button key={mode} size="small" disabled={loading} aria-pressed={demonstration === mode} onClick={() => simulate(mode)}>模拟{label}</Button>)}
        <Button size="small" variant="text" disabled={loading || demonstration === "normal"} onClick={() => simulate("normal")}>恢复自动更新</Button>
      </div>
      <p className="eval-muted" role="status">{demonstration === "normal"
        ? "选择一种状态，直接查看上方消耗点数的变化。"
        : `${loading ? "正在切换到" : "当前演示："}${demonstrations.find(([mode]) => mode === demonstration)?.[1]}。演示状态会保持，点击“恢复自动更新”退出。`}</p>
    </details>
    <p className="eval-muted eval-points-scope">{pointsScopeNote}</p>
  </div>
}

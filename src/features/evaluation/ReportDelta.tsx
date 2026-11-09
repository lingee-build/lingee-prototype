import type { EvalRun } from "@/services/evaluation"
import { caseVersionChanged, modelsDiffer, previousRunIn, runDiff, runLabelText, runPassRate } from "@/services/evaluation-comparison"

/**
 * 报告卡上的两块对比信息：与对比范围内更早的最近一份（vs上一版）/ 与基线版本。
 * 未完成报告不参与通过率对比。
 */
export function ReportDelta({ run, pool, baselineId, baselineRun }: { run: EvalRun; pool: EvalRun[]; baselineId?: string; baselineRun?: EvalRun }) {
  if (run.status !== "completed") {
    return <div className="eval-dp"><span className="eval-dp-label">vs上一版</span><div className="eval-dp-value eval-dp-flat">未完成，不参与通过率对比</div></div>
  }
  const rate = runPassRate(run) ?? 0
  return <>
    <PreviousDelta run={run} pool={pool} rate={rate} />
    <BaselineDelta run={run} baselineId={baselineId} baselineRun={baselineRun} rate={rate} />
  </>
}

function PreviousDelta({ run, pool, rate }: { run: EvalRun; pool: EvalRun[]; rate: number }) {
  if (!pool.length) {
    return <div className="eval-dp"><span className="eval-dp-label">vs上一版</span><div className="eval-dp-value eval-dp-flat">未选择报告</div></div>
  }
  const previous = previousRunIn(pool, run)
  if (!previous) {
    const onlySelf = pool.length === 1 && pool[0].id === run.id
    return <div className="eval-dp"><span className="eval-dp-label">vs上一版</span><div className="eval-dp-value eval-dp-flat">{onlySelf ? "所选范围内只有本报告" : "所选范围内没有更早的报告"}</div></div>
  }
  const previousRate = runPassRate(previous) ?? 0
  const { newFailed, fixed, degraded } = runDiff(run, previous)
  return <DeltaLine
    label={<>vs上一版 {runLabelText(previous)}{caseVersionChanged(run, previous) && <span className="eval-upd" title="对比报告用的是另一版用例集，通过率变化包含用例变更的影响">用例更新</span>}{modelsDiffer(run, previous) && <span className="eval-upd eval-upd-warn" title="模型不同：结论变化可能来自模型而不是被测对象">模型不同</span>}</>}
    delta={rate - previousRate} from={previousRate} to={rate}
    parts={[newFailed ? `新增失败 ${newFailed}` : "", fixed ? `已修复 ${fixed}` : "", degraded ? `退化为无法判定 ${degraded}` : ""]}
  />
}

function BaselineDelta({ run, baselineId, baselineRun, rate }: { run: EvalRun; baselineId?: string; baselineRun?: EvalRun; rate: number }) {
  if (!baselineId) {
    return <div className="eval-dp"><span className="eval-dp-label">基线</span><div className="eval-dp-value eval-dp-flat">未设置基线版本</div></div>
  }
  if (baselineId === run.id) {
    return <div className="eval-dp"><span className="eval-dp-label">基线</span><div className="eval-dp-value eval-dp-flat">当前基线版本，其他报告与它对比</div></div>
  }
  if (!baselineRun) {
    return <div className="eval-dp"><span className="eval-dp-label">基线</span><div className="eval-dp-value eval-dp-flat">基线报告不可用</div></div>
  }
  const baselineRate = runPassRate(baselineRun) ?? 0
  return <DeltaLine
    label={<>vs 基线 {runLabelText(baselineRun)}{caseVersionChanged(run, baselineRun) && <span className="eval-upd" title="对比报告用的是另一版用例集，通过率变化包含用例变更的影响">用例更新</span>}</>}
    delta={rate - baselineRate} from={baselineRate} to={rate} parts={[]}
  />
}

function DeltaLine({ label, delta, from, to, parts }: { label: React.ReactNode; delta: number; from: number; to: number; parts: string[] }) {
  const notes = parts.filter(Boolean)
  notes.push(`${from}% → ${to}%`)
  return (
    <div className="eval-dp">
      <span className="eval-dp-label">{label}</span>
      <div className="eval-dp-value">
        <span className="eval-delta" data-direction={delta > 0 ? "up" : delta < 0 ? "down" : "flat"}>
          {delta > 0 ? "↑ +" : delta < 0 ? "↓ " : "± "}{Math.abs(delta)}pp
        </span>
        <small> · {notes.join(" · ")}</small>
      </div>
    </div>
  )
}

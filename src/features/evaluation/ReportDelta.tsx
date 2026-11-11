import type { EvalRun } from "@/services/evaluation"
import { caseVersionChanged, previousRunIn, runCodeLabel, runPassRate } from "@/services/evaluation-comparison"

/**
 * 报告卡上的两块对比信息（并列两行）：vs上一版（时间最近的前一份已完成报告）/ vs 基线。
 * 未完成报告不参与对比，两块同样展示，说明为「未完成，不参与对比」。
 * 本次没有「模型更新」判断逻辑，仅保留「用例集更新」提示。
 */
export function ReportDelta({ run, pool, baselineId, baselineRun }: { run: EvalRun; pool: EvalRun[]; baselineId?: string; baselineRun?: EvalRun }) {
  if (run.status !== "completed") {
    return <>
      <div className="eval-dp"><span className="eval-dp-label">vs上一版</span><div className="eval-dp-value eval-dp-flat">未完成，不参与对比</div></div>
      <div className="eval-dp"><span className="eval-dp-label">vs 基线{baselineRun ? ` ${runCodeLabel(baselineRun)}` : ""}</span><div className="eval-dp-value eval-dp-flat">{baselineRun ? "未完成，不参与对比" : "未设置基线版本"}</div></div>
    </>
  }
  const rate = runPassRate(run) ?? 0
  return <>
    <PreviousDelta run={run} pool={pool} rate={rate} />
    <BaselineDelta run={run} baselineId={baselineId} baselineRun={baselineRun} rate={rate} />
  </>
}

function PreviousDelta({ run, pool, rate }: { run: EvalRun; pool: EvalRun[]; rate: number }) {
  const previous = previousRunIn(pool, run)
  if (!previous) {
    return <div className="eval-dp"><span className="eval-dp-label">vs上一版</span><div className="eval-dp-value eval-dp-flat">没有更早的已完成报告</div></div>
  }
  const previousRate = runPassRate(previous) ?? 0
  return <DeltaLine
    label={<>vs上一版 {runCodeLabel(previous)}{caseVersionChanged(run, previous) && <span className="eval-upd" title="对比报告用的是另一版用例集，通过率变化包含用例变更的影响">用例更新</span>}</>}
    delta={rate - previousRate}
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
    label={<>vs 基线 {runCodeLabel(baselineRun)}{caseVersionChanged(run, baselineRun) && <span className="eval-upd" title="对比报告用的是另一版用例集，通过率变化包含用例变更的影响">用例更新</span>}</>}
    delta={rate - baselineRate}
  />
}

function DeltaLine({ label, delta }: { label: React.ReactNode; delta: number }) {
  return (
    <div className="eval-dp">
      <span className="eval-dp-label">{label}</span>
      <div className="eval-dp-value">
        <span className="eval-delta" data-direction={delta > 0 ? "up" : delta < 0 ? "down" : "flat"}>
          {delta > 0 ? "↑ +" : delta < 0 ? "↓ " : "± "}{Math.abs(delta)}pp
        </span>
      </div>
    </div>
  )
}

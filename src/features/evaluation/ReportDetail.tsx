import { useState, type ReactNode } from "react"
import { caseVersionLabel, environmentLabel, isActiveRun, verdictLabel, type EvalResult, type EvalRun } from "@/services/evaluation"
import { runStats } from "@/services/evaluation-comparison"
import { reportBriefOf, reportIssuesOf } from "./report-summary"
import { CaseRunPanel } from "./CaseRunPanel"

const statusText: Record<EvalRun["status"], string> = {
  running: "进行中", judging: "判定中", stopping: "停止处理中", stop_unconfirmed: "停止确认中",
  completed: "已完成", cancelled: "已停止", error: "异常中止",
}
const resultIcon = { pass: "✓", fail: "✕", unk: "–" } as const
const resultText = { pass: "已通过", fail: "未通过", unk: "无法判定" } as const
const resultKind = (result: EvalResult) => verdictLabel(result) === "通过" ? "pass" : verdictLabel(result) === "不通过" ? "fail" : verdictLabel(result) === "无法判定" ? "unk" : null

function checkTotals(result: EvalResult) {
  const all = [...(result.roundResults || []).flatMap(turn => turn.checkResults || []), ...(result.checkResults || [])]
  return { total: all.length, failed: all.filter(check => check.verdict === "failed").length, unknown: all.filter(check => check.verdict === "unknown").length }
}

/** 报告详情：标题（含状态徽章）/操作行 + 进度摘要 + 总结/意见 + 问题清单/用例结果/报告信息三个页签，结构与设计稿一致。 */
export function ReportDetail({ run, baselineId, baselineRun, onCaseAction, actions, title, initialCaseId }: {
  run: EvalRun
  baselineId?: string
  baselineRun?: EvalRun
  onCaseAction?: (action: "rerun" | "edit", caseId: string) => void
  actions?: ReactNode
  title?: ReactNode
  initialCaseId?: string
}) {
  const [tab, setTab] = useState<"issues" | "cases" | "info">("issues")
  const [caseFilter, setCaseFilter] = useState<"all" | "pass" | "fail" | "unk">("all")
  const [activeCaseId, setActiveCaseId] = useState<string | null>(initialCaseId || null)
  const [openIssues, setOpenIssues] = useState<Record<number, boolean>>({})
  const [logOpen, setLogOpen] = useState(false)
  const stats = runStats(run)
  const total = stats.total
  const done = run.status === "completed"
  const rate = stats.executed ? Math.round(stats.passed / stats.executed * 100) : undefined
  const denom = done ? Math.max(stats.executed, 1) : total
  const seg = (count: number) => `${(count / denom * 100).toFixed(2)}%`
  const brief = reportBriefOf(run)
  const issues = reportIssuesOf(run)
  const executed = run.results.filter(result => resultKind(result))
  const active = run.results.find(result => isActiveRun(run) && (["pending", "running"].includes(result.status) || result.judging))
  const modelsText = run.models ? (run.models.execution?.id === run.models.judging?.id
    ? `执行/评测 ${run.models.execution?.name || "未记录"}`
    : `执行 ${run.models.execution?.name || "未记录"} · 评测 ${run.models.judging?.name || "未记录"}`) : "模型未记录"
  const durationText = run.ended ? `${Math.max(1, Math.round((run.ended - run.started) / 100) / 10)}s` : "—"
  const snapshotTime = new Date(run.started).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
  const filterMatch = (result: EvalResult) => caseFilter === "all" || resultKind(result) === caseFilter
  const caseList = executed.filter(filterMatch)
  const selected = run.results.find(result => result.id === (activeCaseId ?? caseList[0]?.id)) ?? caseList[0]
  const baselineText = !done ? "未完成，不参与对比"
    : run.id === baselineId ? "当前基线版本"
    : baselineRun ? `对比基线：${baselineRun.code || baselineRun.id}` : "未选择基线版本"

  return <div className="eval-rd">
    {(title || actions) && <div className="eval-rd-actions">
      {title && <span className="eval-rd-titlerow"><span className="eval-rd-title" title={typeof title === "string" ? title : undefined}>{title}</span><span className="eval-rd-rstat" data-s={run.status}>{statusText[run.status]}</span></span>}
      {actions}
    </div>}

    <div className="eval-rd-summary">
      <div className="eval-rd-sbrow">
        <span className="eval-rd-rate">{done && rate !== undefined ? `${rate}%` : `已执行 ${stats.executed}/${total}`}<small> {done && rate !== undefined ? "通过率" : "进度"}</small></span>
        <div className="eval-rd-segbar" role="img" aria-label={`通过 ${stats.passed} · 未通过 ${stats.failed} · 无法判定 ${stats.unknown} · 未执行 ${total - stats.executed}`}>
          <div className="eval-rd-seg pass" style={{ width: seg(stats.passed) }} />
          <div className="eval-rd-seg fail" style={{ width: seg(stats.failed) }} />
          <div className="eval-rd-seg unk" style={{ width: seg(stats.unknown) }} />
        </div>
        {done && stats.executed < total && <span className="eval-rd-flag">部分案例</span>}
      </div>
      {done && stats.executed < total && <p className="eval-rd-note">本次执行 {stats.executed}/{total} 条用例</p>}
      {!done && <p className="eval-rd-note">结果不完整，不参与通过率对比{run.stopReason ? ` · 中断原因：${run.stopReason}` : ""}</p>}
      <div className="eval-rd-snap">
        <span>用例集 {caseVersionLabel(run)}（共 {total} 条） · {modelsText} · 快照于 {snapshotTime} · </span>
        <button type="button" className="eval-rd-snaplink" onClick={() => setTab("info")}>查看完整快照 ›</button>
      </div>
    </div>

    <div className="eval-rd-brief">
      <div className="eval-rd-brow sum"><span className="eval-rd-bk">总结</span><span className="eval-rd-bt">{brief.summary}</span></div>
      <div className="eval-rd-brow op"><span className="eval-rd-bk">意见</span><span className="eval-rd-bt">{brief.advice}</span></div>
    </div>

    <div className="eval-rd-tabs" role="tablist" aria-label="报告详情页签">
      {([["issues", "问题清单", issues.length ? ` · ${issues.length}` : ""], ["cases", "用例结果", ` · ${stats.executed}${done ? "" : `/${total}`}`], ["info", "报告信息", ""]] as const).map(([value, label, suffix]) =>
        <button key={value} type="button" role="tab" aria-selected={tab === value} className="eval-rd-tab" data-on={tab === value || undefined} onClick={() => setTab(value)}>{label}{suffix}</button>)}
    </div>

    {tab === "issues" && <div className="eval-rd-pane">
      {!done && <p className="eval-rd-warn">报告未完成，以下问题仅基于已执行的 {stats.executed} 条用例</p>}
      {issues.length ? issues.map((issue, index) => {
        const open = openIssues[index] ?? index === 0
        return <div className="eval-rd-issue" key={index} data-open={open || undefined}>
          <button type="button" className="eval-rd-issue-h" aria-expanded={open} onClick={() => setOpenIssues(prev => ({ ...prev, [index]: !open }))}>
            <span className="eval-rd-sev" data-sev={issue.sev}>{issue.sev === "block" ? "阻断" : "提醒"}</span>
            <b>{issue.title}</b>
            <span className="eval-rd-issue-count">{issue.cases.length} 条用例</span>
            <span className="eval-rd-arr" aria-hidden="true">▾</span>
          </button>
          {open && <div className="eval-rd-issue-b">
            <span className="eval-rd-k">现象</span><span>{issue.symptom}</span>
            <span className="eval-rd-k">推断原因</span><span>{issue.cause}<span className="eval-rd-ai">（AI 推断）</span></span>
            <span className="eval-rd-k">修复建议</span><span>{issue.fix}</span>
            <span className="eval-rd-k">来源用例</span>
            <span className="eval-rd-srcs">{issue.cases.map(item => <button key={item.id} type="button" className="eval-rd-src" onClick={() => { setActiveCaseId(item.id); setCaseFilter("all"); setTab("cases") }}>{item.code || ""} {item.name} ›</button>)}</span>
          </div>}
        </div>
      }) : <div className="eval-rd-empty"><b>没有聚合出问题</b>{done ? "全部用例通过" : `已执行的 ${stats.executed} 条用例未聚合出问题，其余 ${total - stats.executed} 条未执行`}</div>}
    </div>}

    {tab === "cases" && <div className="eval-rd-pane">
      <div className="eval-rd-cf" role="group" aria-label="用例结果筛选">
        {([["all", "全部", executed.length], ["fail", "未通过", executed.filter(r => resultKind(r) === "fail").length], ["unk", "无法判定", executed.filter(r => resultKind(r) === "unk").length], ["pass", "已通过", executed.filter(r => resultKind(r) === "pass").length]] as const).map(([value, label, count]) =>
          <button key={value} type="button" className="eval-rd-cfchip" data-on={caseFilter === value || undefined} onClick={() => { setCaseFilter(value); setActiveCaseId(null) }}>{label} {count}</button>)}
      </div>
      {!done && <p className="eval-rd-note">其余 {total - stats.executed} 条未执行（{statusText[run.status]}），不参与结果判定</p>}
      <div className="eval-rd-casewrap">
        <div className="eval-rd-caselist">
          {caseList.map(result => {
            const kind = resultKind(result)!
            const totals = checkTotals(result)
            return <button type="button" key={result.id} className="eval-rd-citem" data-on={selected?.id === result.id || undefined} onClick={() => setActiveCaseId(result.id)}>
              <span className="eval-rd-ci1"><b>{result.code || "—"}</b><span className="eval-rd-cnm">{result.name}</span><span className="eval-rd-cist" data-kind={kind}>{resultIcon[kind]}</span></span>
              <span className="eval-rd-ci2">{(result.roundResults || []).length} 轮 · {totals.total} 项校验
                {totals.failed ? ` · ${totals.failed} 未通过` : ""}{totals.unknown ? ` · ${totals.unknown} 未判定` : ""}
              </span>
            </button>
          })}
          {!caseList.length && <div className="eval-rd-empty"><b>该筛选下没有用例</b></div>}
        </div>
        <div className="eval-rd-casepanel">
          {selected ? <>
            <div className="eval-rd-crhead">
              <span className="eval-rd-cid">{selected.code || ""}</span><span className="eval-rd-cnm2">{selected.name}</span>
              {selected.code && <span className="eval-rd-cst" data-kind={resultKind(selected)}>{resultKind(selected) === "pass" ? "✓ " : resultKind(selected) === "fail" ? "✕ " : "– "}{resultText[resultKind(selected)!]}</span>}
            </div>
            <CaseRunPanel result={selected} onCaseAction={onCaseAction} />
          </> : <div className="eval-rd-empty"><b>该筛选下没有用例</b></div>}
        </div>
      </div>
    </div>}

    {tab === "info" && <div className="eval-rd-pane">
      <div className="eval-rd-info">
        <div className="eval-rd-infosec">
          <h4>被测配置快照</h4>
          <div className="eval-rd-irow"><span className="eval-rd-k">被测对象</span><span className="eval-rd-v">{run.name}</span></div>
          <div className="eval-rd-irow"><span className="eval-rd-k">执行模型</span><span className="eval-rd-v"><span className="eval-rd-pill">{run.models?.execution?.name || "未记录"}</span></span></div>
          <div className="eval-rd-irow"><span className="eval-rd-k">评测模型</span><span className="eval-rd-v"><span className="eval-rd-pill">{run.models?.judging?.name || "未记录"}</span></span></div>
          <div className="eval-rd-irow"><span className="eval-rd-k">提示词</span><span className="eval-rd-v"><span className="eval-rd-pill">{run.objectSnapshot?.prompt ? `${run.objectSnapshot.prompt.slice(0, 60)}…` : "未记录"}</span></span></div>
          {!!run.objectSnapshot?.knowledge?.length && <div className="eval-rd-irow"><span className="eval-rd-k">知识库</span><span className="eval-rd-v"><span className="eval-rd-pill">{run.objectSnapshot.knowledge.join("、")}</span></span></div>}
          {!!run.objectSnapshot?.skills?.length && <div className="eval-rd-irow"><span className="eval-rd-k">技能</span><span className="eval-rd-v">{run.objectSnapshot.skills.join(" / ")}</span></div>}
          <div className="eval-rd-irow"><span className="eval-rd-k">环境</span><span className="eval-rd-v">{environmentLabel(run.environment)}</span></div>
        </div>
        <div className="eval-rd-infosec">
          <h4>执行明细</h4>
          <div className="eval-rd-irow"><span className="eval-rd-k">报告编号</span><span className="eval-rd-v">{run.code || run.id}</span></div>
          <div className="eval-rd-irow"><span className="eval-rd-k">执行状态</span><span className="eval-rd-v"><span className="eval-rd-rstat" data-s={run.status}>{statusText[run.status]}</span>{!done && `　已完成 ${stats.executed}/${total} 条${run.stopReason ? ` · ${run.stopReason}` : ""}`}</span></div>
          <div className="eval-rd-irow"><span className="eval-rd-k">触发方式</span><span className="eval-rd-v">{run.conversationId ? "对话触发" : "手动触发"}</span></div>
          <div className="eval-rd-irow"><span className="eval-rd-k">执行人</span><span className="eval-rd-v">{run.executor || "未记录"}</span></div>
          <div className="eval-rd-irow"><span className="eval-rd-k">用例集</span><span className="eval-rd-v">{caseVersionLabel(run)} · {total} 条（快照于 {snapshotTime}）</span></div>
          <div className="eval-rd-irow"><span className="eval-rd-k">总耗时</span><span className="eval-rd-v">{durationText}{done ? "" : "（至中断）"}</span></div>
          <div className="eval-rd-irow"><span className="eval-rd-k">基线关系</span><span className="eval-rd-v">{baselineText}</span></div>
        </div>
        <div className="eval-rd-infosec full">
          <h4>原始日志<button type="button" className="eval-rd-logtoggle" onClick={() => setLogOpen(!logOpen)}>{logOpen ? "收起日志" : "展开日志"}</button></h4>
          {logOpen && <div className="eval-rd-log">
            {run.results.map(result => <div key={result.id}>[{new Date(result.timing?.started || run.started).toLocaleTimeString("zh-CN", { hour12: false })}] {result.code || result.id} · {verdictLabel(result)}</div>)}
            {run.stopReason && <div>[end] {run.stopReason}</div>}
          </div>}
        </div>
      </div>
    </div>}
  </div>
}

import { reportSummary } from "./report-summary"
import { formatEvaluationTime as stamp } from "./format-time"
import { finishedCaseCount } from "@/services/evaluation"
import { evaluationModelText } from "@/services/evaluation-models"
import { caseDuration, caseDurationNote, durationText, runDuration, runDurationNote } from "@/services/evaluation-duration"
import { pointsSourceText, pointsScopeNote, runPoints, pointsText } from "@/services/evaluation-points"
import { resultIssueSummary, clarificationText, isActiveRun, responseText, fileCheckTime, executionIssues, aggregateChecks, checkDescription, checkKind, checkOperators, checksOf, executionLabel, expectedResponseLabels, overallCategories, turnsOf, verdictLabel, isClarifyTurn, scenesOf, sceneChecksOf, executedChecksOf, clarifyPickModes, clarifySceneNames, type EvalRun, type EvalCheck, type CheckResult, type EvalAttachment, type EvalTurnResult } from "@/services/evaluation"
import { aggregateRunIssues, type IssueGroup } from "@/services/evaluation-issues"
import { reportLogLines } from "@/services/report-logs"
import type { ObjectSnapshot } from "@/services/evaluation-snapshot"

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
const types = { natural: "语义判断", keyword: "关键词匹配", regex: "正则匹配", file: "文件存在性" }
const badge = (label: string) => `<span class="status ${label === "通过" ? "pass" : label === "不通过" ? "fail" : "neutral"}">${escape(label)}</span>`
export const reportSections = [
  { id: "conclusion", label: "评测结论" },
  { id: "issues", label: "问题清单" },
  { id: "overview", label: "用例概览" },
  { id: "details", label: "详细结果" },
  { id: "info", label: "报告信息" },
] as const

const runStatusLabels = { running: "运行中", judging: "判定中", stopping: "停止处理中", stop_unconfirmed: "停止待核实", error: "执行异常", completed: "已完成", cancelled: "已停止" } as const

function issueGroupHtml(group: IssueGroup) {
  return `<div class="issue-group" data-report-key="issue-${escape(group.key)}"><div class="issue-group-heading"><strong>${escape(group.kind)}</strong>${group.resource ? `<span class="issue-resource">${escape(group.resource)}</span>` : ""}<span class="issue-count">${group.count} 条用例</span></div><dl class="issue-reason"><dt>现象</dt><dd>${escape(group.summary || "未记录")}</dd><dt>推断原因<span class="issue-ai">AI 推断</span></dt><dd>${escape(group.cause || "未记录")}</dd><dt>修复建议</dt><dd>${escape(group.advice || "未记录")}</dd></dl><div class="issue-sources">来源用例：${group.sources.map(source => `<a href="#case-${source.index}">${escape([source.code, source.name].filter(Boolean).join(" "))}</a>`).join("、")}</div></div>`
}

function snapshotHtml(snapshot: ObjectSnapshot | undefined) {
  if (!snapshot) return `<p class="muted">该报告未记录被测配置快照（历史运行）</p>`
  const rows: string[] = []
  if (snapshot.version) rows.push(`<p><b>对象版本</b> ${escape(snapshot.version)}</p>`)
  if (snapshot.modelLevel) rows.push(`<p><b>默认模型档位</b> ${escape(snapshot.modelLevel)}</p>`)
  if (snapshot.skills?.length) rows.push(`<p><b>技能</b> ${escape(snapshot.skills.join("、"))}</p>`)
  if (snapshot.knowledge?.length) rows.push(`<p><b>知识库</b> ${escape(snapshot.knowledge.join("、"))}</p>`)
  if (snapshot.tools?.length) rows.push(`<p><b>工具</b> ${escape(snapshot.tools.join("、"))}</p>`)
  rows.push(snapshot.prompt ? `<details class="snapshot-prompt"><summary>提示词内容</summary><pre>${escape(snapshot.prompt)}</pre></details>` : `<p><b>提示词</b> 未记录</p>`)
  return `<div class="snapshot">${rows.join("")}</div>`
}

/* ---- 详细结果：与设计稿 caseRunPanel 同构（时间线步骤 + 期望响应 + 可折叠判定行） ---- */
type RowVerdict = "passed" | "failed" | "unknown" | "skipped"
const rvClass = { passed: "pass", failed: "fail", unknown: "unk", skipped: "skip" } as const
const rvIcon = { pass: "✓", fail: "✕", unk: "–", skip: "○" } as const
function rvHtml(verdict: RowVerdict) {
  const cls = rvClass[verdict]
  const txt = { passed: "通过", failed: "不通过", unknown: "无法判定", skipped: "未执行" }[verdict]
  return `<span class="erv ${cls}">${rvIcon[cls]} ${txt}</span>`
}
function evBlock(label: string, txt: string, bad: boolean, mut: boolean) {
  return `<div class="eev${bad ? " warn" : ""}${mut ? " mut" : ""}"><span class="eevh">${label}</span><span class="eevt">${escape(txt || "未记录")}</span></div>`
}
function expectRow(turn: Pick<EvalTurnResult, "expectedResponse" | "rules">) {
  const clarify = isClarifyTurn(turn)
  return `<div class="eck"><div class="eck1"><span class="eflb">期望响应</span><span class="erspv${clarify ? " clarify" : ""}">${clarify ? expectedResponseLabels.clarify : expectedResponseLabels.output}</span></div></div>`
}
/** 澄清场景：多个场景互为「或」，按页签切换；未命中的场景标注未运行，不虚构判定。 */
function clarifyScenesHtml(turn: EvalTurnResult) {
  const scenes = scenesOf(turn)
  if (!scenes.length) return ""
  const skipped = turn.status === "skipped"
  const running = turn.status === "pending" || turn.status === "running"
  const tabs = scenes.map((_, i) => `${i ? '<span class="esc-or">或</span>' : ""}<button type="button" class="esc-tab${i ? "" : " on"}" data-scene="${i}">场景${clarifySceneNames[i] || i + 1}</button>`).join("")
  const panes = scenes.map((scene, i) => {
    const askResult = scene.check ? turn.checkResults?.find(item => item.id === scene.check!.id) : undefined
    const ask = scene.check?.text.trim() ? askRowHtml(scene.check, askResult, skipped) : `<p class="esc-note">未配置澄清提问</p>`
    const sceneChecks = sceneChecksOf(turn, scene)
    const note = running || skipped ? "" : i ? `<p class="esc-note">本次执行未运行该场景</p>` : ""
    return `<div class="esc-pane" data-pane="${i}"${i ? " hidden" : ""}>
      <div class="eglab">澄清校验</div>${ask}
      <div class="eck"><div class="eck1"><span class="eflb">澄清选择</span><span class="eckt d">${clarifyPickModes[scene.pickMode || "input"]}</span><span class="ecked">${escape(scene.match)}</span></div></div>
      <div class="eck"><div class="eck1"><span class="eflb">期望澄清后响应</span><span class="erspv${scene.post === "clarify" ? " clarify" : ""}">${scene.post === "clarify" ? "继续澄清" : "内容输出"}</span></div></div>
      <div class="eglab">输出校验</div>${note}${sceneChecks.length ? sceneChecks.map((check, j) => checkRowHtml(check, turn.checkResults?.find(item => item.id === check.id), j + 1, skipped)).join("") : `<p class="esc-note">未配置输出校验</p>`}
    </div>`
  }).join("")
  return `<div class="esc-wrap"><div class="esc-tabs">${tabs}</div>${panes}</div>`
}
/** 澄清提问行：配置 + 判定（执行器未判定时不虚构结果）。 */
function askRowHtml(check: EvalCheck, result: CheckResult | undefined, skipped: boolean) {
  const kind = checkKind(check)
  const text = kind === "natural" ? checkDescription(check) : check.text
  const judged = !skipped && !!result
  const verdict: RowVerdict = judged ? (result!.verdict === "passed" || result!.verdict === "failed" ? result!.verdict : result!.verdict === "skipped" ? "skipped" : "unknown") : "skipped"
  const open = verdict === "failed" || verdict === "unknown"
  return `<div class="eck${open ? " open" : ""}"><div class="eck1"${judged ? ' data-cktgl' : ""}><span class="eflb">澄清提问</span><span class="eckt ${kind === "natural" ? "s" : "d"}">${types[kind]}</span><span class="ecked${kind === "regex" ? " mono" : ""}">${escape(text)}</span>${judged ? rvHtml(verdict) + '<span class="ecar">▾</span>' : rvHtml("skipped")}</div>${judged ? `<div class="eckm">${evBlock("实际结果", result!.actual, verdict === "failed", false)}${evBlock("判断依据", result!.evidence, verdict === "failed", !result!.evidence)}</div>` : ""}</div>`
}
function checkRowHtml(check: EvalCheck, result: CheckResult | undefined, no: number, skip: boolean) {
  const kind = checkKind(check)
  const mono = kind === "regex"
  const judged = !skip && !!result
  const verdict: RowVerdict = judged ? (result!.verdict === "passed" || result!.verdict === "failed" ? result!.verdict : result!.verdict === "skipped" ? "skipped" : "unknown") : "skipped"
  const open = verdict === "failed" || verdict === "unknown"
  const text = kind === "natural" ? checkDescription(check) : check.text
  const blocks: string[] = judged ? [
    evBlock("实际结果", result!.actual, verdict === "failed", false),
    evBlock("判断依据", result!.evidence, verdict === "failed", !result!.evidence),
    ...(kind === "file" && result!.fileEvidence ? [evBlock("产物检查", `路径 ${result!.fileEvidence.path} · ${result!.fileEvidence.exists ? "存在" : "不存在"} · 检查时点 ${fileCheckTime(result!.fileEvidence)}`, verdict === "failed", false)] : []),
  ] : []
  return `<div class="eck${verdict === "failed" ? " fail" : verdict === "unknown" ? " unk" : ""}${open ? " open" : ""}"><div class="eck1"${judged ? ' data-cktgl' : ""}><span class="ecnum">${no}</span><span class="eckt ${kind === "natural" ? "s" : "d"}">${types[kind]}</span>${check.overall ? `<span class="erspv">${escape(overallCategories[check.overall])}</span>` : ""}<span class="ecked${mono ? " mono" : ""}">${escape(text)}</span>${judged ? rvHtml(verdict) + '<span class="ecar">▾</span>' : rvHtml("skipped")}</div>${judged ? `<div class="eckm">${blocks.join("")}</div>` : ""}</div>`
}
function attChipsHtml(files: EvalAttachment[] | undefined, label: string) {
  if (!files?.length) return ""
  return `<div class="euf"><span class="eulk">${label}</span><div><span class="eatt">${files.map(file => `<span>${escape(file.name)}</span>`).join("")}</span></div></div>`
}

const extraStyles = `
  .brief{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
  .brief-row{display:flex;gap:12px;align-items:baseline}
  .brief-key{flex-shrink:0;width:44px;color:var(--muted);font-size:12px}
  .brief-text{font-size:14px;line-height:1.7}
  .summary-box{border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:8px}
  .sb-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
  .sb-rate{font-size:24px;font-weight:600;line-height:1.3;font-variant-numeric:tabular-nums}
  .sb-rate small{font-size:12px;font-weight:400;color:var(--muted)}
  .rsegbar{flex:1;height:8px;min-width:140px;border-radius:4px;overflow:hidden;background:#e2e5ed;display:flex}
  .rsegbar>div{height:100%}
  .rp{background:#35b889}.rf{background:#ef716b}.ru{background:#e5af46}
  .rflag{padding:2px 8px;border-radius:5px;background:var(--soft);color:var(--muted);font-size:12px}
  .sb-note{margin:8px 0 0;color:var(--muted);font-size:12px}
  .snap-line{margin-top:12px;padding-top:10px;border-top:1px dashed var(--line);color:var(--muted);font-size:12px}
  .report-log{max-height:320px;overflow:auto;background:var(--soft);border-radius:8px;padding:12px;font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}
  .issue-group{padding:16px;border:1px solid var(--line);border-radius:12px;margin-bottom:12px}
  .issue-group-heading{display:flex;align-items:baseline;gap:8px 12px;flex-wrap:wrap}
  .issue-group-heading strong{font-size:14px}
  .issue-resource{padding:1px 7px;border-radius:5px;background:var(--soft);color:var(--muted);font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}
  .issue-count{margin-left:auto;color:var(--muted);font-size:12px}
  .issue-reason{display:grid;grid-template-columns:76px minmax(0,1fr);gap:6px 12px;margin:12px 0 8px}
  .issue-reason dt{color:var(--muted);font-size:12px}
  .issue-reason dd{margin:0;font-size:13px}
  .issue-ai{display:inline-block;margin-left:6px;padding:0 5px;border-radius:4px;background:#eef0ff;color:var(--accent);font-size:11px}
  .issue-sources{color:var(--muted);font-size:12px}
  .issue-sources a{margin-right:4px}
  .snapshot p{margin:4px 0;font-size:13px}
  .snapshot-prompt{margin-top:8px}
  .snapshot-prompt pre,.report-logs pre{max-height:280px;overflow:auto;background:var(--soft);border-radius:8px;padding:12px;font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}
  .snapshot-prompt pre{max-height:220px}
  .snapshot-link{font-size:12px}
  .case-actions{display:none}
  html[data-embedded] .case-actions{display:flex;gap:12px;margin-top:16px;padding-top:12px;border-top:1px solid var(--line)}
  .case-actions button{font:inherit;font-size:13px;padding:6px 14px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);cursor:pointer}
  .case-actions button:hover{background:var(--soft)}
  /* 详细结果：与设计稿用例结果卡同构（时间线 + 期望响应 + 可折叠判定行） */
  .ecase-head{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px 12px}
  .ecr-head{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
  .ecid{font-size:11px;font-weight:600;background:var(--soft);color:var(--muted);border-radius:4px;padding:1px 6px}
  .enm{font-size:14px;font-weight:600;min-width:0;word-break:break-word;flex:1}
  .ecr-meta{padding:4px 14px 10px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--line)}
  .ebgtop{display:grid;grid-template-columns:76px 1fr;gap:10px;align-items:start;border:1px solid #E9EDF4;border-radius:12px;padding:12px 15px;margin:12px 14px 0;background:var(--paper)}
  .ebgh{font-size:11px;color:var(--muted);padding-top:3px}
  .eatt{display:inline-flex;gap:5px;flex-wrap:wrap}
  .eatt span{font-size:10px;border:1px solid var(--line);border-radius:4px;padding:0 5px;color:var(--muted);background:var(--soft)}
  .esteps{position:relative;padding:12px 14px 4px 40px}
  .esteps:before{content:"";position:absolute;left:20px;top:26px;bottom:30px;width:2px;background:#E9EDF2;border-radius:2px}
  .estep{position:relative;margin-bottom:12px}
  .estep:last-child{margin-bottom:0}
  .esnode{position:absolute;left:-30px;top:10px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 0 0 3px var(--paper);z-index:1;box-sizing:border-box;background:#fff;color:#B3BAC6;border:1.5px dashed #C9CFDA}
  .esnode.pass{background:#E6F6EE;color:#0F9960;border:0}
  .esnode.fail{background:#FDEBEA;color:#C0392B;border:0}
  .esnode.unk{background:#EEF0F3;color:#6B7280;border:0}
  .esbody{min-width:0}
  .erd{border:1px dashed #DCE1EA;border-radius:12px;padding:14px 16px 12px;background:var(--paper)}
  .erd.skip{background:#FCFCFD;border-color:#E7EAF0}
  .emhead{display:flex;align-items:center;gap:8px;margin-bottom:7px}
  .erole{font-size:11.5px;font-weight:600;color:var(--muted)}
  .err{margin-left:auto;font-size:10.5px;color:var(--muted)}
  .euf{display:grid;grid-template-columns:70px 1fr;gap:9px;align-items:start}
  .euf>.eub{justify-self:start}
  .eulk{font-size:11px;color:var(--muted);padding-top:7px}
  .eub{display:inline-block;max-width:100%;background:#F7F9FC;border:1px solid #E9EDF4;border-radius:8px;padding:9px 11px}
  .emtext{font-size:13px;line-height:1.65;color:var(--ink);word-break:break-word}
  .eoslot{margin-top:13px;padding-left:10px}
  .eob{background:#F7FAF8;border-left:2px solid #7FBF9E;border-radius:0 8px 8px 0;padding:1px 12px 3px}
  .eglab{font-size:11.5px;font-weight:600;color:var(--ink);margin:10px 0 3px}
  .eglab small{font-weight:400;color:var(--muted);font-size:10.5px;margin-left:7px}
  .eck{padding:9px 0;border-top:1px solid #F1F3F6}
  .eck:first-child{border-top:0}
  .eck1{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap;min-width:0}
  .eck1[data-cktgl]{cursor:pointer}
  .ecnum{flex:0 0 auto;font-size:10.5px;color:var(--muted);min-width:12px}
  .eckt{font-size:9.5px;font-weight:600;padding:1px 5px;border-radius:3px;flex:0 0 auto}
  .eckt.d{background:var(--soft);color:var(--muted)}
  .eckt.s{background:#F1EBFF;color:#7A5AF8}
  .ecked{font-size:12.5px;color:var(--ink);font-weight:500;word-break:break-word;min-width:0}
  .ecked.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;font-weight:400}
  .eflb{flex:0 0 auto;font-size:10.5px;color:var(--muted)}
  .erspv{display:inline-block;font-size:10.5px;font-weight:600;line-height:1.7;padding:1px 9px;border-radius:999px;background:var(--soft);color:var(--muted)}
  .erspv.clarify{background:#EAF1FF;color:#1E4FCC}
  .eckm{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;margin-top:6px;font-size:11px;line-height:1.65}
  .eck:not(.open)>.eckm{display:none}
  .ecar{flex:0 0 auto;color:var(--muted);font-size:9px;line-height:1;transition:transform .15s;transform:rotate(-90deg)}
  .eck.open .ecar{transform:none}
  .eev{background:#F7F8FA;border-left:3px solid #C9CFDA;border-radius:0 8px 8px 0;padding:7px 11px 8px}
  .eev.warn{border-left-color:#C0392B}
  .eev.warn .eevt{color:#C0392B}
  .eev.mut{border-left-color:#E3E6EB}
  .eev.mut .eevt{color:var(--muted)}
  .eevh{display:block;font-size:10px;font-weight:600;color:var(--muted);letter-spacing:.5px;margin-bottom:2px}
  .eevt{display:block;font-size:11.5px;line-height:1.7;color:var(--muted);word-break:break-word}
  .emout{font-size:12.5px;line-height:1.7;color:var(--ink);background:#F6F8FB;border:1px solid #EDF0F5;border-radius:10px;padding:9px 13px;word-break:break-word}
  .emout.clip{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .emout.clip.open{display:block}
  .ebmore{font-size:10.5px;color:var(--accent);cursor:pointer;margin:4px 0 6px;display:inline-block}
  .etrace{margin-top:7px}
  .etrace-h{font-size:10.5px;color:var(--muted);cursor:pointer;user-select:none}
  .etrace-h:hover{color:#1E4FCC}
  .etrace-b{display:none;margin-top:5px;border-left:1px dashed #E0E4EC;padding-left:10px}
  .etrace.open .etrace-b{display:block}
  .etrace-b div{font-size:11px;color:var(--muted);line-height:1.75;word-break:break-word}
  .etrace-b b{color:var(--muted);font-weight:400;margin-right:5px}
  .eskipbox{border:1.5px dashed #DCE1EA;border-radius:10px;padding:11px 14px;font-size:11.5px;color:var(--muted);background:#FBFCFD}
  .eovrbox{border:1px solid var(--line);border-radius:12px;padding:2px 16px 6px;margin-top:14px}
  .eovr-h{font-size:12.5px;font-weight:600;color:var(--ink);padding:11px 0 7px}
  .esc-wrap{margin-top:2px}
  .esc-tabs{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:7px}
  .esc-tab{font:inherit;font-size:11px;line-height:1.7;padding:2px 10px;border:1px solid #E1E5EC;border-radius:6px;background:#fff;color:var(--muted);cursor:pointer}
  .esc-tab:hover{border-color:#C9D9FF}
  .esc-tab.on{border-color:#C9D9FF;background:#EAF1FF;color:#1E4FCC;font-weight:600}
  .esc-or{font-size:10.5px;color:var(--muted)}
  .esc-note{font-size:10.5px;color:var(--muted);margin:2px 0 4px}
  .esc-pane[hidden]{display:none}
  .eovr-h small{font-weight:400;font-size:10.5px;color:var(--muted);margin-left:7px}
  .eovr-row{border-top:1px solid #F2F4F7;padding:10px 0}
  .eovr-row:first-of-type{border-top:0}
  .eovr-line{display:flex;align-items:baseline;gap:8px;font-size:12px}
  .eovr-line[data-cktgl]{cursor:pointer}
  .eovr-line .eov{flex:1;color:var(--ink);line-height:1.65;word-break:break-word;min-width:0}
  .eovr-row:not(.open)>.eckm{display:none}
  .erv{flex:0 0 auto;font-size:10px;font-weight:600;padding:1px 7px;border-radius:999px;white-space:nowrap}
  .erv.pass{background:#E6F6EE;color:#0F9960}
  .erv.fail{background:#FDEBEA;color:#C0392B}
  .erv.unk{background:#EEF0F3;color:#6B7280}
  .erv.skip{background:#F5F6F8;color:var(--muted);border:1px solid #E3E6EB}
  .epfoot{display:flex;gap:8px;margin:12px 14px 14px}
  .epfoot button{font:inherit;font-size:11.5px;border:1px solid var(--line);background:var(--paper);border-radius:8px;padding:5px 12px;cursor:pointer;color:var(--muted)}
  .epfoot button:hover{border-color:#C9D9FF;color:#1E4FCC}
  html:not([data-embedded]) .epfoot{display:none}
  @media(max-width:600px){.euf,.ebgtop{grid-template-columns:1fr}.euf>.eulk,.ebgh{padding-top:0}.esteps{padding-left:32px}.esnode{left:-22px}}
  .case-actions button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
`

/** Standalone HTML with a fixed, CSP-hashed interaction script. All snapshot text is escaped; no external resources. */
export function buildReportDocument(run: EvalRun, translate: (key: string) => string = key => key, options: { baselineLabel?: string } = {}): string {
  const durationNow = Date.now()
  const counts = ["通过", "不通过", "无法判定"].map(label => ({ label, count: run.results.filter(r => verdictLabel(r) === label).length }))
  const remaining = run.results.length - counts.reduce((sum, c) => sum + c.count, 0)
  const issueGroups = aggregateRunIssues(run)
  const executedCount = run.results.filter(result => ["通过", "不通过", "无法判定"].includes(verdictLabel(result))).length
  const snapshot = run.objectSnapshot
  const logLines = reportLogLines(run)
  const pending = isActiveRun(run)
  const executed = counts.reduce((sum, item) => sum + item.count, 0)
  const rateDone = executed ? Math.round(counts[0].count / executed * 100) : 0
  const segDenom = pending ? Math.max(run.results.length, 1) : Math.max(executed, 1)
  const segW = (count: number) => `${(count / segDenom * 100).toFixed(2)}%`
  const progressSegments = run.results.map((result, index) => {
    const label = verdictLabel(result)
    const state = result.judging || result.status === "running" ? "running" : label === "通过" ? "passed" : label === "不通过" ? "failed" : label === "无法判定" ? "unknown" : result.status === "cancelled" || result.status === "skipped" ? "cancelled" : "pending"
    return `<a class="progress-segment" data-status="${state}" href="#case-${index}" title="${escape(`${result.code || result.name} · ${label} · ${executionLabel(result)}`)}" aria-label="${escape(`${result.name}：${label}`)}"><span></span></a>`
  }).join("")
  const runNote = run.status === "cancelled" ? "，运行已停止，报告不完整，部分用例可能未执行或中断" : run.status === "error" ? "，运行因执行异常结束，报告不完整" : pending ? "，运行仍在执行或判定中" : ""
  const summary = reportSummary(run)
  const advice = pending ? "" : summary.allUnknown ? summary.note : counts[2].count ? (counts[1].count ? "建议先排查无法判定的原因，再处理未通过用例。" : "建议排查无法判定的原因后重新运行。") : counts[1].count ? "建议查看失败证据并分析修复方案。" : ""


  // 判定行折叠与"展开全文"由文档尾部脚本处理；期望响应为配置值展示，原型执行器不做期望响应判定。
  const caseDetails = run.results.map((result, index) => {
    // Do not invent per-round evidence for legacy runs that only recorded a case result.
    const rounds: EvalTurnResult[] = result.roundResults || turnsOf(result).map(turn => ({ ...turn, status: result.status, response: "", evidence: pending ? "待生成" : "历史运行未记录逐轮依据", clarification: "" }))
    const turnVerdict = (turn: EvalTurnResult): RowVerdict => {
      if (["skipped", "pending"].includes(turn.status)) return "skipped"
      if (turn.status === "cancelled") return "unknown"
      const aggregate = turn.checkResults?.length ? aggregateChecks(turn.checkResults) : "unknown"
      return aggregate === "passed" ? "passed" : aggregate
    }
    const blocked = result.execution === "error" || result.status === "blocked"
    const stepHtml = (verdict: RowVerdict, body: string, title: string, icon?: string) =>
      `<div class="estep"><div class="esnode ${rvClass[verdict]}" title="${escape(title)}">${verdict === "skipped" ? (icon ?? "○") : rvIcon[rvClass[verdict]]}</div><div class="esbody">${body}</div></div>`
    const roundSteps = rounds.map((turn, ri) => {
      const skipped = turn.status === "skipped"
      const verdict = turnVerdict(turn)
      const checks = checksOf(turn, ri ? turn.inherit ? rounds[0].expected : undefined : undefined)
      const results = turn.checkResults
      const failCount = results?.filter(c => c.verdict === "failed").length ?? 0
      const unknownCount = results?.filter(c => c.verdict !== "passed" && c.verdict !== "failed").length ?? 0
      const passCount = Math.max(checks.length - failCount - unknownCount, 0)
      const stat = skipped ? "未执行" : `${passCount}/${checks.length} 通过${failCount ? ` · ${failCount} 未通过` : ""}${unknownCount ? ` · ${unknownCount} 未判定` : ""}`
      const respText = turn.status === "pending" ? "待生成" : turn.status === "running" ? "生成中…" : responseText(turn, translate)
      const long = respText.length > 110
      const outputBlock = skipped
        ? `<div class="eskipbox">${escape(turn.evidence || "未执行，未产生输出")}</div>`
        : `<div class="emout${long ? " clip" : ""}">${escape(respText)}</div>${long ? '<span class="ebmore" data-more>展开全文</span>' : ""}${turn.tool ? `<div class="etrace"><span class="etrace-h" data-trace>执行过程 ▾</span><div class="etrace-b"><div><b>${escape(turn.tool)}</b>${escape(turn.toolResult || "未记录工具返回")}</div></div></div>` : ""}`
      const body = `<div class="erd${skipped ? " skip" : ""}">
        <div class="emhead"><span class="erole">第 ${ri + 1} 轮 · 用户输入</span><span class="err">${stat}</span></div>
        <div class="euf"><span class="eulk">固定输入</span><div class="eub"><div class="emtext">${escape(turn.input || "（空）")}</div></div></div>
        ${attChipsHtml(turn.attachments, "本轮背景知识")}
        <div class="eoslot"><div class="emhead"><span class="erole">模型输出</span></div>${outputBlock}
        <div class="emhead" style="margin-top:12px"><span class="erole">校验内容</span></div>
        <div class="eob">${expectRow(turn)}${isClarifyTurn(turn)
          ? clarifyScenesHtml(turn)
          : `<div class="eglab">输出校验</div>${checks.map((check, j) => checkRowHtml(check, results?.find(item => item.id === check.id), j + 1, skipped)).join("")}`}</div></div>
      </div>`
      return stepHtml(verdict, body, `第 ${ri + 1} 步：${verdict === "skipped" ? "未执行" : { passed: "通过", failed: "不通过", unknown: "无法判定" }[verdict]}`, String(ri + 1))
    }).join("")
    const overallChecks = result.checks || []
    const overallResults = result.checkResults
    const overallStatus: RowVerdict = !overallChecks.length || result.status === "skipped" ? "skipped"
      : overallResults?.some(item => item.verdict === "failed") ? "failed"
      : pending || blocked || overallResults?.some(item => item.verdict !== "passed") || overallResults === undefined ? "unknown" : "passed"
    const overallBody = `<div class="eovrbox"><div class="eovr-h">案例整体校验</div>${overallChecks.length ? overallChecks.map((check, j) => {
      const item = overallResults?.find(entry => entry.id === check.id)
      const judged = !pending && result.status !== "skipped" && !!item
      const verdict: RowVerdict = judged ? (item!.verdict === "passed" || item!.verdict === "failed" ? item!.verdict : item!.verdict === "skipped" ? "skipped" : "unknown") : "skipped"
      const open = verdict === "failed" || verdict === "unknown"
      const kind = checkKind(check)
      const text = kind === "natural" ? checkDescription(check) : check.text
      return `<div class="eovr-row${open ? " open" : ""}"><div class="eovr-line"${judged ? ' data-cktgl' : ""}><span class="eckt ${kind === "natural" ? "s" : "d"}">${types[kind]}</span>${check.overall ? `<span class="erspv">${escape(overallCategories[check.overall])}</span>` : ""}<span class="eov">${escape(text)}</span>${judged ? rvHtml(verdict) + '<span class="ecar">▾</span>' : rvHtml("skipped")}</div>${judged ? `<div class="eckm">${evBlock("实际结果", item!.actual, verdict === "failed", false)}${evBlock("判断依据", item!.evidence, verdict === "failed", !item!.evidence)}${kind === "file" && item!.fileEvidence ? evBlock("产物检查", `路径 ${item!.fileEvidence.path} · ${item!.fileEvidence.exists ? "存在" : "不存在"} · 检查时点 ${fileCheckTime(item!.fileEvidence)}`, verdict === "failed", false) : ""}</div>` : ""}</div>`
    }).join("") : `<p class="muted" style="padding:8px 0">本用例未配置整体校验</p>`}</div>`
    const caseVerdict: RowVerdict = verdictLabel(result) === "通过" ? "passed" : verdictLabel(result) === "不通过" ? "failed" : verdictLabel(result) === "判定中" || verdictLabel(result) === "待判定" ? "skipped" : "unknown"
    const totalChecks = rounds.reduce((count, turn) => count + executedChecksOf(turn).length, 0) + overallChecks.length
    const totalFailed = [...rounds.flatMap(turn => turn.checkResults || []), ...(result.checkResults || [])].filter(item => item.verdict === "failed").length
    const totalUnknown = [...rounds.flatMap(turn => turn.checkResults || []), ...(result.checkResults || [])].filter(item => item.verdict !== "passed" && item.verdict !== "failed").length
    return `<details id="case-${index}" class="case" data-case-id="${escape(result.id)}"${pending ? "" : " open"}><summary><span class="ecid">${escape(result.code || "")}</span><span class="enm">${escape(result.name)}</span>${rvHtml(caseVerdict)}</summary>
      <div class="ecr-meta">${rounds.length} 轮对话 · ${totalChecks} 项校验${totalFailed ? `（${totalFailed} 项未通过` : ""}${totalFailed && totalUnknown ? " · " : totalFailed ? "）" : ""}${totalFailed && totalUnknown ? `${totalUnknown} 项未判定）` : totalFailed ? "" : totalUnknown ? `（${totalUnknown} 项未判定）` : ""} · <span class="duration case-duration" title="${escape(caseDurationNote)}">耗时：${escape(durationText(caseDuration(result, run, durationNow)))}</span> · 执行状态：${escape(executionLabel(result))}${result.summary ? ` · 案例精要：${escape(result.summary)}` : ""}</div>
      ${attChipsHtml(result.background, "案例背景知识")}${attChipsHtml(result.attachments, "会话附件")}
      <div class="esteps">${roundSteps}${stepHtml(overallStatus, overallBody, `案例整体校验：${overallStatus === "skipped" ? "未执行" : { passed: "通过", failed: "不通过", unknown: "无法判定" }[overallStatus]}`, "◎")}</div>
      ${pending ? "" : `<div class="epfoot"><button type="button" data-case-action="rerun">重跑这条用例</button><button type="button" data-case-action="edit">去编辑用例</button></div>`}</details>`
  }).join("")
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-GXt4EM/EjRIPoS3OsunVA069mGG82ZBabHU6dN5a2pM=' 'sha256-iSIHVHSCjqsvF6xL5dJR30VBGdA3Un5Sne6K4vFzdLA=='; style-src 'unsafe-inline'; img-src data:"><title>${escape(run.name)} · 评测报告</title><style>
  :root{color-scheme:light;--eval-status-failed:#c42b32;--eval-status-unknown:#a46000;--ink:#242428;--muted:#707075;--line:#eeeef1;--accent:#5558ff;--paper:#fff;--soft:#f7f7f9}
  *{box-sizing:border-box}html{scroll-padding-top:24px}body{margin:0;background:#f7f7f9;color:var(--ink);font:14px/1.8 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}
  .skip-link{position:fixed;left:16px;top:-100px;z-index:2;background:white;padding:8px 16px}.skip-link:focus{top:8px}summary:hover{color:var(--accent)}
  a{color:var(--accent);text-decoration:none}a:hover{color:var(--ink)}a:focus-visible,summary:focus-visible,.table-wrap:focus-visible{outline:2px solid var(--accent);outline-offset:4px}
  .layout{max-width:1320px;margin:auto;display:grid;grid-template-columns:210px minmax(0,1fr);gap:24px;padding:24px}aside{align-self:start;position:sticky;top:24px}aside strong{display:block;font-size:13px;padding:0 12px 12px;border-bottom:0}aside a{display:block;color:var(--muted);padding:9px 12px;font-size:13px;border-radius:10px}aside a:hover{background:#ededf2;text-decoration:none;color:var(--ink)}
  main{min-width:0}header,main>section:not(#details){background:var(--paper);padding:24px;border-radius:16px;margin-bottom:16px}header{padding-top:24px}.brand{font-size:12px;font-weight:600;color:var(--accent);margin:0 0 16px}h1{font-size:22px;line-height:1.4;margin:0 0 8px}.subject{font-size:17px;font-weight:500;margin:0 0 4px;color:var(--muted)}h2{font-size:16px;line-height:1.5;margin:0 0 16px;padding-bottom:0;border-bottom:0;color:var(--ink)}h3{font-size:16px;line-height:1.6;margin:28px 0 8px}h4{font-size:14px;line-height:1.6;font-weight:500;margin:0 0 6px;color:var(--ink)}p{margin:6px 0;white-space:pre-wrap;overflow-wrap:anywhere}.muted,dt{color:var(--muted)}
  #conclusion>header{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 16px;padding:0 0 16px;margin:0 0 20px;border-radius:0;border-bottom:1px solid var(--line)}#conclusion>header h1{margin:0;font-size:20px}#conclusion>header .subject{margin:0;font-size:15px}#conclusion>header .report-context{margin:0 0 0 auto}.report-context{font-size:12px;color:var(--muted)}.conclusion-unknown{color:var(--eval-status-unknown)}.conclusion-lead{font-size:19px;font-weight:600;line-height:1.5}.findings h3{font-size:13px;margin:0 0 4px}.findings p{font-size:13px;margin:0;color:var(--muted)}.run-info>summary{font-size:14px;font-weight:400}.run-info[open]>summary{margin-bottom:20px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;padding:0;border:0;font-size:13px}.meta>div{min-width:0}.meta dt{font-size:12px}.meta dd{color:var(--ink)}.meta .wide{grid-column:1/-1}
  #conclusion{background:var(--paper);padding:24px;margin-top:0;border-radius:16px}#conclusion h2{border:0;padding:0;margin:0 0 12px}.counts{display:flex;flex-wrap:wrap;gap:20px 36px;padding:12px 0 16px;margin:8px 0 12px;border-bottom:1px solid var(--line)}.counts>span{display:flex;flex-direction:column-reverse;color:var(--muted);font-size:12px}.counts strong{font-size:24px;line-height:1.4;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}
  .status{display:inline-block;font-size:12px;font-weight:400;white-space:nowrap;margin-left:8px}.pass{color:#237454}.fail{color:var(--eval-status-failed)}.neutral{color:var(--eval-status-unknown)}.table-wrap{overflow:auto;border:0;border-radius:12px}table{width:100%;min-width:580px;border-collapse:collapse;text-align:left;font-size:13px}td,th{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}th{font-weight:600;background:var(--soft);color:var(--ink)}tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:var(--soft)}td:first-child{min-width:160px}td:not(:first-child),th{white-space:nowrap}td:last-child{white-space:nowrap}td .status{margin:0}
  .issue{padding:14px 0;border-bottom:1px solid var(--line)}.issue:first-of-type{padding-top:0}.issue:last-child{border:0}.issue a{font-weight:600}.issue p{color:var(--muted);font-size:13px;margin-top:8px}.case{background:var(--paper);padding:24px;border-radius:16px;margin-bottom:16px}.case>h3{padding-left:0;margin-top:0}.case>.muted{font-size:12px;margin-bottom:16px}.round{border:0;border-radius:12px;background:var(--soft);overflow:hidden;margin:16px 0}summary{position:relative;padding-left:18px;cursor:pointer;overflow-wrap:anywhere;list-style:none}summary::-webkit-details-marker{display:none}summary::before{content:"";position:absolute;left:0;top:9px;display:block;width:6px;height:6px;border-right:1.5px solid var(--muted);border-bottom:1.5px solid var(--muted);transform:rotate(-45deg);margin-right:0}details[open]>summary::before{transform:rotate(45deg)}.round>summary{padding:12px 16px 12px 36px;font-size:16px;font-weight:600;background:transparent}.round>summary::before{left:16px;top:22px}.round>summary .status{float:right}.round[open]>summary{border-bottom:0}.round-body{padding:4px 20px 20px}.field{margin:24px 0}.field>h4{margin:0;font-size:13px;line-height:1.6;font-weight:500;color:var(--muted)}.field>p{margin:8px 0 0;padding-inline-start:12px;font-size:14px;line-height:1.7;white-space:pre-wrap}.configured{margin:16px 0;color:var(--muted);font-size:13px}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.pair>div{min-width:0;overflow-wrap:anywhere}.standards{margin-top:24px}.standards>h4{font-size:14px;color:var(--ink);margin-bottom:10px}.standard{margin-top:8px;padding:12px;border-radius:12px;background:var(--soft)}.round .standard{background:var(--paper)}.standard-heading{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;padding:8px 0;font-size:13px}.standard-heading>span:not(.status){color:var(--muted)}.standard-heading .status{margin-left:auto}.standard>p{padding:0;margin:0}dl{display:grid;grid-template-columns:76px minmax(0,1fr);gap:8px 16px;margin:0}dt,dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.standard dl{padding:12px 0;font-size:13px}.standard dt{font-weight:500}footer{border-top:1px solid var(--line);margin-top:24px;padding-top:12px;color:var(--muted);font-size:12px}.empty{color:var(--muted)}
  @media(max-width:900px){.layout{grid-template-columns:1fr;gap:16px;padding:16px}aside{position:static;display:flex;gap:4px 12px;flex-wrap:wrap}aside strong{display:none}aside a{padding:4px 0}header,main>section:not(#details),.case{padding:20px}h1{font-size:24px}}
  @media(max-width:480px){.layout{padding:8px}header,main>section:not(#details),.case{padding:16px}.meta{grid-template-columns:1fr;gap:10px}.pair{grid-template-columns:1fr;gap:0}#conclusion{padding:16px}.counts{gap:16px 24px}.round-body{padding:0 12px 12px}.standard dl{grid-template-columns:1fr;gap:2px}.standard dd{margin-bottom:8px}h2{font-size:17px}h1{font-size:24px}.subject{font-size:15px}}
  html[data-embedded] .layout{display:block;padding:0;max-width:none}html[data-embedded] aside,html[data-embedded] .skip-link{display:none}
  .case>summary{font-size:15px;font-weight:600}.case-nav{max-height:45vh;overflow:auto}.case-nav a{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.report-controls{display:flex;gap:12px;margin:12px 0}.report-controls button{font:inherit;font-size:13px;background:transparent;border:0;border-radius:6px;padding:4px 8px;color:var(--ink);cursor:pointer}.report-controls button:hover{background:var(--soft)}.report-controls button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.run-info{margin:12px 0}.run-info .meta{margin-top:16px}#rules{font-size:13px}
  .case-nav a{display:flex;gap:6px}.case-nav-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.case-nav a>span:last-child{flex-shrink:0}
  @page{size:A4;margin:18mm 16mm}@media print{body{background:#fff;font-size:11px}.layout{display:block;padding:0}aside{display:none}main{border:0;box-shadow:none;padding:0}h1{font-size:24px}h2{font-size:16px;break-after:avoid}h3,h4,summary{break-after:avoid}.standard{break-inside:avoid}.round{border:0}.round-body{padding:0}thead{display:table-header-group}a{color:inherit;text-decoration:none}details::details-content{display:block!important}#conclusion{print-color-adjust:exact}footer{font-size:10px}}

  .report-meta-line{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px 24px;margin-bottom:24px;font-size:13px}.run-info{margin:0;flex:1;min-width:100px}.run-info>summary{font-size:13px;color:var(--muted);cursor:pointer;width:max-content}.run-info[open]{flex-basis:100%}.run-info[open]>summary{margin-bottom:12px}.run-info .meta{background:var(--soft,#f7f7fa);border:1px solid var(--line);border-radius:8px;padding:16px;margin:0;font-size:13px}footer{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:16px}footer>details{flex:1;min-width:180px}footer>details>summary{width:max-content;color:var(--muted);cursor:pointer}footer>details[open]{flex-basis:100%}footer>details p{max-width:80ch;color:var(--muted)}
  .layout{grid-template-columns:minmax(200px,min(var(--nav-width,240px),35%)) 16px minmax(0,1fr);gap:8px}.nav-heading{display:flex;align-items:center;justify-content:space-between;padding:0 12px 12px}.nav-heading strong{padding:0}.report-resizer{align-self:start;position:sticky;top:24px;height:calc(100vh - 48px);cursor:col-resize;touch-action:none;user-select:none;border-radius:6px}.report-resizer:after{content:"";position:absolute;left:7px;top:0;bottom:0;width:2px;background:var(--line)}.report-resizer:hover:after,.report-resizer:focus-visible:after{background:var(--accent)}.case-nav a{white-space:normal;align-items:baseline}.case-nav-name{white-space:normal!important;overflow-wrap:anywhere}html[data-embedded] .report-resizer{display:none}
  @media(max-width:900px){.layout{grid-template-columns:1fr;gap:16px}.report-resizer,.nav-heading{display:none}}
  @media print{.report-resizer,.layout{display:block}}
  .nav-section{display:flex;align-items:center}.nav-section>a{flex:1;font-weight:500}.nav-toggle{width:28px;height:28px;border:0;border-radius:6px;background:transparent;color:var(--muted);cursor:pointer;font-size:18px}.nav-toggle:hover{background:#ededf2}.case-nav{margin:2px 0 8px 16px;padding-left:8px;border-left:1px solid var(--line)}.case-nav[hidden]{display:none}.case-nav a{display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:6px;padding:8px}.case-nav a>span:last-child{font-size:11px}aside a[aria-current="location"]{background:#ededf2;color:var(--accent)}
  .report-section-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 16px;margin-bottom:16px}.report-section-heading h2{margin:0}.report-section-heading .report-controls{margin:0 0 0 auto;flex-wrap:wrap;justify-content:flex-end}
  .case-status-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px 12px;margin:8px 0 12px}.case-status-row>p{margin:0;font-size:12px}.report-round-heading{display:flex;align-items:center;justify-content:space-between;gap:8px 16px;margin:16px 0 8px}.report-round-heading h3{font-size:14px;font-weight:500;margin:0}.report-round-heading .report-round-controls{margin:0;flex-shrink:0}.report-round-heading .report-round-controls button{color:var(--muted);font-size:12px}.report-round-heading+.round{margin-top:8px}
  .duration{font-variant-numeric:tabular-nums;white-space:nowrap}.run-duration{color:var(--muted)}.duration-cell{text-align:right}.case>summary{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px 16px}.case-heading-label{flex:1;min-width:0}.case-meta{flex-basis:100%;display:flex;flex-wrap:wrap;gap:4px 24px;font-size:12px;line-height:1.6;font-weight:400;color:var(--muted)}.case>summary{row-gap:6px}.case[open]>summary{margin-bottom:16px}
  @media(max-width:600px){.case-heading-label{flex-basis:100%}}
  @media(max-width:900px){aside{position:relative;top:auto;z-index:5;display:grid;grid-template-columns:repeat(3,max-content) minmax(0,1fr);gap:8px 16px;min-width:0}.nav-section{gap:0;white-space:nowrap}.nav-section>a{flex:none;padding:8px 4px}.nav-toggle{width:20px;height:32px;flex-shrink:0}.case-nav{position:absolute;top:calc(100% + 6px);left:0;right:0;background:var(--paper);box-shadow:0 8px 28px rgb(0 0 0 / 12%);min-width:0;margin:0;padding:4px;border:1px solid var(--line);border-radius:10px;max-height:min(32vh,240px);overflow-y:auto;overscroll-behavior:contain}.case-nav-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}}
  @media(max-width:480px){aside{grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 12px}}
  .nav-toggle{display:inline-flex;align-items:center;justify-content:center;padding:0;font-size:0;line-height:1}.nav-toggle::after{content:"";width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg)}.nav-toggle[aria-expanded="true"]::after{transform:translateY(-2px) rotate(45deg)}

  /* 报告统一为标题信息、章节目录、正文的纵向阅读顺序。 */
  .layout{display:block;max-width:1280px;margin:20px auto;padding:24px;background:var(--paper);border-radius:16px}
  .report-cover{padding:0;margin:0 0 16px;border-radius:0;display:flex;align-items:baseline;flex-wrap:wrap;gap:12px}
  .report-cover h1{font-size:20px;margin:0}.report-cover .report-context{margin-left:auto}.report-cover .report-meta-line{flex-basis:100%;margin:0}
  .layout>aside{display:flex;position:sticky;top:0;z-index:5;gap:16px;flex-wrap:wrap;background:var(--paper);border-bottom:1px solid var(--line);padding:8px 0;margin-bottom:24px;max-height:none;overflow:visible}
  .nav-heading,.report-resizer{display:none}.nav-section>a{padding:8px 4px;border-radius:0}.case-nav{position:absolute;top:100%;left:0;right:auto;width:min(480px,100%);box-sizing:border-box;background:var(--paper);box-shadow:0 8px 28px rgb(0 0 0 / 12%);margin:0;padding:8px;border:1px solid var(--line);border-radius:8px;max-height:240px;overflow:auto}
  main>section:not(#details),#conclusion{padding:0;margin:0 0 28px;border-radius:0}.case{padding:16px 0;border-radius:0;border-bottom:1px solid var(--line)}.case:last-child{border-bottom:0}.counts{border-bottom:0;margin-bottom:0}
  main>section[tabindex="-1"]:focus,details.case[tabindex="-1"]:focus{outline:none}a[href],button,summary{cursor:pointer}button:disabled,[aria-disabled="true"]{cursor:not-allowed}html{scroll-padding-top:72px}html[data-embedded] body{background:white}html[data-embedded] .report-cover{display:none}html[data-embedded] .layout{margin:0;padding:0;border-radius:0}
  @media(max-width:600px){.layout{margin:8px;padding:16px}.layout>aside{gap:4px 16px}.report-cover h1{font-size:18px}}
  @media print{.layout{margin:0;padding:0}.layout>aside{display:none}}
  .case-progress{display:flex;flex-wrap:wrap;gap:0 6px;width:100%;margin:8px 0}.progress-segment{flex:1 0 18px;min-width:18px;display:block;padding:10px 0}.progress-segment>span{display:block;height:8px;background:#e2e5ed}.progress-segment:first-child>span{border-radius:4px 0 0 4px}.progress-segment:last-child>span{border-radius:0 4px 4px 0}.progress-segment:only-child>span{border-radius:4px}.progress-segment[data-status="running"]>span{background:var(--accent)}.progress-segment[data-status="passed"]>span{background:#35b889}.progress-segment[data-status="failed"]>span{background:#ef716b}.progress-segment[data-status="unknown"]>span{background:#e5af46}.progress-segment[data-status="cancelled"]>span{background:#a7afbf}.progress-segment:hover>span{filter:brightness(.85)}.counts>span{color:var(--ink)}.counts strong{color:inherit}.counts>.metric-zero{color:var(--muted)}.counts>.metric-failed{color:var(--eval-status-failed)}.counts>.metric-unknown{color:var(--eval-status-unknown)}.single-round{background:transparent;margin:8px 0}.single-round .round-body{padding:0}.single-round .standard{background:var(--soft)}
  </style><style>${extraStyles}</style></head><body><a class="skip-link" href="#conclusion">跳到报告正文</a><div class="layout"><header class="report-cover"><h1>${escape(run.name)}评测报告 ${escape(run.code || "")}</h1><p class="report-context">${escape(run.objectType === "agent" ? "智能体" : run.objectType === "skill" ? "技能" : "评测对象")}</p><div class="report-meta-line"><span class="muted">评测时间：${escape(stamp(run.started))}</span><span class="duration run-duration" title="${escape(runDurationNote)}">耗时：${escape(durationText(runDuration(run, durationNow)))}</span><span class="duration">${escape(pointsText(runPoints(run)))}</span></div></header><aside aria-label="报告目录"><div class="nav-heading"><strong>报告目录</strong></div>${reportSections.map(section => `<div class="nav-section"><a href="#${section.id}">${section.label}</a>${section.id === "details" ? `<button class="nav-toggle" aria-label="收起用例目录" aria-expanded="true" aria-controls="case-navigation">⌄</button>` : ""}</div>${section.id === "details" ? `<div class="case-nav" id="case-navigation">${run.results.map((r,i) => `<a href="#case-${i}" title="${escape([r.code, r.name].filter(Boolean).join(" "))}"><span class="case-nav-number"></span><span class="case-nav-name">${escape([r.code, r.name].filter(Boolean).join(" "))}</span><span>${escape(verdictLabel(r))}</span></a>`).join("")}</div>` : ""}`).join("")}</aside><div class="report-resizer" role="separator" tabindex="0" aria-label="调整报告目录宽度" aria-orientation="vertical" aria-valuemin="200" aria-valuemax="420" aria-valuenow="240" title="拖动调整目录宽度；方向键微调，双击复位"></div><main><section id="conclusion">
  <h2>一、评测结论</h2><div class="brief"><div class="brief-row"><span class="brief-key">总结</span><span class="brief-text">${escape(summary.title)}${runNote ? " · " + escape(runNote.slice(1)) : ""}</span></div><div class="brief-row"><span class="brief-key">意见</span><span class="brief-text">${escape(advice || summary.note || "暂无补充意见")}</span></div></div>${pending ? `<p role="status">${finishedCaseCount(run)} / ${run.results.length} 条用例已结束 · 最终结论待生成</p>` : ""}${!run.results.length ? `<p>本次没有用例结果</p>` : ""}<div class="summary-box"><div class="sb-row"><span class="sb-rate">${pending ? `已执行 ${executed}/${run.results.length}` : `${rateDone}%`}<small> ${pending ? "进度" : "通过率"}</small></span><div class="rsegbar" title="通过 ${counts[0].count} · 未通过 ${counts[1].count} · 无法判定 ${counts[2].count} · 未执行 ${remaining}"><div class="rp" style="width:${segW(counts[0].count)}"></div><div class="rf" style="width:${segW(counts[1].count)}"></div><div class="ru" style="width:${segW(counts[2].count)}"></div></div>${!pending && executed < run.results.length ? `<span class="rflag">部分案例</span>` : ""}${pending ? `<span class="muted">${runStatusLabels[run.status]}</span>` : ""}</div>${!pending && executed < run.results.length ? `<p class="sb-note">本次只执行 ${executed}/${run.results.length} 条用例，通过率按已执行用例计算；未执行用例不计入结果</p>` : ""}${pending ? `<p class="sb-note">结果不完整，不参与通过率对比${run.stopReason ? ` · 中断原因：${escape(run.stopReason)}` : ""}</p><div class="case-progress" aria-label="评测进度">${progressSegments}</div>` : ""}<div class="snap-line">用例集 ${escape(run.caseSnapshot?.version || "历史快照")}（共 ${run.results.length} 条） · 执行 ${escape(evaluationModelText(run.models?.execution))} · 评测 ${escape(evaluationModelText(run.models?.judging))} · 快照于 ${escape(stamp(run.started))} · <a href="#info">查看完整快照 ›</a></div></div></section>
  <section id="issues"><h2>二、问题清单</h2>${issueGroups.length ? `${pending ? `<p class="muted">报告未完成，以下问题仅基于已执行的 ${executedCount} 条用例</p>` : ""}${issueGroups.map(group => issueGroupHtml(group)).join("")}` : `<p class="empty">${pending ? "已完成结果中暂无问题，待其余用例完成判定" : "没有聚合出问题：本次没有不通过或无法判定的用例"}</p>`}</section>

  <section id="overview"><h2>三、用例概览</h2><div class="table-wrap" tabindex="0" role="region" aria-label="用例概览表格"><table><thead><tr><th>用例</th><th>轮次</th><th class="duration-cell" title="${escape(caseDurationNote)}">耗时</th><th>执行状态</th><th>判定</th></tr></thead><tbody>${run.results.map((r,i) => `<tr><td><a href="#case-${i}">${escape([r.code, r.name].filter(Boolean).join(" "))}</a></td><td>${turnsOf(r).length}</td><td class="duration-cell">${escape(durationText(caseDuration(r, run, durationNow)))}</td><td>${escape(executionLabel(r))}</td><td>${badge(verdictLabel(r))}</td></tr>`).join("")}</tbody></table></div></section>
  <section id="details"><div class="report-section-heading"><h2>四、详细结果</h2><div class="report-controls"><button data-cases="toggle" ${run.results.length ? "" : "disabled"}>${run.results.length && run.results.every(r => verdictLabel(r) !== "通过") ? "全部折叠" : "全部展开"}</button></div></div>${caseDetails || '<p class="empty">暂无用例结果</p>'}</section>
  <section id="info"><h2>五、报告信息</h2><h3>执行明细</h3><dl class="meta"><div><dt>评测对象</dt><dd>${escape(run.objectType === "agent" ? "智能体" : run.objectType === "skill" ? "技能" : "未记录类型")} · ${escape(run.name)}</dd></div><div><dt>评测时的对象版本</dt><dd>${escape(run.objectContentSummary || "未记录")}</dd></div><div><dt>来源运行</dt><dd>${escape(run.sourceRunId || "新评测")}</dd></div><div><dt>触发方式</dt><dd>${run.sourceRunId ? "重新执行（沿用来源报告的用例快照）" : "手动执行"}</dd></div><div><dt>执行人</dt><dd>${escape(run.executor || "未记录")}</dd></div><div><dt>基线关系</dt><dd>${escape(options.baselineLabel ? `对比基线 ${options.baselineLabel}` : "未设置基线")}</dd></div><div><dt>开始时间</dt><dd>${escape(stamp(run.started))}</dd></div><div><dt>结束时间</dt><dd>${run.ended !== undefined ? escape(stamp(run.ended)) : pending ? "未结束" : "未记录"}</dd></div><div><dt>执行模型</dt><dd>${escape(evaluationModelText(run.models?.execution))}</dd></div><div><dt>判定模型</dt><dd>${escape(evaluationModelText(run.models?.judging))}</dd></div><div><dt>运行状态</dt><dd>${runStatusLabels[run.status]}</dd></div><div><dt>评测用例</dt><dd>${run.results.length} 条</dd></div><div class="wide"><dt>点数来源</dt><dd>${escape(pointsSourceText(run) || "未记录")}</dd></div><div class="wide"><dt>点数更新时间</dt><dd>${run.pointsQuery?.queriedAt ? escape(stamp(run.pointsQuery.queriedAt)) : "未记录"}</dd></div><div class="wide"><dt>点数说明</dt><dd>${escape(pointsScopeNote)}</dd></div><div class="wide"><dt>运行编号</dt><dd>${escape(run.id)}</dd></div></dl><h3>被测配置快照</h3>${snapshotHtml(snapshot)}<h3>原始日志</h3><p class="muted">由执行记录整理；缺失时间显示 --:--:--，不补造工具调用。</p><pre class="report-log">${escape(logLines.join("\n"))}</pre></section>
  </main></div><script>document.addEventListener("click",function(e){var b=e.target.closest("[data-cases],[data-rounds]");if(b){var scope=b.hasAttribute("data-cases")?document:b.closest(".case");var items=Array.from(scope.querySelectorAll(b.hasAttribute("data-cases")?"details.case":"details.round")),open=!items.every(function(d){return d.open;});items.forEach(function(d){d.open=open;});syncControls();}var a=e.target.closest('a[href^="#"]');if(a){var t=document.getElementById(a.getAttribute("href").slice(1));if(t){e.preventDefault();if(compactNav.matches)setNavOpen(false);if(t.matches("details"))t.open=true;t.scrollIntoView({block:"start"});t.tabIndex=-1;t.focus({preventScroll:true});}}});var handle=document.querySelector(".report-resizer"),layout=document.querySelector(".layout"),width=240,start=null;function setWidth(value){width=Math.max(200,Math.min(420,value));layout.style.setProperty("--nav-width",width+"px");handle.setAttribute("aria-valuenow",width);}handle.addEventListener("pointerdown",function(e){if(e.button!==0)return;start={x:e.clientX,width:width};handle.setPointerCapture(e.pointerId);e.preventDefault();});handle.addEventListener("pointermove",function(e){if(start)setWidth(start.width+e.clientX-start.x);});["pointerup","pointercancel","lostpointercapture"].forEach(function(type){handle.addEventListener(type,function(){start=null;});});handle.addEventListener("dblclick",function(){setWidth(240);});handle.addEventListener("keydown",function(e){var values={ArrowLeft:width-20,ArrowRight:width+20,Home:200,End:420};if(e.key in values){e.preventDefault();setWidth(values[e.key]);}});var navToggle=document.querySelector(".nav-toggle"),caseNav=document.querySelector(".case-nav");var compactNav=window.matchMedia("all");function setNavOpen(open){navToggle.setAttribute("aria-expanded",String(open));navToggle.setAttribute("aria-label",open?"收起用例目录":"展开用例目录");navToggle.textContent=open?"⌄":"›";caseNav.hidden=!open;}document.addEventListener("pointerdown",function(e){if(compactNav.matches&&!e.target.closest("aside"))setNavOpen(false);});document.addEventListener("keydown",function(e){if(compactNav.matches&&e.key==="Escape"&&!caseNav.hidden){setNavOpen(false);navToggle.focus();}});setNavOpen(!compactNav.matches);compactNav.addEventListener("change",function(){setNavOpen(!compactNav.matches);});navToggle.addEventListener("click",function(){setNavOpen(navToggle.getAttribute("aria-expanded")!=="true");});function trackNav(){var current="conclusion";document.querySelectorAll("main>section[id],details.case[id]").forEach(function(t){if(t.getBoundingClientRect().top<=100)current=t.id;});document.querySelectorAll("aside a").forEach(function(a){if(a.getAttribute("href")==="#"+current)a.setAttribute("aria-current","location");else a.removeAttribute("aria-current");});}window.addEventListener("scroll",trackNav,{passive:true});trackNav();function syncControls(){document.querySelectorAll("[data-cases],[data-rounds]").forEach(function(b){var all=b.hasAttribute("data-cases"),scope=all?document:b.closest(".case"),items=Array.from(scope.querySelectorAll(all?"details.case":"details.round"));b.textContent=items.length&&items.every(function(d){return d.open;})?"全部折叠":"全部展开";b.disabled=!items.length;});}document.addEventListener("toggle",syncControls,true);syncControls();</script><script>document.addEventListener("click",function(e){var sc=e.target.closest("[data-scene]");if(sc&&sc.closest(".esc-wrap")){var w=sc.closest(".esc-wrap"),si=sc.getAttribute("data-scene");w.querySelectorAll(".esc-tab").forEach(function(b){b.classList.toggle("on",b===sc);});w.querySelectorAll(".esc-pane").forEach(function(pa){pa.hidden=pa.getAttribute("data-pane")!==si;});}var t=e.target.closest("[data-cktgl]");if(t){var p=t.parentElement;if(p)p.classList.toggle("open");}var m=e.target.closest("[data-more]");if(m){var out=m.previousElementSibling;if(out&&out.classList.contains("clip")){var open=out.classList.toggle("open");m.textContent=open?"收起全文":"展开全文";}}var h=e.target.closest("[data-trace]");if(h){h.parentElement.classList.toggle("open");}});</script></body></html>`
}

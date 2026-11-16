import { Marked } from "marked"
import chartLibrary from "./foundation-chart-library.json"
import { reportRuntime, runtimeIntegrity } from "./foundation-report-runtime"
import { foundationReportStyle } from "./foundation-report-style"
import {exportText} from "./export-text"
import {metrics,qualitySections,type Quality,type Observation} from "./quality-report"
import { caseOutcome, outcomeLabels, scoringLabels, scoringStatus } from "./outcome"
import { evaluationTime, evaluationCaseTitle, evaluationCaseCode, evaluationExecutionReason } from "./presentation"
import { evidenceFields, unexpectedClarificationText } from "./evidence-fields"
type Criterion = {
  id: string
  kind: string
  description?: string
  mode?: string
  values?: string[]
  pattern?: string
  path?: string
}
export type ReportHtmlData = {
  concurrency?: number
  code: string
  sourceAppVersion?: string
  datasetName?: string
  targetKind?: "skill" | "agent"
  generatedAt?: number
  mode?: string
  sourceRunId?: string
  state: string
  revision: number
  scoringPolicy?: {version:string}
  startedAt: number
  endedAt?: number
  lastActivityAt?: number
  executionModel: { name: string }
  judgeModel: { name: string }
  intervals: { kind: string; start: number; end?: number; startEstimated?: boolean }[]
  billing: { knownTotal: number | null; complete: boolean; breakdown?: { execution?: number; judgment?: number } }
  attachmentNames?: Record<string, string>
  cases: {
    code: string
    sessionId?: string
    state: string
    reason?: string
    qualityElapsedMs?:number
    executionCredits?:number
    quality?:Quality
    clarificationDiagnostics?: unknown[]
    startedAt?: number
    endedAt?: number
    content: {
      name: string
      externalCaseId?: string
      attachments: string[]
      criteria: Criterion[]
      turns: {
        input: string
        sourceFields?: Record<string, string>
        attachments: string[]
        criteria: Criterion[]
        clarifications: { question: string; answers: (string | string[])[] }[]
      }[]
    }
    results?: { criterionId: string; reason: string; fileEvidence?: { path: string; checkedAt: number }; actualResult?: string; evidenceSummary?: string; evidenceRefs: string[] }[]
    evidence: {
      id: string
      turn: number
      artifacts?:{id?:string;path:string;text?:string;reason?:string}[]
      observation?:Observation
      reply: string | null
      complete: boolean
      endReason?: string
      error?: string
      input?: string
      records: { id: string; kind: string; value: unknown }[]
    }[]
  }[]
}
const escape = (value: unknown) =>
  exportText(String(value ?? "")).replace(
    /[&<>"']/g,
    (value) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[value]!,
  )
const reportMarkdown = new Marked({
  renderer: {
    html(token) { return escape(token.text) },
    link(token) { return this.parser.parseInline(token.tokens) },
    image(token) { return escape(token.text) },
  },
})
const labels: Record<string, string> = {
  ended: "已结束",
  pending: "待执行",
  running: "运行中",
  judging: "判定中",
}
export function evaluationReportHtml(
  run: ReportHtmlData,
  name = "",
  translate: (value: string) => string = (value) => value,
  language = "zh-CN",
) {
  if (run.state !== "ended") throw new Error("EVALUATION_REPORT_NOT_FINAL")
  return evaluationReportPreviewHtml(run, name, translate, "standalone", language)
}

export function evaluationReportPreviewHtml(
  run: ReportHtmlData,
  name = "",
  translate: (value: string) => string = (value) => value,
  placement: "standalone" | "embedded" = "standalone",
  language = "zh-CN",
) {
  const live = run.state !== "ended"
  const completed = run.cases.filter(item => item.state === "ended").length
  const stage = (item: ReportHtmlData["cases"][number]) =>
    item.state === "judging" && item.quality?.status === "pending" ? "评分中" : labels[item.state] ?? item.state
  const t = (value: string) => escape(translate(value))
  const outcomeTag = (item: ReportHtmlData["cases"][number]) => {
    const outcome = caseOutcome(item.quality)
    if (outcome === "unscored") {
      const status = scoringStatus(item)
      const active = live && item.state !== "ended" && status !== "scoring_failed"
      const label = status ? scoringLabels[status] : active ? stage(item) : scoringLabels.not_scored
      return `<span class="case-status ${status === "scoring_failed" ? "case-status-fail" : active ? "case-status-active" : "case-status-neutral"}">${t(label)}</span>`
    }
    return `<span class="case-status case-status-${outcome === "blocked" ? "env" : outcome}">${t(outcomeLabels[outcome])}</span>`
  }
  const blockBanner = (item: ReportHtmlData["cases"][number]) => {
    if (item.quality?.status !== "complete" || !item.quality.blocked) return ""
    return `<div class="env-block-banner"><div class="env-block-banner-title">${t("环境阻塞")}</div><div class="env-block-reason">${escape(
      item.quality.dimensions[0]?.reason ?? "",
    )}</div><div class="env-block-hint">${t("该用例因评测环境异常被强制归零，不代表被测对象的能力结论；恢复环境后请重跑该用例。")}</div></div>`
  }
  const attachments = (ids: string[], label: string) =>
    ids.length
      ? `<p class="muted">${t(label)} · ${ids.map((id, index) => escape(run.attachmentNames?.[id] ?? `${translate("附件")} ${index + 1}`)).join("、")}</p>`
      : ""
  const quality = qualitySections(run.cases,t,escape,translate)
  const sumComplete = (values: (number | undefined)[]) =>
    values.length && values.every(value => value !== undefined && Number.isFinite(value) && value >= 0)
      ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      : undefined
  const execution = run.mode === "rejudge" ? undefined
    : sumComplete(run.cases.map(item => item.evidence.length === item.content.turns.length && item.evidence.every(turn => turn.complete)
      ? metrics(item.evidence)[0] : undefined))
  const judgment = run.mode === "rejudge" ? undefined
    : sumComplete(run.cases.map(item => item.qualityElapsedMs))
  const ticking = live && run.endedAt === undefined && placement === "embedded"
  const end = run.endedAt ?? (ticking ? Date.now() : run.lastActivityAt)
  const elapsed = end !== undefined && end >= run.startedAt ? end - run.startedAt : undefined
  const duration = (value?: number) => value === undefined ? "-" : `${(value / 1000).toFixed(1)} ${t("秒")}`
  const totalDuration = ticking
    ? `<span data-elapsed-since="${escape(run.startedAt)}">${((elapsed ?? 0) / 1000).toFixed(1)}</span> ${t("秒")}`
    : duration(elapsed)
  const credits = (value?: number | null) => value?.toFixed(2) ?? "-"
  const field = (label: string, value: string | number) =>
    `<div><dt>${t(label)}</dt><dd>${value}</dd></div>`
  const totalTime = field("总耗时", totalDuration)
  const totalCredits = field("总点数", credits(run.billing.knownTotal) + (run.billing.knownTotal !== null && !run.billing.complete ? `<small>${t("统计未完整")}</small>` : ""))
  const executionTime = field("执行耗时", duration(execution))
  const executionCredits = field("执行点数", credits(run.billing.breakdown?.execution))
  const judgmentTime = field("判定耗时", duration(judgment))
  const judgmentCredits = field("判定点数", credits(run.billing.breakdown?.judgment))
  const targetType = run.targetKind ? t(run.targetKind === "skill" ? "技能" : "智能体") : ""
  const generatedAt = escape(evaluationTime(run.generatedAt ?? Date.now()))
  const metadata = `<div class="subtitle">${t("报告编号")}：${escape(run.code)} ｜ ${t("生成时间")}：${generatedAt} ｜ ${t("场景业务质量100分制（通用执行性能仅记录不评分）")}</div>
<div class="report-context">
  <dl class="report-fields">
    ${field("类型", targetType || "—")}
    ${field("并发数", run.concurrency ?? 1)}
    ${field("执行模型", escape(run.executionModel.name))}
    ${field("判定模型", escape(run.judgeModel.name))}
    ${totalTime}${executionTime}${judgmentTime}${totalCredits}${executionCredits}${judgmentCredits}
  </dl>
</div>`
  const reportHeading = [name.trim(), translate("评测报告")].filter(Boolean).join(" ")
  const title = `${reportHeading} ${run.code}`
  return `<!doctype html><html lang="${escape(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src '${chartLibrary.integrity}' '${runtimeIntegrity}'"><title>${escape(title)}</title><style>
${foundationReportStyle}
.main,.grid-2>* {min-width:0}
.main h1 {overflow-wrap:anywhere}
.report-context {margin-bottom:24px}
.report-fields {display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0}
.report-fields > div {
  display:flex;flex-wrap:wrap;align-items:baseline;gap:0 6px;box-sizing:border-box;max-width:100%;min-width:0;
  padding:4px 10px;border-radius:6px;background:var(--primary-tint)
}
.report-context dt {margin:0;color:var(--text-secondary);font-size:12px}
.report-fields dd {margin:0;color:var(--text);font-size:13px;font-weight:400;min-width:0;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.report-fields dd small {margin-inline-start:6px;font-size:12px;color:var(--text-secondary)}
.rule-section {margin:12px 0}
.rule-section > summary {display:flex;align-items:center;gap:10px;min-height:44px;list-style:none;cursor:pointer;font-size:15px;font-weight:600;padding:8px 0;scroll-margin-top:16px}
.rule-section[open] > summary {margin-bottom:8px}
.summary-heading {display:flex;align-items:center;gap:20px;margin-bottom:14px}
.summary-content {flex:1;min-width:0}
.summary-metrics {display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:6px;color:var(--text-secondary);font-size:13px}
.summary-metrics b {color:var(--primary);font-weight:500}
.summary-metrics .summary-performance b {color:inherit;font-weight:400}
.summary-metrics .summary-pass {color:var(--success)}
.summary-note {font-size:12px;color:var(--text-secondary)}
.summary-status {color:var(--text-secondary);font-size:13px}
.summary-pending {color:var(--text);font-weight:600}
.summary-findings {padding-left:20px}
.summary-findings li {margin:4px 0}
.report-issue-body {padding:0 14px 14px 46px;overflow-wrap:anywhere}
.report-issue-body div + div {margin-top:6px}
.strength-card-title,.strength-card-evidence {overflow-wrap:anywhere}
.strength-card-evidence a {color:var(--primary);text-decoration:underline}
@media(max-width:600px){.summary-heading{align-items:flex-start;gap:12px}.summary-metrics{gap:8px 14px}}
.io-label {display:block}
.dim-detail-table th:first-child,.dim-detail-table th:last-child{text-align:left}
.dim-detail-table th:first-child{min-width:110px}
.dim-detail-table th:nth-child(2),.dim-detail-table th:nth-child(3){min-width:45px}
.dim-detail-table th:nth-child(4){min-width:55px}
.dim-detail-table th:nth-child(5){min-width:40px}
.sidebar-title {padding:4px 16px 10px;color:var(--text);font-size:13px;font-weight:600}
.sidebar details + details {margin-top:4px}
.sidebar summary {display:flex;align-items:center;cursor:pointer;list-style:none;padding-inline:10px 6px}
.sidebar summary::-webkit-details-marker,.rule-section > summary::-webkit-details-marker,.case-header::-webkit-details-marker {display:none}
.sidebar summary::before,.rule-section > summary::before,.case-header::before {content:"";width:6px;height:6px;margin:0 5px;border:solid var(--text-secondary);border-width:0 1.5px 1.5px 0;transform:rotate(-45deg);flex:none}
.sidebar details[open]>summary::before,.rule-section[open]>summary::before,.case-card[open]>.case-header::before {transform:rotate(45deg)}
.sidebar summary > .toc-link {flex:1;min-width:0;margin:0;padding-inline:6px 8px;color:var(--text);font-weight:500}
.sidebar .toc-sub {padding-left:0}
.toc-tooltip {position:fixed;z-index:1000;box-sizing:border-box;width:max-content;max-width:min(440px,calc(100vw - 16px));padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--text);box-shadow:0 4px 16px #0002;font-size:13px;line-height:1.5;overflow-wrap:anywhere;pointer-events:none}
.sidebar a[aria-current="location"] {background:var(--primary-tint);color:var(--primary)}
.table-wrap {overflow:auto}
#rules .card {overflow-x:auto}
@media(max-width:900px){.case-header{flex-wrap:wrap}.case-session{max-width:100%;overflow-wrap:anywhere}.case-query{min-width:8em}.io-grid{grid-template-columns:1fr}.io-grid>*{min-width:0}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important}}
.case-card>summary {cursor:pointer;list-style:none}
.case-session-link:hover {text-decoration:underline}
.case-session-link:focus-visible {outline:2px solid var(--primary);outline-offset:2px}
.case-card[open]>.case-body {display:block}
.case-body dl,.meta {display:grid;grid-template-columns:max-content minmax(0,1fr);gap:4px 16px}
.case-body :is(dd,pre),.case-body .standard p {white-space:pre-wrap;overflow-wrap:anywhere}
.standard,.field {padding:10px 14px;margin:8px 0;background:var(--bg);border-radius:6px}
.case-meta,.muted,.meta {color:var(--text-secondary);font-size:13px}
.case-meta {margin-inline-start:auto}.status {margin-inline-start:8px}
.fail{color:var(--danger)}.unknown{color:var(--warning)}
a {color:var(--primary)}
a:focus-visible,summary:focus-visible {outline:2px solid var(--primary)}
.report-source {position:fixed;bottom:0;left:0;right:0;z-index:10;height:36px;display:flex;align-items:center;justify-content:center;gap:4px;background:var(--card-bg);border-top:1px solid var(--border);color:var(--text-secondary);font-size:12px}
.report-source strong {color:var(--primary);font-weight:500}
body {padding-bottom:36px}
.sidebar {height:calc(100vh - 36px)}
@media(max-width:900px){.sidebar{height:auto;max-height:50vh}}
.report-toc-fab {display:none}
@media(max-width:900px){
  .sidebar {
    position:fixed;inset:50% 12px auto auto;transform:translateY(-50%);
    width:auto;height:auto;max-height:none;display:block;padding:0;
    background:none;border:0;overflow:visible;
  }
  .sidebar-title {display:none}
  .report-toc-fab {
    display:flex;align-items:center;gap:7px;margin-inline-start:auto;min-height:44px;
    padding:8px 14px;border:1px solid color-mix(in srgb,var(--primary) 24%,var(--card-bg));
    border-radius:999px;background:var(--primary-tint);
    background:color-mix(in srgb,var(--primary-tint) 92%,transparent);
    color:var(--primary);backdrop-filter:blur(8px);
    cursor:pointer;font:inherit;font-weight:600;
  }
  .report-toc-fab:hover,.report-toc-fab[aria-expanded="true"] {
    background:color-mix(in srgb,var(--primary) 12%,var(--card-bg));
  }
  .report-toc-fab:focus-visible {outline:2px solid var(--primary);outline-offset:2px}
  .toc-sections {
    position:absolute;inset:auto 0 calc(100% + 8px) auto;
    width:min(320px,calc(100vw - 32px));max-height:calc(50vh - 44px);
    overflow:auto;padding:8px;background:var(--card-bg);border:1px solid var(--border);
    border-radius:12px;box-shadow:0 6px 24px #0002;
  }
  .report-toc-fab[aria-expanded="false"] + .toc-sections {display:none}
}
@media print{.report-source{position:static;margin-top:24px}body{padding-bottom:0}.sidebar{display:none}.main{margin-left:0}}
</style></head><body class="${placement} report-grade-theme"><nav class="sidebar" aria-label="${t("报告目录")}"><div class="sidebar-title">${t("报告目录")}</div><button class="report-toc-fab" type="button" aria-expanded="false" aria-controls="report-toc-sections"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 4h7M6 8h7M6 12h7M3 4h.1M3 8h.1M3 12h.1"/></svg>${t("目录")}</button><div class="toc-sections" id="report-toc-sections">${[
    ["conclusion","一、关键发现与改进建议",[["assessment","1.1 评测结论"],["issues","1.2 问题清单"],["strengths","1.3 优势亮点"]]],
    ["overview","二、评测概览",[["dimensions","2.1 各维度得分"],["radar","2.2 质量雷达与逐用例得分"],["metrics","全用例性能指标记录总表"]]],
    ["details","三、详细分析",[["case-details","3.1 逐例评测详情"],...run.cases.map((c,i)=>["case-"+i,evaluationCaseCode(c)+" "+c.content.name])]],
    ["rules","四、评分标准",[["scale","4.1 场景业务质量评分标尺"],["grades","4.2 等级评定规则"],["performance-rules","4.3 通用执行性能指标口径"]]]
  ].map(row=>{const [id,title,children]=row as [string,string,string[][]];return `<details open><summary><a class="toc-link" href="#${id}" title="${t(title)}">${t(title)}</a></summary><ul class="toc-sub">${children.map(([key,label])=>`<li><a class="toc-link" href="#${key}" title="${t(label)}">${t(label)}</a></li>`).join("")}</ul></details>`}).join("")}</div></nav><main class="main"><h1>${escape(reportHeading)}</h1>${metadata}<section id="conclusion"><h2>${t("一、关键发现与改进建议")}</h2><h3 id="assessment">1.1 ${t("评测结论")}</h3>${live ? `<p role="status">${t("已完成")} ${completed} / ${run.cases.length}${run.cases.filter(item => ["running", "judging"].includes(item.state)).map(item => ` · ${escape(evaluationCaseCode(item))} ${t(stage(item))}`).join("")}</p>` : ""}${quality.summary}</section><section id="issues"><h3>1.2 ${t("问题清单")}</h3>${quality.issues || `<p class="card muted">${t(live ? "评测进行中，问题清单持续更新" : run.cases.some(item => item.quality?.status === "complete") ? "本次未发现问题" : "暂无可用于分析的质量评分")}</p>`}</section><h3 id="strengths">1.3 ${t("优势亮点")}</h3>${quality.strengths}<section id="overview"><h2>${t("二、评测概览")}</h2>${quality.qualityOverview}${quality.performance}</section><section id="details"><h2>${t("三、详细分析")}</h2><h3 id="case-details">3.1 ${t("逐例评测详情")}</h3>${run.cases
    .map(
      (item, i) => {
        const stopped = item.evidence.find(evidence => evidence.endReason === "unexpected_clarification")
        const stopNote = stopped && (
          item.content.turns.length === 1
            ? item.quality?.status === "complete" && !item.quality.blocked
              ? t("第 1 轮，模型发起追问。本用例仅评测首轮，已根据追问内容和工具记录完成评分。")
              : t("第 1 轮，模型发起追问。本用例仅评测首轮。")
            : t(stopped.turn + 1 < item.content.turns.length
              ? "第 {round} 轮，模型发起追问。用例未配置应答，后续轮次未执行。补充应答后可重跑该用例。"
              : "第 {round} 轮，模型发起追问。用例未配置应答，本轮对话停在追问。补充应答后可重跑该用例。"
            ).replace("{round}", String(stopped.turn + 1))
        )
        const turnCount = item.content.turns.length
        const turnLabel = turnCount === 1 ? t("1 轮对话") : t("{count} 轮对话").replace("{count}", String(turnCount))
        return `<details class="case-card" id="case-${i}"><summary class="case-header"><span class="case-id">${escape(evaluationCaseCode(item))}</span>${item.sessionId && placement === "embedded" ? `<button type="button" class="case-session case-session-link" data-eval-session="${escape(item.sessionId)}" title="${escape(item.sessionId)}">${t("查看会话")}</button>` : ""}<span class="case-category">${turnLabel}</span><span class="case-query">${escape(item.evidence.find(evidence => evidence.turn === 0)?.input ?? item.content.turns[0]?.input ?? item.content.name)}</span><span class="case-score-area">${outcomeTag(item)}${item.quality?.status === "complete" ? `<span class="case-score-num">${item.quality.score}</span><span class="grade grade-${escape(item.quality.grade)}">${escape(item.quality.grade)}</span>` : ""}</span></summary><div class="case-body">${blockBanner(item)}<h4>① ${t("对话记录")}（${item.content.turns.length}${t("轮")}）</h4>${stopNote ? `<p>${stopNote}</p>` : item.reason && (!item.reason.startsWith("Error: EVALUATION_EXECUTION_FAILED") || item.evidence.length >= item.content.turns.length) ? `<p>${escape(evaluationExecutionReason(item.reason, translate))}</p>` : ""}${attachments(item.content.attachments, "会话附件")}${item.content.turns
          .map((turn, index) => {
            const evidence = item.evidence.find((e) => e.turn === index)
            const question = unexpectedClarificationText(evidence)
            const clarification = evidence?.records.map((record, recordIndex) => {
              if (record.kind !== "clarification") return ""
              const fields = evidenceFields(record.kind, record.value)
              const anchor = `record-${i}-${index}-${recordIndex}`
              if (!fields.length) return `<span id="${anchor}"></span>`
              return `<dl class="io-clarification" id="${anchor}">${fields.map(
                (field) => `<dt>${t(field.label)}</dt><dd>${escape(field.text || translate("（空回复）"))}</dd>`,
              ).join("")}</dl>`
            }).join("") ?? ""
            const artifacts = evidence?.artifacts?.map((a,n)=>`<details id="artifact-${i}-${index}-${n}"><summary>${escape(a.path)}</summary><pre>${escape(a.text ?? a.reason)}</pre></details>`).join("") ?? ""
            const executionFailure = index === item.evidence.length && item.reason?.startsWith("Error: EVALUATION_EXECUTION_FAILED")
              ? item.reason.slice("Error: ".length)
              : undefined
            const reply = evidence?.reply
            const output = evidence?.endReason === "placeholder_error"
              ? escape(translate("本轮未执行") + " · " + evidence.error)
              : executionFailure
              ? escape(executionFailure)
              : question && !reply?.trim()
                ? ""
                : reportMarkdown.parse(exportText(reply?.trim() ? reply : translate(
                    stopped && index > stopped.turn ? "本轮未执行" : evidence?.reply == null ? "回复未记录" : "（空回复）",
                  )), { async: false })
            const hasClarification = clarification.includes('<dl class="io-clarification"')
            const actual = hasClarification
              ? `<div class="io-clarification-group"><strong class="io-subtitle">${t("澄清过程")}</strong>${clarification}</div>${output ? `<div class="io-final-reply"><strong class="io-subtitle">${t("最终回复")}</strong>${output}</div>` : ""}`
              : clarification + output
            const expected = [...turn.criteria, ...(item.content.turns.length === 1 ? item.content.criteria : [])]
              .map(c => c.description || c.values?.join("、") || c.pattern || c.path)
              .filter(text => text?.trim()).map(escape)
            const configuredRules = (turn.clarifications ?? []).map(rule => {
              const answers = rule.answers.map(answer =>
                escape(Array.isArray(answer) ? answer.join(" & ") : answer),
              )
              const responses = answers.length > 1
                ? `<ol class="io-configured-answers">${answers.map(answer => `<li>${answer}</li>`).join("")}</ol>`
                : answers[0] ?? ""
              return `<dl class="io-clarification"><dt>${t("预期追问")}</dt><dd>${escape(rule.question)}</dd><dt>${t("答案")}</dt><dd>${responses}</dd></dl>`
            }).join("")
            const rules = configuredRules
              ? `<div class="report-standard"><strong>${t("澄清规则配置")}</strong><div class="io-text md-rendered">${configuredRules}</div></div>`
              : ""
            const materials = Object.entries(turn.sourceFields ?? {})
              .filter(([key]) => /^(session|turn):/.test(key))
              .map(([key, value]) => escape(key + " · " + value))
            const body = `<div class="round-title">第 ${index+1} 轮</div><div class="io-grid"><div class="io-block full-width"><strong class="io-label" id="record-${i}-${index}-${evidence?.records.findIndex(r=>r.kind==="input") ?? "input"}">${t("用户输入（对话脚本）")}</strong><div class="io-text">${escape(evidence?.input ?? turn.input)}</div></div>${expected.length ? `<div class="report-standard"><strong>${t("标准答案")}</strong><div class="io-text">${expected.join("\n")}</div></div>` : ""}${rules}${materials.length ? `<div class="io-block full-width"><strong class="io-label">${t("预期材料")}</strong><div class="io-text">${materials.join("\n")}</div></div>` : ""}${attachments(turn.attachments, "本轮附件")}<div class="io-block full-width"><strong class="io-label actual"${evidence?.records.some(r=>r.kind==="reply") ? ` id="record-${i}-${index}-${evidence.records.findIndex(r=>r.kind==="reply")}"` : ""}>${t("灵基实际输出")}（${t("第")} ${index+1} ${t("轮")}）</strong><div class="io-text md-rendered">${actual}</div></div></div>${artifacts}`
            return `<div class="case-round" id="turn-${i}-${index}">${body}</div>`
          })
          .join("")}${quality.detail(i)}</div></details>`
      },
    )
    .join(
      "",
    )}</section><section id="rules"><h2>${t("四、评分标准")}</h2>${quality.rules}</section></main><footer class="report-source"><span>${t("本报告由")}</span><strong>灵基Build${typeof run.sourceAppVersion === "string" && run.sourceAppVersion.trim() ? ` V${escape(run.sourceAppVersion.trim().replace(/^[vV]/, ""))}` : ""}</strong><span>${t("生成")}</span></footer><script type="text/javascript">${chartLibrary.source}</script><script type="text/javascript">${reportRuntime}</script></body></html>`
}

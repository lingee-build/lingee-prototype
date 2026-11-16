import { reportGradeStyle } from "./report-grade-style"

// 灵基 Build 报告样式，供内嵌报告和离线 HTML 共用。
export const foundationReportStyle = `:root {
  color-scheme: light dark;
  --primary: #2456cf;
  --success: #287554;
  --warning: #805617;
  --danger: #a03749;
  --bg: #f5f7fa;
  --summary-bg: #f0f6ff;
  --card-bg: #ffffff;
  --text: #17243a;
  --text-secondary: #526175;
  --border: #e2e9f1;
  --primary-tint: color-mix(in srgb, var(--primary) 7%, var(--card-bg));
  --success-tint: color-mix(in srgb, var(--success) 7%, var(--card-bg));
  --warning-tint: color-mix(in srgb, var(--warning) 8%, var(--card-bg));
  --danger-tint: color-mix(in srgb, var(--danger) 7%, var(--card-bg));
  --sidebar-w: 240px;
}
@media(prefers-color-scheme:dark) {
  :root {
    --primary:#a2c3ff; --success:#8ad7b5; --warning:#efb476; --danger:#ffa3af;
    --bg:#182230; --card-bg:#111a26; --summary-bg:#172b45; --text:#edf3fc; --text-secondary:#b4c4d8;
    --border:#314257;

  }
}
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif; background:var(--card-bg); color:var(--text); line-height:1.7; font-size: 14px; -webkit-font-smoothing: antialiased; }

/* ===== Sidebar ===== */
.sidebar {
  position: fixed; top: 0; left: 0; width: var(--sidebar-w); height: 100vh;
  background: var(--bg); border-right: 1px solid var(--border); overflow-y: auto;
  padding: 16px 0; z-index: 100;
}
.toc-list { list-style: none; }
.toc-item { margin: 0; }
.toc-link {
  display: block; padding: 6px 16px; font-size: 14px; color: var(--text-secondary);
  text-decoration: none; border-left: 3px solid transparent; transition: all 0.15s;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.toc-link:hover { color: var(--primary); background: var(--primary-tint); }
.toc-link.active { color: var(--primary); border-left-color: var(--primary); background: var(--primary-tint); font-weight: 600; }
.toc-sub { list-style: none; }
.toc-sub .toc-link { padding-left: 36px; font-size: 13px; }
.toc-sub .toc-sub .toc-link { padding-left: 52px; font-size: 12px; }
/* Collapsible sidebar sections */
.toc-parent-header { display: flex; align-items: center; }
.toc-parent-header .toc-link { flex: 1; }
.toc-toggle { cursor: pointer; width: 20px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--text-secondary); user-select: none; flex-shrink: 0; border-radius: 3px; transition: transform 0.2s; }
.toc-toggle:hover { background: var(--card-bg); color: var(--text); }
.toc-parent.collapsed > .toc-sub { display: none; }
.toc-parent.collapsed > .toc-parent-header > .toc-toggle { transform: rotate(-90deg); }

/* ===== Main ===== */
.main { margin-left:var(--sidebar-w);padding:16px clamp(22px,3.1vw,48px) 48px; }
h1 { font-size: clamp(22px, 3vw, 30px); font-weight: 650; margin-bottom: 8px; letter-spacing: -0.3px; }
.main > h1 { line-height: 1.3; }
h2 { font-size: 19px; font-weight: 700; margin: 24px 0 12px; scroll-margin-top: 16px; }
h3 { font-size: 15px; font-weight: 600; margin: 16px 0 10px; scroll-margin-top: 16px; }
h4 { font-size: 14px; font-weight: 700; margin: 18px 0 8px; color: var(--text); }
.subtitle { color: var(--text-secondary); font-size: 14px; margin-bottom: 16px; }
.meta-info { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; font-size: 13px; color: var(--text-secondary); }
.meta-info span { background: var(--primary-tint); padding: 4px 12px; border-radius: 6px; }

/* ===== Cards & Grid ===== */
.card {background:var(--card-bg);padding:16px 0;margin-bottom:20px}
.grid-2 { display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
.stat { text-align: center; padding: 16px; }
.stat-value { font-size: 36px; font-weight: 700; }
.stat-label { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }

/* ===== Grade badges ===== */
${reportGradeStyle}
.grade-none { background: transparent; color: var(--text); }
.grade-lg { display:inline-grid;place-items:center;min-width:64px;aspect-ratio:1;font-size:32px;padding:0 12px;border-radius:12px; }

/* ===== Tables ===== */
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { background: var(--bg); color: var(--text); padding: 10px 8px; text-align: center; border-bottom: 1px solid var(--border); font-weight: 600; }
td { padding: 8px; text-align: center; border-bottom: 1px solid var(--border); }
tr:hover { background: var(--bg); }
.total-row { border-top: 1px solid var(--border); font-weight: 700; background: var(--bg) !important; }
.chart-container { position: relative; }
.chart-container-centered { position: relative; margin-inline: auto; width: 100%; max-width: 420px; aspect-ratio: 1/1; }
#overview > .card, #radar > .card { padding-block: 0; margin-block: 0; }
#overview > :is(#dimensions, #radar) + * { margin-block-start: 20px; }
.metrics-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-block-start: 0; }

/* ===== Case cards ===== */
.case-card { background: var(--card-bg); border-radius: 10px; margin-bottom: 12px;  overflow: hidden; border: 1px solid var(--border); }
.case-header {
  display: flex; align-items: center; gap: 12px; padding: 14px 20px;
  cursor: pointer; user-select: none; transition: background 0.15s;
}
.case-header:hover { background: var(--bg); }
.case-id { font-weight: 500; color: var(--primary); min-width: 52px; flex-shrink: 0; }
.case-session { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: var(--bg); color: var(--text-secondary); border: 1px solid var(--border); font-family: 'Consolas', 'Monaco', monospace; flex-shrink: 0; user-select: text; }
.case-category { font-size: 12px; color: var(--text-secondary); flex-shrink: 0; }
.case-session-link { font-family: inherit; font-size: 12px; font-weight: 400; line-height: 1.7; padding: 2px 8px; border-radius: 4px; background: var(--primary-tint); color: var(--primary); border: 1px solid var(--border); flex-shrink: 0; }
.case-session-link { appearance: none; cursor: pointer; }
.case-query { flex: 1; font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.case-score-area { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.case-score-num { min-width: 3ch; text-align: end; font-weight: 700; font-size: 15px; }
.case-body { display: none; border-top: 1px solid var(--border); padding: 20px; background: var(--bg); }
.case-card.expanded .case-body { display: block; }
.case-body > h4:first-child { margin-top: 0; }

/* ===== Input/Output blocks ===== */
.io-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.io-block { min-width: 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--card-bg); }
.io-block.full-width, .io-grid > :not(.io-block) { grid-column: 1 / -1; }
.io-label { font-size: 12px; font-weight: 600; padding: 6px 12px; background: var(--primary-tint); color: var(--primary); border-bottom: 1px solid var(--border); }
.report-standard { min-width: 0; }
.report-standard > strong { display: block; margin-bottom: 8px; }
.report-standard .io-text { border: 1px solid var(--border); border-radius: 12px; background: var(--card-bg); max-height: none; overflow-wrap: anywhere; }
.io-label.actual { background: var(--primary-tint); color: var(--primary); }
.io-text { padding: 10px 12px; font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow: auto; }
.io-text.md-rendered { white-space: normal; }
.io-clarification { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 4px 12px; margin: 0; }
.io-clarification + .io-clarification { margin-top: 8px; }
.io-clarification dt { color: var(--text-secondary); }
.io-clarification dd { margin: 0; white-space: pre-wrap; }
.io-clarification-group { padding: 10px 12px; background: var(--bg); border-radius: 4px; }
.io-subtitle { display: block; margin-block-end: 6px; font-size: 12px; font-weight: 600; }
.io-text.md-rendered .io-configured-answers { margin: 0; }
.io-clarification-group .io-subtitle { color: var(--text-secondary); }
.io-final-reply { margin-block-start: 12px; padding-block-start: 10px; border-block-start: 1px solid var(--border); }
.io-text.md-rendered table { font-size: 12px; margin: 8px 0; }
.io-text.md-rendered th, .io-text.md-rendered td { padding: 4px 8px; }
.io-text.md-rendered p { margin: 6px 0; }
.io-text.md-rendered ul, .io-text.md-rendered ol { margin: 6px 0; padding-left: 20px; }
.io-text.md-rendered h1,.io-text.md-rendered h2,.io-text.md-rendered h3 { font-size: 14px; margin: 10px 0 4px; }
.io-text.md-rendered > :first-child { margin-block-start: 0; }
.io-text.md-rendered > :last-child { margin-block-end: 0; }
.io-text.md-rendered strong { font-weight: 700; }
.round-title { font-size: 13px; font-weight: 700; color: var(--primary); margin: 0 0 8px; padding-left: 8px; border-left: 3px solid var(--primary); }
.case-round + .case-round,
.case-round + .io-block,
.case-round > details { margin-top: 12px; }

/* ===== Dimension detail table ===== */
.dim-detail-table th { font-size: 12px; padding: 8px 6px; }
.dim-detail-table td { font-size: 12px; padding: 7px 6px; }
.dim-detail-table td.explanation { text-align: left; color: var(--text-secondary); max-width: 260px; }

/* ===== Deduction blocks ===== */
.deduction-block { border: 1px solid var(--border); border-radius: 8px; margin-bottom: 10px; overflow: hidden; background: var(--card-bg); }
.deduction-head { padding: 8px 12px; background: var(--bg); font-size: 13px; font-weight: 600; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; border-bottom: 1px solid var(--border); }
.deduction-head .score-chip { font-size: 12px; font-weight: 700; color: var(--primary); }
.deduction-body { padding: 10px 12px; font-size: 12.5px; line-height: 1.8; }
.deduction-explain { margin-bottom: 8px; color: var(--text); }
.deduction-item { padding: 6px 0; border-top: 1px dashed var(--border); }
.deduction-item.none { color: var(--success); border-top: 1px dashed var(--border); }
.deduct-badge { display: inline-block; padding: 1px 8px; border-radius: 4px; background: var(--danger-tint); color: var(--danger); font-size: 11px; font-weight: 700; border: 1px solid var(--border); margin-right: 6px; }
.deduct-point { font-weight: 600; }
.deduct-evidence { color: var(--text-secondary); margin-top: 2px; padding-left: 2px; }

/* ===== Perf record (record-only, no score) ===== */
.record-banner {
  display: inline-block; font-size: 12px; font-weight: 600; color: var(--warning);
  background: var(--warning-tint); border: 1px solid var(--border); border-radius: 4px; padding: 2px 10px; margin-left: 8px;
}
.perf-record-table td { font-size: 12px; padding: 5px 8px; text-align: left; }
.perf-record-table td.val { text-align: right; font-family: 'Consolas', 'Monaco', monospace; font-weight: 400; }
.perf-record-table tr:last-child td { background: var(--warning-tint); }

/* ===== Case-level issues ===== */
.case-issue { border-left: 3px solid var(--warning); background: var(--warning-tint); padding: 8px 12px; margin-bottom: 8px; border-radius: 0 6px 6px 0; font-size: 12.5px; line-height: 1.7; }
.case-issue.p0 { border-left-color: var(--danger); background: var(--danger-tint); }
.case-issue.p1 { border-left-color: var(--warning); background: var(--warning-tint); }
.case-issue.p2 { border-left-color: var(--primary); background: var(--primary-tint); }
.case-issue-title { font-weight: 600; margin-bottom: 2px; }
.case-issue-meta { color: var(--text-secondary); }

/* ===== Key Findings Section ===== */
.executive-summary {
  background:var(--summary-bg);
  border-radius:10px;
  padding:20px clamp(14px,2.4vw,26px); margin-bottom: 20px; font-size: 14px; line-height: 1.8; color: var(--text);
}
.priority-badge {
  display:inline-block;min-width:24px;flex:none;font-size:13px;font-weight:700;text-align:left;
}
.priority-P0,.chip-p0 {background:transparent;color:var(--grade-d)}
.priority-P1,.chip-p1 {background:transparent;color:var(--grade-c)}
.priority-P2,.chip-p2 {background:transparent;color:var(--grade-a)}
.issue-card {border-bottom:1px solid var(--border)}
.issue-card[open] {background:var(--bg)}
.issue-card-header {
  display:grid; grid-template-columns:24px minmax(0,1fr) 12px;
  align-items:start; column-gap:12px; padding:12px 10px;
  list-style:none; cursor:pointer;
}
.issue-card-header::-webkit-details-marker {display:none}
.issue-card-header:hover {background:var(--bg)}
.issue-card-header::after {
  content:""; width:6px; height:6px; margin-top:6px; justify-self:center;
  border-right:1px solid var(--text-secondary); border-bottom:1px solid var(--text-secondary);
  transform:rotate(45deg);
}
.issue-card[open] > .issue-card-header::after {margin-top:9px;transform:rotate(225deg)}
.issue-card-header:focus-visible {outline:2px solid var(--primary);outline-offset:-2px}
.issue-card-title {display:block;font-size:13px;font-weight:500;overflow-wrap:anywhere}
.issue-card-cases {display:block;margin-top:3px;font-size:12px;color:var(--text-secondary)}
.issue-card-case-code {display:inline-block;max-width:100%;overflow-wrap:anywhere}
.issue-card-body { display: none; border-top: 1px solid var(--border); padding: 16px 18px; background: var(--bg); font-size: 13px; line-height: 1.8; }
.issue-card.expanded .issue-card-body { display: block; }
.issue-detail-label { font-weight: 600; color: var(--text-secondary); margin-right: 4px; }
.issue-detail-row { margin-bottom: 8px; }

.strength-card {
  background: var(--success-tint); border: 1px solid var(--border); border-radius: 10px;
  padding: 16px 20px; margin-bottom: 12px;
}
.strength-card-title { font-size: 13px; font-weight: 600; color: var(--success); margin-bottom: 5px; }
.strength-card-evidence { font-size: 12px; color: var(--text-secondary); line-height: 1.6; }

.issue-stats { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.issue-stat-chip {
  padding: 4px 10px; border: 1px solid transparent; border-radius: 6px;
  background: var(--bg); color: var(--text); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer;
}
.issue-stat-chip.chip-p0 { background: var(--grade-d-bg); color: var(--grade-d); }
.issue-stat-chip.chip-p1 { background: var(--grade-c-bg); color: var(--grade-c); }
.issue-stat-chip.chip-p2 { background: var(--grade-a-bg); color: var(--grade-a); }
.issue-stat-chip:hover, .issue-stat-chip[aria-pressed="true"] { border-color: currentColor; }
.issue-stat-chip[aria-pressed="true"] { font-weight: 700; }

.case-status { font-size: 12px; font-weight: 500; white-space: nowrap; }
.case-status-pass { color: var(--success); }
.case-status-fail { color: var(--grade-d); }
.case-status-env { color: var(--grade-c); }
.case-status-active { color: var(--primary); }
.case-status-neutral { color: var(--text-secondary); }

/* ===== Environment block (env failure → all dimensions zeroed) ===== */
.env-block-badge {
  display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0;
  padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700;
  background: var(--danger-tint); color: var(--danger); border: 1px solid var(--border);
  white-space: nowrap;
}
.quality-warning {
  background: var(--danger-tint);
  border-radius: 6px;
  padding: 12px 16px;
  overflow-wrap: anywhere;
}
.quality-warning > strong { display: block; color: var(--danger); }
.quality-warning > p { margin: 4px 0 0; }
.quality-warning > .quality-warning-diagnostic { color: var(--text-secondary); font-size: 12px; }

.env-block-banner {
  background: var(--danger-tint); border: 1px solid var(--border); border-left: 4px solid var(--danger);
  border-radius: 6px; padding: 10px 14px; margin-bottom: 14px;
}
.env-block-banner-title { font-weight: 700; color: var(--danger); font-size: 13px; margin-bottom: 6px; }
.env-block-reason { font-size: 12.5px; color: var(--text); line-height: 1.7; margin-bottom: 6px; }
.env-block-signal {
  font-size: 12px; color: var(--text); padding: 3px 0 3px 10px;
  border-left: 2px solid var(--border); margin: 4px 0; word-break: break-all;
}
.env-block-hint { font-size: 11px; color: var(--text-secondary); margin-top: 6px; }
.env-block-chip {
  display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 3px;
  font-size: 10px; font-weight: 700; color: var(--danger);
  background: var(--danger-tint); border: 1px solid var(--border);
}

/* ===== Language mix alert ===== */
.lang-mix-badge {
  display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0;
  padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700;
  background: var(--danger-tint); color: var(--danger); border: 1px solid var(--border);
  white-space: nowrap;
}
.lang-mix-banner {
  background: var(--danger-tint); border: 1px solid var(--border);
  border-left: 4px solid var(--danger);
  border-radius: 6px; padding: 10px 14px; margin-bottom: 14px;
}
.lang-mix-banner-title { font-weight: 700; color: var(--danger); font-size: 13px; margin-bottom: 6px; }
.lang-mix-round-item {
  font-size: 12px; color: var(--text); padding: 3px 0 3px 10px;
  border-left: 2px solid var(--border); margin: 4px 0;
  word-break: break-all;
}
.lang-mix-section-label {
  font-size: 12px; font-weight: 700; color: var(--danger);
  margin: 8px 0 3px; padding-bottom: 2px;
  border-bottom: 1px dashed var(--border);
}
.lang-mix-hint { font-size: 11px; color: var(--text-secondary); margin-top: 6px; }
.lang-source-review-banner {
  background: var(--warning-tint); border: 1px solid var(--border);
  border-left: 4px solid var(--warning); border-radius: 6px;
  padding: 10px 14px; margin-bottom: 14px;
}
.lang-source-review-title { font-weight: 700; color: var(--warning); font-size: 13px; margin-bottom: 6px; }
.lang-source-review-item { font-size: 12px; color: var(--text); padding: 3px 0 3px 10px; border-left: 2px solid var(--border); margin: 4px 0; word-break: break-all; }

a {color:var(--primary);text-underline-offset:3px}
:focus-visible {outline:2px solid var(--primary);outline-offset:2px}
:is(table,.summary-metrics,.case-score-num,.report-context) {font-variant-numeric:tabular-nums}

.strength-card {background:var(--card-bg);border:0;border-bottom:1px solid var(--border);border-radius:0;padding-inline:0}
.toc-link {border-radius:6px;margin-inline:6px;border-left:0}
.toc-link:hover,.toc-link[aria-current="location"] {background:var(--primary-tint)}
.toc-link[aria-current="location"] {font-weight:600}
@media (max-width: 900px) {
  .sidebar { display: none; }
  .main { margin-left: 0; padding: 16px; }
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
  .io-grid { grid-template-columns: 1fr; }
}/* Evidence references remain inline with the excerpt. */
.evidence-citation { margin-inline-start: 3px; white-space: nowrap; }
.evidence-citation a { font-weight: 600; text-decoration: none; }
.evidence-citation a:hover, .evidence-citation a:focus-visible { text-decoration: underline; }
`

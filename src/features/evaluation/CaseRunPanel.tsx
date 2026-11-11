import { Fragment, useState } from "react"
import { useT } from "@/i18n"
import { checkDescription, checkKind, clarifyPickModes, clarifySceneNames, clarificationText, expectedResponseLabels, fileCheckTime, isClarifyTurn, overallCategories, responseText, sceneChecksOf, scenesOf, turnsOf, type CheckResult, type EvalAttachment, type EvalCheck, type EvalResult, type EvalTurnResult } from "@/services/evaluation"

const types = { natural: "语义判断", keyword: "关键词匹配", regex: "正则匹配", file: "文件存在性" }
const rvClass = { passed: "pass", failed: "fail", unknown: "unk", skipped: "skip" } as const
const rvIcon = { pass: "✓", fail: "✕", unk: "–", skip: "○" } as const
const rvText = { passed: "通过", failed: "不通过", unknown: "无法判定", skipped: "未执行" } as const
type RowVerdict = keyof typeof rvClass

function rvPill(verdict: RowVerdict) {
  return <span className={`erv ${rvClass[verdict]}`}>{rvIcon[rvClass[verdict]]} {rvText[verdict]}</span>
}
function rowVerdict(result: CheckResult | undefined, judged: boolean): RowVerdict {
  if (!judged || !result) return "skipped"
  if (result.verdict === "passed" || result.verdict === "failed") return result.verdict
  return result.verdict === "skipped" ? "skipped" : "unknown"
}
function evBlock(label: string, text: string, bad: boolean, mut: boolean) {
  return <div className={`eev${bad ? " warn" : ""}${mut ? " mut" : ""}`}><span className="eevh">{label}</span><span className="eevt">{text || "未记录"}</span></div>
}
function attChips(files: EvalAttachment[] | undefined, label: string) {
  if (!files?.length) return null
  return <div className="euf"><span className="eulk">{label}</span><div><span className="eatt">{files.map(file => <span key={file.id}>{file.name}</span>)}</span></div></div>
}

/** 可折叠判定行：类型 + 判据（或期望 pill）× 结果 × 判断依据；失败/未判定默认展开。 */
function CheckRow({ check, result, judged, no, label }: { check: EvalCheck; result?: CheckResult; judged: boolean; no?: number; label?: string }) {
  const verdict = rowVerdict(result, judged)
  const [open, setOpen] = useState(verdict === "failed" || verdict === "unknown")
  const kind = checkKind(check)
  const text = kind === "natural" ? checkDescription(check) : check.text
  return <div className={`eck${verdict === "failed" ? " fail" : verdict === "unknown" ? " unk" : ""}${open ? " open" : ""}`}>
    <div className="eck1" data-cktgl={judged ? "" : undefined} onClick={judged ? () => setOpen(!open) : undefined}>
      {no !== undefined && <span className="ecnum">{no}</span>}
      {label && <span className="eflb">{label}</span>}
      {!label && <span className={`eckt ${kind === "natural" ? "s" : "d"}`}>{types[kind]}</span>}
      {!label && check.overall && <span className="erspv">{overallCategories[check.overall]}</span>}
      <span className={`ecked${kind === "regex" ? " mono" : ""}`}>{text}</span>
      {judged ? <>{rvPill(verdict)}<span className="ecar">▾</span></> : rvPill("skipped")}
    </div>
    {judged && <div className="eckm">
      {evBlock("实际结果", result!.actual, verdict === "failed", false)}
      {evBlock("判断依据", result!.evidence, verdict === "failed", !result!.evidence)}
      {kind === "file" && result!.fileEvidence && evBlock("产物检查", `路径 ${result!.fileEvidence.path} · ${result!.fileEvidence.exists ? "存在" : "不存在"} · 检查时点 ${fileCheckTime(result!.fileEvidence)}`, verdict === "failed", false)}
    </div>}
  </div>
}

/** 期望响应行：配置值 pill，原型执行器不做期望响应判定，不虚构结果。 */
function expectRow(turn: Pick<EvalTurnResult, "expectedResponse" | "rules">) {
  const clarify = isClarifyTurn(turn)
  return <div className="eck"><div className="eck1"><span className="eflb">期望响应</span><span className={`erspv${clarify ? " clarify" : ""}`}>{clarify ? expectedResponseLabels.clarify : expectedResponseLabels.output}</span></div></div>
}

/** 澄清校验前的模型输出：取实际澄清记录中的澄清提问内容（去掉记录前缀与「澄清选择」行）。 */
function clarifyAskText(turn: EvalTurnResult): string {
  const text = clarificationText(turn)
  const ask = text.split("\n澄清选择")[0].replace(/^(示例澄清提问|实际追问|澄清提问)：/, "").trim()
  return ask || text
}

/** 澄清场景页签：多个场景互为「或」，只执行命中的第一个，其余可切换查看预设。 */
function Scenes({ turn, skipped, stopWhy, output, tool, toolResult }: { turn: EvalTurnResult; skipped: boolean; stopWhy: string; output: string; tool?: string; toolResult?: string }) {
  const scenes = scenesOf(turn)
  const [active, setActive] = useState(0)
  if (!scenes.length) return null
  const running = turn.status === "pending" || turn.status === "running"
  const askText = clarifyAskText(turn)
  const pendingText = running ? "执行中，尚未产生输出" : `未执行 · 前序步骤${stopWhy}，按预设顺序终止，未产生输出`
  return <div className="esc-wrap">
    <div className="esc-tabs">{scenes.map((_, index) => <Fragment key={index}>
      {index > 0 && <span className="esc-or">或</span>}
      <button type="button" className={`esc-tab${index === active ? " on" : ""}`} onClick={() => setActive(index)}>场景{clarifySceneNames[index] || index + 1}</button>
    </Fragment>)}</div>
    {scenes.map((scene, index) => {
      const ran = index === 0 && !skipped && !running
      const askResult = scene.check ? turn.checkResults?.find(item => item.id === scene.check!.id) : undefined
      const sceneChecks = sceneChecksOf(turn, scene)
      return <div className="esc-pane" key={scene.id} hidden={index !== active}>
        {!ran && <p className="esc-note">{skipped ? `未执行 · 前序步骤${stopWhy}，按预设顺序终止` : running ? "" : index ? "本次执行未运行该场景" : ""}</p>}
        <ModelOut pending={!ran} pendingText={pendingText} text={askText} />
        <div className="eglab">澄清校验</div>
        {scene.check?.text.trim()
          ? <CheckRow key={scene.check.id} check={scene.check} result={askResult} judged={ran && !!askResult} label="澄清提问" />
          : <p className="esc-note">未配置澄清提问</p>}
        <div className="eck"><div className="eck1"><span className="eflb">澄清选择</span><span className="eckt d">{clarifyPickModes[scene.pickMode || "input"]}</span><span className="ecked">{scene.match}</span></div></div>
        <div className="eck"><div className="eck1"><span className="eflb">期望澄清后响应</span><span className={`erspv${scene.post === "clarify" ? " clarify" : ""}`}>{scene.post === "clarify" ? "继续澄清" : "内容输出"}</span></div></div>
        <ModelOut pending={!ran} pendingText={pendingText} text={output} tool={tool} toolResult={toolResult} />
        <div className="eglab">输出校验</div>
        {sceneChecks.length
          ? sceneChecks.map((check, j) => <CheckRow key={`${turn.id}:${scene.id}:${check.id}`} check={check} result={turn.checkResults?.find(item => item.id === check.id)} judged={ran && !!turn.checkResults?.some(item => item.id === check.id)} no={j + 1} />)
          : <p className="esc-note">未配置输出校验</p>}
      </div>
    })}
  </div>
}

/** 单轮时间线步骤：用户输入 → 模型输出（可展开全文/执行过程）→ 校验内容（期望响应 + 输出校验或场景页签）。 */
function RoundStep({ turn, index, stopWhy }: { turn: EvalTurnResult; index: number; stopWhy: string }) {
  const t = useT()
  const skipped = turn.status === "skipped"
  const running = turn.status === "pending" || turn.status === "running"
  const aggregate = turn.checkResults?.length ? turn.checkResults.reduce<RowVerdict>((state, item) => item.verdict === "failed" ? "failed" : item.verdict !== "passed" && state === "passed" ? "unknown" : state, "passed") : "unknown"
  const verdict: RowVerdict = skipped || running ? "skipped" : turn.status === "cancelled" ? "unknown" : aggregate
  const checks = checksList(turn)
  const results = turn.checkResults
  const failCount = results?.filter(item => item.verdict === "failed").length ?? 0
  const unknownCount = results?.filter(item => item.verdict !== "passed" && item.verdict !== "failed").length ?? 0
  const passCount = Math.max(checks.length - failCount - unknownCount, 0)
  const stat = skipped || running ? "未执行" : `${passCount}/${checks.length} 通过${failCount ? ` · ${failCount} 未通过` : ""}${unknownCount ? ` · ${unknownCount} 未判定` : ""}`
  const respText = turn.status === "pending" ? "待生成" : turn.status === "running" ? "生成中…" : responseText(turn, t)
  return <div className="estep">
    <div className={`esnode ${rvClass[verdict]}`} title={`第 ${index + 1} 步：${rvText[verdict]}`}>{verdict === "skipped" ? String(index + 1) : rvIcon[rvClass[verdict]]}</div>
    <div className="esbody">
      <div className={`erd${skipped || running ? " skip" : ""}`}>
        <div className="emhead"><span className="erole">第 {index + 1} 轮 · 用户输入</span><span className="err">{stat}</span></div>
        <div className="euf"><span className="eulk">固定输入</span><div className="eub"><div className="emtext">{turn.input || "（空）"}</div></div></div>
        {attChips(turn.attachments, "本轮背景知识")}
        <div className="eoslot">
          <div className="emhead"><span className="erole">校验内容</span></div>
          <div className="eob">
            {expectRow(turn)}
            {isClarifyTurn(turn)
              ? <Scenes turn={turn} skipped={skipped || running} stopWhy={stopWhy} output={respText} tool={turn.tool} toolResult={turn.toolResult} />
              : <>
                  <ModelOut pending={skipped || running} pendingText={running ? "执行中，尚未产生输出" : turn.evidence || `未执行 · 前序步骤${stopWhy}，按预设顺序终止，未产生输出`} text={respText} tool={turn.tool} toolResult={turn.toolResult} />
                  <div className="eglab">输出校验</div>
                  {checks.map((check, j) => <CheckRow key={`${turn.id}:${check.id}`} check={check} result={results?.find(item => item.id === check.id)} judged={!skipped && !running && !!results?.some(item => item.id === check.id)} no={j + 1} />)}
                </>}
          </div>
        </div>
      </div>
    </div>
  </div>
}

/** 校验模块前的模型输出块：澄清校验前为澄清提问内容，输出校验前为最终回复。 */
function ModelOut({ text, tool, toolResult, pending, pendingText }: { text: string; tool?: string; toolResult?: string; pending?: boolean; pendingText?: string }) {
  return <div className="emoslot">
    <div className="emhead"><span className="erole">模型输出</span></div>
    {pending ? <div className="eskipbox">{pendingText}</div> : <OutputText text={text} tool={tool} toolResult={toolResult} />}
  </div>
}

/** 模型输出：超过 110 字折叠 + 执行过程折叠。 */
function OutputText({ text, tool, toolResult }: { text: string; tool?: string; toolResult?: string }) {
  const [open, setOpen] = useState(false)
  const [traceOpen, setTraceOpen] = useState(false)
  const long = text.length > 110
  return <>
    <div className={`emout${long && !open ? " clip" : ""}`}>{text}</div>
    {long && <button type="button" className="ebmore" onClick={() => setOpen(!open)}>{open ? "收起全文" : "展开全文"}</button>}
    {!!tool && <div className="etrace">
      <button type="button" className="etrace-h" onClick={() => setTraceOpen(!traceOpen)}>执行过程 {traceOpen ? "▴" : "▾"}</button>
      {traceOpen && <div className="etrace-b" style={{ display: "block" }}><div><b>{tool}</b>{toolResult || "未记录工具返回"}</div></div>}
    </div>}
  </>
}

/** 整体校验步骤。 */
function OverallStep({ result }: { result: EvalResult }) {
  const checks = result.checks || []
  const results = result.checkResults
  const status: RowVerdict = !checks.length || result.status === "skipped" ? "skipped"
    : results?.some(item => item.verdict === "failed") ? "failed"
    : results === undefined || results.some(item => item.verdict !== "passed") ? "unknown" : "passed"
  return <div className="estep">
    <div className={`esnode ${rvClass[status]}`} title={`案例整体校验：${rvText[status]}`}>{status === "skipped" ? "◎" : rvIcon[rvClass[status]]}</div>
    <div className="esbody">
      <div className="eovrbox">
        <div className="eovr-h">案例整体校验</div>
        {checks.length ? checks.map(check => {
          const item = results?.find(entry => entry.id === check.id)
          const judged = result.status !== "skipped" && !!item
          const verdict = rowVerdict(item, judged)
          return <div className={`eovr-row${verdict === "failed" || verdict === "unknown" ? " open" : ""}`} key={check.id}>
            <div className="eovr-line" data-cktgl={judged ? "" : undefined} onClick={undefined}>
              <span className={`eckt ${checkKind(check) === "natural" ? "s" : "d"}`}>{types[checkKind(check)]}</span>
              {check.overall && <span className="erspv">{overallCategories[check.overall]}</span>}
              <span className="eov">{checkKind(check) === "natural" ? checkDescription(check) : check.text}</span>
              {judged ? <>{rvPill(verdict)}<span className="ecar">▾</span></> : rvPill("skipped")}
            </div>
            {judged && <div className="eckm">
              {evBlock("实际结果", item!.actual, verdict === "failed", false)}
              {evBlock("判断依据", item!.evidence, verdict === "failed", !item!.evidence)}
              {checkKind(check) === "file" && item!.fileEvidence && evBlock("产物检查", `路径 ${item!.fileEvidence.path} · ${item!.fileEvidence.exists ? "存在" : "不存在"} · 检查时点 ${fileCheckTime(item!.fileEvidence)}`, verdict === "failed", false)}
            </div>}
          </div>
        }) : <p className="esc-note" style={{ padding: "6px 0 10px" }}>本用例未配置整体校验</p>}
      </div>
    </div>
  </div>
}

function checksList(turn: EvalTurnResult) {
  return turn.checks !== undefined ? turn.checks : turn.expected.trim() ? [{ id: `${turn.id}-legacy`, text: turn.expected, required: true, files: [] }] : []
}

/** 报告用例结果的判定链视图：案例背景知识 + 时间线步骤 + 整体校验 + 操作；编号/名称/结论由外层头部展示。 */
export function CaseRunPanel({ result, onCaseAction }: {
  result: EvalResult
  onCaseAction?: (action: "rerun" | "edit", caseId: string) => void
}) {
  const rounds: EvalTurnResult[] = result.roundResults || turnsOf(result).map(turn => ({ ...turn, status: result.status, response: "", evidence: "历史运行未记录逐轮依据", clarification: "" }))
  const stopVerdict = rounds.find(turn => {
    if (turn.status === "skipped" || turn.status === "pending" || turn.status === "running") return false
    return (turn.checkResults || []).some(item => item.verdict !== "passed")
  })
  const stopWhy = stopVerdict && (turn => (turn.checkResults || []).some(item => item.verdict === "failed") ? "未通过" : "无法判定")(stopVerdict)
  const pending = result.status === "pending" || result.status === "running" || !!result.judging
  return <div className="ecr">
    {/* 编号、用例名称与判定结论由外层用例详情头部展示，此处不再重复。 */}
    {/* 案例背景知识与原「会话附件」为同一功能，统一以案例背景知识展示。 */}
    {attChips([...(result.background || []), ...(result.attachments || [])], "案例背景知识")}
    <div className="esteps">
      {rounds.map((turn, index) => <RoundStep key={turn.id} turn={turn} index={index} stopWhy={stopWhy || "未通过"} />)}
      <OverallStep result={result} />
    </div>
    {onCaseAction && !pending && <div className="epfoot">
      <button type="button" onClick={() => onCaseAction("rerun", result.id)}>重跑这条用例</button>
      <button type="button" onClick={() => onCaseAction("edit", result.id)}>去编辑用例</button>
    </div>}
  </div>
}

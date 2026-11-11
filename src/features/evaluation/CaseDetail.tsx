import { useState } from "react"
import { BrandButton } from "@/ui"
import { checkKind, checkDescription, checksOf, clarifyPickModes, clarifySceneNames, isClarifyTurn, sceneChecksOf, scenesOf, expectedResponseLabels, overallCategories, turnsOf, type EvalAttachment, type EvalCase, type EvalCheck, type EvalTurn } from "@/services/evaluation"
import { downloadAttachment } from "@/services/evaluation-attachments"

const names = { natural: "语义判断", keyword: "关键词匹配", regex: "正则匹配", file: "文件存在性" }

/** 附件以设计稿的芯片样式展示，点击下载。 */
function AttChips({ files, label }: { files: EvalAttachment[] | undefined; label: string }) {
  const [error, setError] = useState(false)
  if (!files?.length) return null
  return <div className="eval-uf"><span className="eval-ulk">{label}</span><div><span className="eval-att">{files.map(f => (
    <span key={f.id} role="button" tabIndex={0} title={error ? "附件无法读取" : "点击下载附件"} onClick={() => { setError(false); void downloadAttachment(f).catch(() => setError(true)) }}
      onKeyDown={e => { if (e.key === "Enter") { setError(false); void downloadAttachment(f).catch(() => setError(true)) } }}>{f.name}</span>
  ))}</span>{error && <span role="alert" className="eval-sc-note">附件无法读取</span>}</div></div>
}

/** 配置态校验行：类型标签 + 判据，无判定结果。 */
function checkRow(check: EvalCheck, no: number) {
  const kind = checkKind(check)
  const mono = kind === "regex"
  return <div className="eval-ck"><div className="eval-ck1">
    {no ? <span className="eval-cnum">{no}</span> : null}
    <span className={`eval-ckt ${kind === "natural" ? "s" : "d"}`}>{names[kind]}</span>
    {check.overall && <span className="eval-rspv">{overallCategories[check.overall]}</span>}
    <span className={`eval-cked${mono ? " mono" : ""}`}>{kind === "natural" ? checkDescription(check) : check.text}</span>
  </div></div>
}

/** 配置态期望响应：只展示配置值，不做判定；整行绿色底色。 */
function expectationRow(turn: EvalTurn, label = "期望响应") {
  const clarify = isClarifyTurn(turn)
  return <div className="eval-ck eval-exprow"><div className="eval-ck1"><span className="eval-flb">{label}</span>
    <span className={`eval-rspv${clarify ? " clarify" : ""}`}>{clarify ? expectedResponseLabels.clarify : expectedResponseLabels.output}</span>
  </div></div>
}

/** 场景内的第二次响应：内容输出 / 继续澄清；整行绿色底色与期望响应一致，标签居左、值徽章右对齐。 */
function postRow(post: "output" | "clarify" | undefined) {
  const clarify = post === "clarify"
  return <div className="eval-ck eval-exprow"><div className="eval-ck1"><span className="eval-flb">期望澄清后响应</span>
    <span className={`eval-rspv${clarify ? " clarify" : ""}`}>{clarify ? "继续澄清" : "内容输出"}</span>
  </div></div>
}

export function CaseDetail({ value, embedded = false, edit, editLabel = "编辑", editDisabled = false }: { value: EvalCase; embedded?: boolean; edit?: () => void; editLabel?: string; editDisabled?: boolean }) {
  const rounds = turnsOf(value)
  const [activeScenes, setActiveScenes] = useState<Record<string, number>>({})
  return <div className="eval-conversation eval-case-detail" aria-label="用例详情">
    {!embedded && <div className="eval-toolbar"><h3>{value.code} {value.name}</h3>{edit && <BrandButton variant="primary" disabled={editDisabled} onClick={edit}>{editLabel}</BrandButton>}</div>}
    {/* 案例背景知识与原「会话附件」为同一功能，统一以案例背景知识展示。 */}
    <AttChips files={[...(value.background || []), ...(value.attachments || [])]} label="案例背景知识" />
    {rounds.map((turn, i) => {
      const clarify = isClarifyTurn(turn)
      const scenes = scenesOf(turn)
      const active = Math.min(activeScenes[turn.id] || 0, Math.max(scenes.length - 1, 0))
      const turnChecks = [...checksOf(turn), ...(rounds.length === 1 ? value.checks || [] : [])]
      return <div className="eval-cd-rd" key={turn.id}>
        <div className="eval-mhead"><span className="eval-role">第 {i + 1} 轮 · 用户输入</span></div>
        <div className="eval-uf"><span className="eval-ulk">固定输入</span><div className="eval-ub" style={{ justifySelf: "start" }}><div className="eval-mtext">{turn.input}</div></div></div>
        <AttChips files={turn.attachments} label="本轮背景知识" />
        <div className="eval-oslot">
          <div className="eval-mhead"><span className="eval-role">校验内容</span></div>
          {clarify ? <>
            {expectationRow(turn)}
            <div className="eval-sc-wrap">
              <div className="eval-sc-tabs" role="tablist" aria-label={`第 ${i + 1} 轮澄清场景`}>
                {scenes.map((scene, si) => <span className="eval-sc-tabwrap" key={scene.id}>
                  {si > 0 && <span className="eval-sc-or">或</span>}
                  <button type="button" role="tab" aria-selected={si === active} className="eval-sc-tab" data-on={si === active || undefined} onClick={() => setActiveScenes(prev => ({ ...prev, [turn.id]: si }))}>场景{clarifySceneNames[si] || si + 1}</button>
                </span>)}
              </div>
              {scenes.map((scene, si) => <div className="eval-sc-pane" key={scene.id} hidden={si !== active}>
                <div className="eval-clrbox">
                  <div className="eval-glab">澄清校验</div>
                  {scene.check?.text.trim()
                    ? <div className="eval-ck"><div className="eval-ck1"><span className="eval-flb">澄清提问</span><span className={`eval-ckt ${checkKind(scene.check) === "natural" ? "s" : "d"}`}>{names[checkKind(scene.check)]}</span><span className={`eval-cked${checkKind(scene.check) === "regex" ? " mono" : ""}`}>{checkKind(scene.check) === "natural" ? checkDescription(scene.check) : scene.check.text}</span></div></div>
                    : <p className="eval-sc-note">未配置澄清提问</p>}
                  <div className="eval-ck"><div className="eval-ck1"><span className="eval-flb">澄清选择</span><span className="eval-ckt d">{clarifyPickModes[scene.pickMode || "input"]}</span><span className="eval-cked">{scene.match}</span></div></div>
                </div>
                {postRow(scene.post)}
                <div className="eval-glab">输出校验</div>
                <div className="eval-ob">{sceneChecksOf(turn, scene).length ? sceneChecksOf(turn, scene).map((check, j) => checkRow(check, j + 1)) : <p className="eval-sc-note">未配置输出校验</p>}</div>
              </div>)}
            </div>
          </> : <div className="eval-ob">
            {expectationRow(turn)}
            <div className="eval-glab">输出校验</div>
            {turnChecks.length ? turnChecks.map((check, j) => checkRow(check, j + 1)) : <p className="eval-sc-note">未配置输出校验</p>}
          </div>}
        </div>
      </div>
    })}
    {rounds.length > 1 && !!value.checks?.length && <div className="eval-ovrbox">
      <div className="eval-ovr-h">案例整体校验</div>
      {value.checks.map(check => <div className="eval-ovr-row" key={check.id}><div className="eval-ovr-line">
        <span className={`eval-ckt ${checkKind(check) === "natural" ? "s" : "d"}`}>{names[checkKind(check)]}</span>
        {check.overall && <span className="eval-rspv">{overallCategories[check.overall]}</span>}
        <span className="eval-eov">{checkKind(check) === "natural" ? checkDescription(check) : check.text}</span>
      </div></div>)}
    </div>}
  </div>
}

import { Button } from "@/ui"
import { resolveReportContext, compareReportText, reportEvidence } from "./report-context"
import { evaluationRepairObject, repairDisabledReason } from "@/services/evaluation-repair"
import { SessionPromptDock } from "@/pages/session/composer/SessionPromptDock"
import type { PromptDraft } from "@/features/prompt-input/PromptInput"
import { evaluationIntent, reportConversationText, reportRerunIds } from "./conversation-context"
import { useEffect, useRef, useState } from "react"
import { devStore } from "@/mock/dev-store"
import { db } from "@/mock/db"
import { sessionService } from "@/services/session"
import { useSync } from "@/stores/sync"
import { usePrompt } from "@/stores/prompt"
import { useSidebarActions } from "@/features/sidebar/use-sidebar-actions"
import { MessageTimeline } from "@/pages/session/timeline/MessageTimeline"
import { Composer } from "@/pages/session/composer/Composer"
import { saveEvaluationConversation, useEvaluationConversations, type EvaluationConversation } from "@/services/evaluation-conversations"
import { useEvaluation, requestCancelRun, failedRunResults, verdictLabel, isActiveRun, type EvalRun } from "@/services/evaluation"
import { saveAttachment } from "@/services/evaluation-attachments"
import type { Session, SyncEvent } from "@/mock/types"
import { respondToEvaluation } from "./conversation-response"

/** 评测只绑定对象和右侧内容；消息、输入、附件、模型及流式反馈复用开发会话。 */
export function EvaluationChat({ onNewConversation, objectId, name, sessionId, operation, currentRun, onRepair, onSession, onRun, onRerun, onLocate, onViewRun, onReports, readOnly, disabled, hidden, viewDraft }: {
  onNewConversation: () => void
  viewDraft: PromptDraft
  onRepair: (run: EvalRun) => void | Promise<void>
  objectId: string; name: string; sessionId?: string; operation: "cases" | "runs"; currentRun?: EvalRun; onSession: (id?: string) => void
  onRerun: (run: EvalRun, ids?: string[], sessionId?: string) => void; onLocate: (run: EvalRun, id: string) => void
  onReports: () => void; onRun: (all: boolean, ids?: string[], sessionId?: string) => void; onViewRun: (run: EvalRun) => void; readOnly: boolean; disabled: boolean; hidden?: boolean
}) {
  const hasCases = useEvaluation(s => !!s.cases[objectId]?.length)
  const saved = useEvaluationConversations(s => sessionId ? s.items[sessionId] : undefined)
  const conversation = saved?.objectId === objectId ? saved : undefined
  const liveSession = useSync(s => s.sessions.find(item => item.id === conversation?.session.id))
  const liveMessages = useSync(s => conversation ? s.messages[conversation.session.id] : undefined)
  const actions = useSidebarActions()
  const [error, setError] = useState("")
  const sending = useRef(false)
  const target = objectId.startsWith("skill:") ? devStore.skills.find(s => `skill:${s.id}` === objectId) : devStore.agents.find(a => `agent:${a.id}` === objectId)
  const projectId = target?.projectId || ""
  const session: Session = liveSession || conversation?.session || { id: `evaluation-${objectId}`, projectId, title: `评测 ${name}`, status: "idle", time: { created: 0, updated: 0 } }
  const messages = liveMessages || conversation?.messages || []
  async function submit(text: string, files: File[] = []) {
    text = text.replace(/^\/(?:evaluation-builder|evaluation-assistant|evaluation-case-designer)\s*/, "").trim()
    if (sending.current || session.status === "running") throw new Error("正在回复，请稍后再发送")
    if (disabled) { setError("请先保存或取消右侧编辑，再继续对话。"); throw new Error("当前不可修改") }
    // 输入草稿只保留内容；目标以发送时页面为准，显式 ER 由解析器优先处理。
    const activeContext = { runId: currentRun?.id, operation, readOnly }
    sending.current = true; setError("")
    try {
      if (!target || !useSync.getState().projects.some(p => p.id === projectId)) throw new Error("对象所属项目不可用，请恢复后重试。")
      const active = conversation?.session || await sessionService.create(projectId, `评测 ${name}`)
      const next: EvaluationConversation = structuredClone(conversation || { session: active, objectId, objectName: name, messages: [], request: "", rule: "", files: [], drafts: [], adopted: {} })
      delete next.runId
      next.drafts = structuredClone(useEvaluation.getState().cases[objectId] || [])
      next.adopted = {}; next.files = []
      for (const file of files) next.files.push(await saveAttachment(file))
      const intent = evaluationIntent(text)
      const runIntent = intent === "run" || intent === "rerun"
      const context = resolveReportContext(text, useEvaluation.getState().runs[objectId] || [], activeContext.runId, ["run", "rerun", "stop", "repair", "confirmRepair"].includes(intent) ? [] : conversation?.reportContext || [])
      const caseRequest = /(?:生成|新增|修改|改名|补充|设计|添加|删除).*(?:用例|标准|输入|轮次)|(?:用例|标准|输入|轮次).*(?:改为|改成|修改|补充)/.test(text) && intent === "cases"
      const wantsNewRun = intent === "run" && activeContext.operation === "cases" && !/ER-\d+|报告/.test(text)
      const reportIntent = !caseRequest && !wantsNewRun && (activeContext.operation === "runs" || intent === "report" || /ER-\d+|报告|对比|比较/.test(text))
      const needsReport = reportIntent || ['rerun', 'stop', 'repair', 'confirmRepair', 'repairStatus'].includes(intent)
      const reportRuns = needsReport ? context.runs : []
      const reportRun = reportRuns.length === 1 ? reportRuns[0] : undefined
      const reportError = needsReport ? context.error : undefined
      const actionAmbiguous = ['rerun', 'stop', 'repair', 'confirmRepair', 'run'].includes(intent) && reportRuns.length > 1
      const codes = [...new Set((text.match(/EC-\d+/gi) || []).map(code => `EC-${String(Number(code.slice(3))).padStart(4, "0")}`))]
      const scope = reportIntent ? reportRun?.results || [] : next.drafts
      const referenced = scope.filter(item => codes.includes(item.code || ""))
      const missing = codes.filter(code => !referenced.some(item => item.code === code))
      const referenceError = reportError || (missing.length ? `未找到评测用例 ${missing.join("、")}，请确认当前对象${reportIntent ? "及本次报告" : ""}中的编码。` : undefined)
      let action: (() => void) | undefined
      let response: { text: string; changed: boolean }
      const reply = (text: string) => ({ text, changed: false })
      const ordinal = text.match(/第\s*([一二三四五六七八九十]|\d+)\s*条/)
      const index = ordinal ? (/^\d+$/.test(ordinal[1]) ? Number(ordinal[1]) : '一二三四五六七八九十'.indexOf(ordinal[1]) + 1) - 1 : -1
      const located = codes.length ? referenced[0] : reportRun?.results[index]
      if (reportError) response = reply(reportError)
      else if (actionAmbiguous) response = reply('当前涉及多份报告，请指定要操作的一份报告（ER 编码）及范围，本次未执行操作。')
      else if (activeContext.readOnly && caseRequest) response = reply('历史用例快照不可修改，请返回评测用例页修改当前用例。')
      else if (reportRuns.length > 1 && reportIntent && !runIntent && intent !== 'help') response = reply(compareReportText(reportRuns))
      else if (referenceError) response = reply(referenceError)
      else if (intent === 'help') response = reply('本次未执行操作。可以查询进度、打开报告、停止运行、修复问题或重新运行；请明确要执行的操作。')
      else if (intent === 'repairStatus') response = reply(next.repair?.runId === reportRun?.id ? next.repair!.summary : '本次尚未发起修复，可以说“修复这次评测发现的问题”。')
      else if (intent === 'repair' || intent === 'confirmRepair' || (next.repair?.stage === 'planned' && intent === 'cases')) {
        const reason = reportRun ? repairDisabledReason(objectId, reportRun, !!evaluationRepairObject(objectId)) : '请先选择要修复的来源报告。'
        response = reply(reason || '正在打开修复会话并分析来源报告，确认方案后才修改对象。')
        if (!reason && reportRun) action = () => { void onRepair(reportRun) }
      }
      else if (intent === 'stop') {
        if (!reportRun) response = reply('请先选择要停止的运行。')
        else {
          if (isActiveRun(reportRun)) requestCancelRun(objectId, reportRun.id)
          response = reply(reportConversationText(useEvaluation.getState().runs[objectId]?.find(run => run.id === reportRun.id)))
        }
      } else if (runIntent) {
        const busy = useEvaluation.getState().runs[objectId]?.find(isActiveRun)
        const failedOnly = /未通过|不通过|失败|无法判定/.test(text)
        const ids = failedOnly && reportRun ? reportRerunIds(reportRun, text) : codes.length ? referenced.map(item => item.id) : undefined
        if (busy) response = reply('当前有评测正在运行，请等待结束或先停止本次运行。')
        else if ((intent === 'rerun' || failedOnly) && !reportRun) response = reply('请先选择要重新运行的来源报告。')
        else if (!reportRun && !ids && /选中|勾选|这些|这几条/.test(text)) response = reply('右侧勾选仅用于页面操作。请点击右侧“运行选中”，或在对话中指定用例编号。')
        else if (ids && !ids.length) response = reply('所选范围没有可运行的用例，本次未新建运行。')
        else if (reportRun) { response = reply('请确认重跑范围、用例版本及来源报告模型；确认后使用最新对象内容运行，原报告保留。'); action = () => onRerun(reportRun, ids, active.id) }
        else if (!next.drafts.length) response = reply('当前没有用例，请先生成或导入。')
        else { response = reply('请在运行设置中选择执行模型和判定模型，确认后启动评测。'); action = () => onRun(/全部/.test(text), ids, active.id) }
      } else if (reportIntent) {
        if ((ordinal || codes.length) && !located) response = reply('本次报告中没有找到指定用例，请确认序号或编码。')
        else if (located && reportRun) {
          response = reply(`${located.code} ${located.name}：${verdictLabel(located as EvalRun['results'][number])}。已在右侧定位结果。`)
          action = () => onLocate(reportRun, located.id)
        } else {
          response = reply(reportConversationText(reportRun))
          if (reportRun && /异常|为什么.*久/.test(text)) response.text += '\n\n' + (reportRun.stopReason || reportRun.results.filter(item => item.evidence).map(item => `${item.code}：${item.evidence}`).join('\n') || '当前尚无记录可解释原因，不能仅凭等待时间判断异常。')
          if (reportRun && /没通过|未通过|不通过|失败/.test(text)) {
            const failures = failedRunResults(reportRun)
            response.text += '\n\n' + (failures.map(item => `${item.code} ${item.name}：${item.evidence || "请查看逐项判定依据"}`).join('\n') || '当前尚无已判定不通过的用例。')
            action = () => failures.length ? onLocate(reportRun, failures[0].id) : onViewRun(reportRun)
          } else if (reportRun && /打开|查看|看看/.test(text)) action = () => onViewRun(reportRun)
          else if (!reportRun) action = onReports
        }
      } else response = respondToEvaluation(next, text)
      if (needsReport || runIntent) {
        const cited = !reportError && !actionAmbiguous ? reportRuns : []
        if (cited.length) {
          next.reportContext = cited.map(run => run.id)
          response.text = `引用报告：${cited.map(run => run.code || run.id).join('、')}。\n\n${response.text}`
        }
        next.reportTurns = [...(next.reportTurns || []), { id: crypto.randomUUID(), createdAt: Date.now(), prompt: text, source: context.source, reportIds: cited.map(run => run.id), reports: cited.map(reportEvidence), response: response.text }]
      } else if (caseRequest) next.reportContext = []
      saveEvaluationConversation(next, response.changed ? next.drafts : undefined)
      if (response.changed) {
        const savedCases = useEvaluation.getState().cases[objectId] || []
        const affected = savedCases.filter(item => !scope.some(old => old.id === item.id) || codes.includes(item.code || ""))
        if (affected.length) response.text += `\n\n${affected.map(item => `${item.code} ${item.name}`).join("\n")}`
      }
      // 兼容旧版评测消息，加入同一会话数据库后交给现有流式引擎。
      for (const message of next.messages) if (!db.messages.some(m => m.id === message.id)) db.messages.push(structuredClone(message))
      useSync.getState().apply({ type: "session.updated", session: active })
      useSync.setState(s => ({ messages: { ...s.messages, [active.id]: s.messages[active.id] || next.messages } }))
      onSession(active.id)
      const emit = (event: SyncEvent) => {
        useSync.getState().apply(event)
        const current = useEvaluationConversations.getState().items[active.id]
        if (!current) return
        const state = useSync.getState()
        const updated = { ...current, session: state.sessions.find(s => s.id === active.id) || active, messages: state.messages[active.id] || [] }
        if (!useEvaluationConversations.getState().put(updated)) setError("会话记录保存失败，请恢复本地存储后重试。")
      }
      sessionService.prompt(active.id, text, emit, usePrompt.getState().modelId, {
        todos: [], pacing: { textChunk: 12, textDelayMs: 16, textHoldMs: 0, toolDelayMs: 0, stepPauseMs: 0 },
        steps: [{ tools: [{ tool: "skill", title: "evaluation-builder", detail: `评测对象：${name}`, output: response.changed ? "用例已保存到当前列表" : runIntent ? "运行请求已处理" : reportIntent ? "已读取评测结果" : "等待补充评测需求" }], text: response.text }],
      })
      action?.()
    } catch (e) { setError(e instanceof Error ? e.message : "保存失败，请重试。"); throw e }
    finally { sending.current = false }
  }
  return <section aria-hidden={hidden} inert={hidden} data-collapsed={hidden || undefined} className="eval-native-session @container" aria-label="开发会话">
    <div className="flex-1 min-h-0 overflow-hidden">
      <MessageTimeline session={session} messages={messages} titleActions={<Button variant="ghost" className="eval-session-action" icon="play-circle" disabled={session.status === "running"} onClick={onNewConversation} aria-label="新建评测会话">新建会话</Button>} />
    </div>
    <SessionPromptDock>
      {error && <p role="alert" className="eval-field-error">{error}</p>}
      {(readOnly || disabled) && <p role="status" className="eval-muted">{disabled ? "请先完成右侧编辑或导入。" : "当前为历史用例快照，可继续分析报告；修改用例请返回当前用例页。"}</p>}
      <Composer viewDraft={viewDraft} key={objectId} defaultSkill="evaluation-builder" placeholder={operation === "cases"
        ? hasCases ? "描述你想修改或补充的评测用例…" : "描述业务场景，生成评测用例…"
        : currentRun ? "针对当前报告提问，例如：哪些用例未通过？" : "描述你想了解的评测结果，例如：对比最近两次报告"} projectId={projectId} sessionId={session.id} working={session.status === "running"} onSubmit={submit} onAbort={() => { if (sessionId) sessionService.abort(sessionId) }} onCreateProject={() => void actions.createProject()} />
    </SessionPromptDock>
  </section>
}

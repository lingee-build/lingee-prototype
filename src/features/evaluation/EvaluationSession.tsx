import { evaluationObjectUnavailable } from "@/services/evaluation"
import { useEffect, useRef, useState } from "react"
import { useBlocker, useNavigate } from "react-router"
import { useEvaluationConversations, addEvaluationDrafts, type EvaluationConversation } from "@/services/evaluation-conversations"
import { turnsOf, type EvalCase } from "@/services/evaluation"
import { saveAttachment } from "@/services/evaluation-attachments"
import { sessionService } from "@/services/session"
import { useSync } from "@/stores/sync"
import { usePrompt } from "@/stores/prompt"
import { useT } from "@/i18n"
import { NewSessionView } from "@/pages/session/NewSessionView"
import { SkillTabs } from "@/pages/session/SkillTabs"
import { RecommendationCards } from "@/pages/session/RecommendationCards"
import { PageActions } from "@/features/side-panel/PageActions"
import { PreviewPanel } from "@/features/side-panel/PreviewPanel"
import { usePanel } from "@/stores/panel"
import { useLayout } from "@/stores/layout"
import { db } from "@/mock/db"
import { devStore } from "@/mock/dev-store"
import type { Message } from "@/mock/types"
import { useSidebarActions } from "@/features/sidebar/use-sidebar-actions"
import { PromptInput } from "@/features/prompt-input/PromptInput"
import { MessageTimeline } from "@/pages/session/timeline/MessageTimeline"
import { Empty, Button, BrandButton, Icon, IconButton, ConfirmDialog, useDialog, RenderCard } from "@/ui"
import { ControlledConfirmDialog } from "@/ui/dialog/ConfirmDialog"
import { CaseDetail } from "./CaseDetail"
import { CaseEditor } from "./CaseEditor"
import { respondToEvaluation } from "./conversation-response"
import { Composer } from "@/pages/session/composer/Composer"
import { useCardActions } from "@/pages/session/timeline/use-card-actions"
import "./evaluation.css"

const activeGenerations = new Set<string>()

export function EvaluationSession({ projectId, sessionId, objectId }: { projectId: string; sessionId?: string; objectId: string }) {
  const stored = useEvaluationConversations(s => sessionId ? s.items[sessionId] : undefined)
  const [pending, setPending] = useState<EvaluationConversation>()
  const saved = stored || pending
  const [mode, id] = objectId.split(":")
  const objectName = saved?.objectName || (mode === "skill" ? devStore.skills.find(x => x.id === id)?.displayName : devStore.agents.find(x => x.id === id)?.name)
  const navigate = useNavigate()
  const dialog = useDialog()
  const sidebarActions = useSidebarActions()
  const [panel, setPanel] = useState(false)
  const t = useT()
  const setDraft = usePrompt(s => s.setDraft)
  const [skill, setSkill] = useState<string>("evaluation-case-designer")
  const previewOpen = usePanel(s => !!s.view)
  const sessionCollapsed = usePanel(s => s.sessionCollapsed) && previewOpen
  useEffect(() => {
    if (!sessionId && objectName) setDraft(`/evaluation-case-designer 为「${objectName}」生成评测用例`)
  }, [sessionId, objectName, setDraft])
  const openDrafts = () => { usePanel.getState().reset(); setPanel(true) }
  useEffect(() => { if (previewOpen) setPanel(false) }, [previewOpen])
  const [selected, setSelected] = useState<string[]>([])
  const [preview, setPreview] = useState<string>()
  const [editing, setEditing] = useState<EvalCase>()
  const dirty = !!editing && JSON.stringify(editing) !== JSON.stringify(saved?.drafts.find(c => c.id === editing.id))
  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])
  const [error, setError] = useState("")
  const submitting = useRef(false)
  const stopped = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stopped.current = true } }, [])
  useEffect(() => {
    if (!stored || stored.session.status !== "running" || activeGenerations.has(stored.session.id)) return
    const recovered = structuredClone(stored)
    recovered.session.status = "idle"
    recovered.messages.forEach(message => {
      if (message.role !== "assistant" || message.time.completed) return
      message.time.completed = Date.now()
      message.parts.forEach(part => { if (part.type === "tool" && part.state === "running") part.state = "error" })
      message.parts.push({ id: crypto.randomUUID(), type: "text", text: "上次生成已中断，已有草稿保留，请重新发送需求" })
    })
    try { publish(recovered) } catch { setError("会话恢复状态保存失败，已有草稿保留，请恢复存储后重试。") }
  }, [stored?.session.id])
  const cardActions = useCardActions(projectId)
  const [working, setWorking] = useState(false)
  const canAdd = (c: EvalCase) => !saved?.adopted[c.id]
  const selectable = (saved?.drafts || []).filter(canAdd)
  const openCases = () => navigate(`/dev/${mode}/${id}/evaluation`)
  const selectedCount = selectable.filter(c => selected.includes(c.id)).length
  function publish(value: EvaluationConversation, persist = true) {
    if (evaluationObjectUnavailable(objectId)) throw new Error("被测对象已删除或正在删除，不能保存草稿。")
    if (persist && !useEvaluationConversations.getState().put(value)) throw new Error("草稿保存失败，当前输入和已有草稿已保留，请恢复存储后重试。")
    if (!sessionId && mounted.current) setPending(value)
    db.sessions = [...db.sessions.filter(x => x.id !== value.session.id), value.session]
    db.messages = [...db.messages.filter(x => x.sessionId !== value.session.id), ...value.messages]
    useSync.getState().apply({ type: "session.updated", session: value.session })
    useSync.setState(s => ({ messages: { ...s.messages, [value.session.id]: value.messages } }))
  }
  async function submit(text: string, attachments: File[] = []) {
    if (evaluationObjectUnavailable(objectId)) { setError("被测对象已删除或正在删除，不能生成评测用例"); return }
    if (submitting.current || !objectName) return
    if (editing) { setError("请先保存或取消草稿修改，再继续对话"); throw new Error("草稿正在编辑") }
    let generationId: string | undefined
    submitting.current = true; stopped.current = false; setWorking(true); setError("")
    try {
      const files = await Promise.all(attachments.map(saveAttachment))
      if (evaluationObjectUnavailable(objectId)) throw new Error("被测对象已删除或正在删除")
      const current = sessionId ? useEvaluationConversations.getState().items[sessionId] : undefined
      const session = current?.session || await sessionService.create(projectId, `生成评测用例 · ${objectName}`)
      generationId = session.id
      activeGenerations.add(session.id)
      const next: EvaluationConversation = structuredClone(current || { session, objectId, objectName, messages: [], request: "", rule: "", files: [], drafts: [], adopted: {} })
      next.files.push(...files)
      const message = (role: "user" | "assistant", value: string): Message => ({ id: crypto.randomUUID(), sessionId: session.id, role, time: { created: Date.now(), completed: Date.now() }, parts: [{ id: crypto.randomUUID(), type: "text", text: value }] })
      next.messages.push(message("user", text))
      const response = respondToEvaluation(next, text)
      const assistant = message("assistant", "")
      assistant.time.completed = undefined
      assistant.parts = [{ id: crypto.randomUUID(), type: "tool", tool: "skill", title: "evaluation-case-designer", state: "running" }]
      next.messages.push(assistant)
      next.session.status = "running"
      const beforeDrafts = current?.drafts || []
      const progress = () => publish(structuredClone({ ...next, drafts: beforeDrafts, request: current?.request || "", rule: current?.rule || "" }))
      progress()
      await new Promise(resolve => setTimeout(resolve, 350))
      if (assistant.parts[0].type === "tool") assistant.parts[0].state = "completed"
      const output = { id: crypto.randomUUID(), type: "text" as const, text: "" }
      assistant.parts.push(output)
      for (let offset = 0; offset < response.text.length && !stopped.current; offset += 12) {
        output.text = response.text.slice(0, offset + 12)
        progress()
        await new Promise(resolve => setTimeout(resolve, 35))
      }
      if (stopped.current) {
        next.drafts = beforeDrafts
        next.request = current?.request || ""
        next.rule = current?.rule || ""
        output.text += "\n\n已停止生成，已有草稿保留"
      } else if (response.changed && next.drafts.length) {
        output.text += `\n\n:::render:evaluation-cases ${JSON.stringify({ title: `${objectName} · 用例草稿`, description: `${next.drafts.length} 条用例 · 查看与确认`, id: session.id })}:::`
      }
      assistant.time.completed = Date.now()
      next.session.status = "idle"
      next.session.time.updated = Date.now()
      publish(next)
      if (!sessionId && mounted.current) {
        useLayout.getState().expandGroup(projectId)
        navigate(`/p/${projectId}/session/${session.id}`, { replace: true })
      }
    } catch (e) {
      // 生成已经结束，即使存储不可用也不能让内存会话一直占用运行状态。
      const failed = generationId ? useEvaluationConversations.getState().items[generationId] : undefined
      if (failed && !evaluationObjectUnavailable(objectId)) {
        const recovered = { ...failed, session: { ...failed.session, status: "idle" as const } }
        useEvaluationConversations.setState(s => ({ items: { ...s.items, [recovered.session.id]: recovered } }))
        publish(recovered, false)
      }
      setError(e instanceof Error ? e.message : "发送失败，请重试"); throw e
    }
    finally { if (generationId) activeGenerations.delete(generationId); submitting.current = false; if (mounted.current) setWorking(false) }
  }
  function adopt() {
    if (!saved || working) return
    try {
      const next = addEvaluationDrafts(saved.session.id, selected)
      publish(next, false)
      setSelected([])
      setError("")
    } catch (e) { setError(e instanceof Error ? e.message : "加入用例失败，草稿和选择已保留，请重试。") }
  }
  function closeDrafts() {
    const close = () => { setPanel(false); setEditing(undefined); setPreview(undefined) }
    if (dirty) dialog.show(() => <ConfirmDialog title="放弃草稿修改？" description="未保存的修改将被丢弃" confirmText="放弃" cancelText="继续编辑" onConfirm={close} />)
    else close()
  }
  const viewed = saved?.drafts.find(c => c.id === preview)
  if (!objectName) return <div className="p-6">评测对象不存在<Button onClick={() => navigate(`/dev/${mode}`)}>返回</Button></div>
  return <div className="eval-authoring-session">
    <ControlledConfirmDialog open={blocker.state === "blocked"} title="放弃草稿修改？" description="离开后，未保存的修改将被丢弃" confirmText="放弃并离开" cancelText="继续编辑" onConfirm={() => { if (blocker.state === "blocked") blocker.proceed() }} onClose={() => { if (blocker.state === "blocked") blocker.reset() }} />
    {!panel && <PageActions inSession={!!sessionId} />}
    <div className="eval-authoring-body">
      <div className={`eval-authoring-chat ${saved ? "" : "eval-authoring-new"}`} style={previewOpen ? { flex: sessionCollapsed ? "0 0 0px" : "0 0 50%", visibility: sessionCollapsed ? "hidden" : undefined } : undefined}>
        {saved ? <div className="eval-authoring-timeline"><MessageTimeline session={saved.session} messages={saved.messages} footer={saved.drafts.length && !saved.messages.some(m => m.parts.some(p => p.type === "text" && p.text.includes(":::render:evaluation-cases"))) ? <RenderCard kind="evaluation-cases" config={{ title: `${objectName} · 用例草稿`, description: `${saved.drafts.length} 条用例 · 查看与确认` }} onCardClick={openDrafts} /> : undefined} onCardClick={(kind, config) => kind === "evaluation-cases" ? openDrafts() : cardActions(kind, config)} /></div> : <NewSessionView />}
        <div data-component="session-prompt-dock" className={saved ? "eval-authoring-composer" : "shrink-0 w-full px-6 md:px-0 md:max-w-[710px] md:mx-auto"}>
          {error && !panel && <p role="alert">{error}</p>}
          <div className="relative">{saved ? <Composer projectId={projectId} sessionId={saved.session.id} working={working} onSubmit={submit} onAbort={() => { stopped.current = true }} onCreateProject={() => void sidebarActions.createProject()} /> : <PromptInput projectId={projectId} sessionId={sessionId} working={working} onSubmit={submit} onAbort={() => {}} onCreateProject={() => void sidebarActions.createProject()} onSkillChange={value => setSkill(value || "")} />}
          {!saved && <SkillTabs onPick={name => setDraft(`/${name} `)} />}</div>
        </div>
        {!saved && <RecommendationCards skill={skill} onApply={setDraft} />}
        {!saved && <p className="absolute left-1/2 -translate-x-1/2 bottom-[10px] text-center text-12-regular text-[var(--neutral-400)]">{t("prompt.disclaimer")}</p>}
      </div>
      {!panel && <PreviewPanel projectId={projectId} sessionId={sessionId} working={working} />}
      {panel && <section className="eval-panel eval-authoring-drafts" aria-label="用例草稿">
        <header className="eval-draft-panel-header">
          <span className="eval-draft-object"><Icon name="drawer" size="small" /><span title={objectName}>{objectName}</span></span>
          <IconButton icon="close-small" variant="ghost" aria-label="关闭用例草稿" title="关闭" onClick={closeDrafts} />
        </header>
        {error && <p role="alert">{error}</p>}
        {editing || viewed ? <div className="eval-draft-detail-scroll">{editing ? <CaseEditor draft={editing} update={setEditing} editing cancel={() => {
          if (!dirty) { setEditing(undefined); return }
          dialog.show(() => <ConfirmDialog title="放弃草稿修改？" description="未保存的修改将被丢弃" confirmText="放弃" cancelText="继续编辑" onConfirm={() => setEditing(undefined)} />)
        }} save={value => {
          if (!saved) return
          if (useEvaluationConversations.getState().items[saved.session.id]?.adopted[value.id]) { setError("这条草稿已加入，请前往用例列表维护。"); return }
          try {
            publish({ ...saved, drafts: saved.drafts.map(c => c.id === value.id ? value : c) })
            setError(""); setEditing(undefined)
          } catch (e) { setError(e instanceof Error ? e.message : "草稿保存失败，当前编辑内容已保留，请重试。") }
        }} /> : viewed ? <><p className="eval-muted">{canAdd(viewed) ? "检查草稿后，可一次性加入用例列表。" : "这是加入时的草稿，后续修改请前往用例列表。"}</p><CaseDetail value={viewed} back={() => setPreview(undefined)} editDisabled={working && canAdd(viewed)} editLabel={canAdd(viewed) ? "编辑" : "前往用例列表"} edit={() => { if (!canAdd(viewed)) openCases(); else if (!working) setEditing(structuredClone(viewed)) }} /></> : null}</div> : <>
          <div className="eval-draft-heading"><h3>用例草稿 <span className="eval-section-count">{saved?.drafts.length || 0}</span></h3><Button variant="ghost" onClick={() => navigate(`/dev/${mode}/${id}/evaluation`)}>返回评测</Button></div>
          <p className="eval-muted eval-draft-note">草稿可一次性加入，加入后统一在用例列表维护。</p>
          <div className="eval-draft-list-scroll">
          {!!saved?.drafts.length && <div className="eval-selection-bar"><label className="eval-check">
            <input type="checkbox" aria-label="全选可加入的草稿" disabled={working || !selectable.length}
              checked={!!selectable.length && selectedCount === selectable.length}
              ref={node => { if (node) node.indeterminate = selectedCount > 0 && selectedCount < selectable.length }}
              onChange={e => setSelected(e.target.checked ? selectable.map(c => c.id) : [])} />
            全选
          </label></div>}
          {!saved?.drafts.length && <div className="eval-empty"><Empty description="生成的用例将在这里展示" /></div>}
          {saved?.drafts.map(c => <div className="eval-draft-card" key={c.id}><input type="checkbox" aria-label={`选择 ${c.name}`} disabled={working || !canAdd(c)} checked={selected.includes(c.id) && canAdd(c)} onChange={e => setSelected(ids => e.target.checked ? [...ids, c.id] : ids.filter(x => x !== c.id))} /><div className="eval-grow"><button className="eval-title" onClick={() => setPreview(c.id)}>{c.name}</button><p className="eval-muted" role="status">{turnsOf(c).length} 轮对话 · {canAdd(c) ? "待加入" : "已加入"}</p></div>{canAdd(c) ? <Button disabled={working} onClick={() => setEditing(structuredClone(c))}>编辑</Button> : <Button onClick={openCases}>前往用例列表</Button>}</div>)}
          </div>
          {!!saved?.drafts.length && <div className="eval-draft-footer"><span className="eval-muted" aria-live="polite">已选 {selectedCount} 条</span><BrandButton variant="primary" disabled={working || !selectedCount} onClick={adopt}>加入用例列表</BrandButton></div>}
        </>}
      </section>}
    </div>
  </div>
}

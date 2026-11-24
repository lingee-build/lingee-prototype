import { sessionService } from "@/services/session"
import { SessionPromptDock } from "./composer/SessionPromptDock"
import { useEvaluation } from "@/services/evaluation"
import { evaluationRepairTarget, useEvaluationRepairs } from "@/services/evaluation-repair"
import { useNavigate } from "react-router"
import { RenderCard, Button, showToast } from "@/ui"
import { EvaluationSession } from "@/features/evaluation/EvaluationSession"
import { saveEvaluationConversation, useEvaluationConversations } from "@/services/evaluation-conversations"
import { procurementPrompt } from "@/services/procurement"
import { guardUpgrade, legacySessions, useUpgradeStore } from "@/features/artifact-upgrade/UpgradeGate"
import { useEffect, useMemo, useRef, useState } from "react"
import { Navigate, useParams, useSearchParams } from "react-router"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { PromptInput } from "@/features/prompt-input/PromptInput"
import { PageActions } from "@/features/side-panel/PageActions"
import { PreviewPanel } from "@/features/side-panel/PreviewPanel"
import { useWorkflowLayout } from "@/features/workflow/layout-store"
import { useSidebarActions } from "@/features/sidebar/use-sidebar-actions"
import { usePanel } from "@/stores/panel"
import { usePrompt } from "@/stores/prompt"
import { devStore } from "@/mock/dev-store"
import { workflowService } from "@/services/workflow"
import { openWorkflowCanvas } from "@/features/workflow/open-canvas"
import { useSync } from "@/stores/sync"
import type { Message } from "@/mock/types"
import { Composer } from "./composer/Composer"
import { NewSessionView } from "./NewSessionView"
import { RecommendationCards } from "./RecommendationCards"
import { SkillTabs } from "./SkillTabs"
import { MessageTimeline } from "./timeline/MessageTimeline"
import { useSessionController } from "./use-session-controller"
import { sourceReplyOf, useEnvScenario } from "@/features/env-source/env-scenario"
import { ENV_SOURCE_SAMPLE_REPLY } from "@/mock/fixtures/env"

/** 右侧预览面板打开时，会话区收窄到这个宽度（对应原工程的 DEFAULT_SESSION_WIDTH） */
const SESSION_WIDTH = 600

/**
 * 会话页。同一路由承载两种形态：
 * - 没有 sessionId：新任务页（标语 + 输入框 + 技能入口 + 推荐模板）
 * - 有 sessionId：对话时间线 + 底部输入框
 */
export function Component() {
  const navigate = useNavigate()
  const repairLinks = useEvaluationRepairs(s => s.links)
  const deletedObjects = useEvaluation(s => s.deletedObjects)
  const evaluationSessions = useEvaluationConversations(s => s.items)
  const t = useT()
  const { projectId = "", sessionId } = useParams()
  const repairItems = useEvaluationRepairs(s => s.items)
  const repairTarget = sessionId ? evaluationRepairTarget(sessionId) : undefined
  const repairRun = useEvaluation(s => repairTarget ? s.runs[`${repairTarget.objectType}:${repairTarget.objectId}`]?.find(r => r.id === repairTarget.runId) : undefined)
  const [search] = useSearchParams()
  const returnParam = search.get("returnTo")
  const validReturn = repairTarget && returnParam?.startsWith(`/dev/${repairTarget.objectType}/${encodeURIComponent(repairTarget.objectId)}/evaluation?`) ? returnParam : undefined
  const returnUrl = validReturn || (sessionId ? repairLinks[sessionId] : undefined)
  const openRepairReport = () => {
    if (!repairTarget || !repairRun) return
    usePanel.setState({
      view: "drawer",
      drawer: { kind: repairTarget.objectType === "skill" ? "kdskill" : "agentConfig", id: repairTarget.objectId, title: repairRun.name },
      evaluationReport: { objectId: `${repairTarget.objectType}:${repairTarget.objectId}`, runId: repairRun.id, requestId: Date.now() },
    })
  }
  const retestUrl = returnUrl ? `${returnUrl}&action=retest` : undefined
  const editing = { kdskill: search.get("kdskill"), agent: search.get("agent"), mcpapp: search.get("mcpapp"), workflow: search.get("workflow") }
  const { ready, projects, sessions, messages, loadMessages } = useSync()
  const setDraft = usePrompt((s) => s.setDraft)
  const actions = useSidebarActions()
  const controller = useSessionController(projectId, sessionId)
  const [skill, setSkill] = useState<string>()
  // 新任务页没有审查视图，此时面板视为收起
  const previewOpen = usePanel((s) => !!s.view && (s.view !== "review" || !!sessionId))
  // 工作流画布：会话、画布、右栏默认 1:1:1，分隔线可以拖动（比例记在 workflow layout store；右栏收起时画布占满剩余宽度）
  const workflowOpen = usePanel((s) => s.view === "drawer" && s.drawer?.kind === "workflow")
  const workflowChat = useWorkflowLayout((s) => s.chat)
  const resizing = useWorkflowLayout((s) => s.dragging)
  const sessionCollapsed = usePanel((s) => s.sessionCollapsed) && previewOpen
  const session = sessions.find((x) => x.id === sessionId)
  const upgraded = useUpgradeStore((s) => s.upgraded)
  useEffect(() => {
    const ids = [...(legacySessions[sessionId ?? ""] ?? []), editing.agent ?? "", editing.kdskill ?? "", editing.mcpapp ?? ""]
    guardUpgrade(ids, () => {})
  }, [sessionId, editing.agent, editing.kdskill, editing.mcpapp, upgraded])
  useEffect(() => {
    if (!sessionId || !session || !messages[sessionId]) return
    const item = useEvaluationRepairs.getState().items[sessionId]
    if (item) useEvaluationRepairs.setState(s => ({ items: { ...s.items, [sessionId]: { ...item, session, messages: messages[sessionId] } } }))
  }, [sessionId, session, messages])
  const loaded = sessionId ? messages[sessionId] : undefined
  // 会话内来源告知样例（US-2026-043955 功能点 1 顺带告知）：预置样例回复按当前演示场景实时替换（?env-scenario= 直达切换，见 env-scenario.ts）
  const scenario = useEnvScenario()
  const timeline = useMemo(() => {
    if (!loaded) return loaded
    const hasSample = (m: Message) => m.parts.some((p) => p.type === "text" && p.text === ENV_SOURCE_SAMPLE_REPLY)
    if (!loaded.some(hasSample)) return loaded
    const reply = sourceReplyOf(scenario)
    return loaded.map((m) =>
      hasSample(m)
        ? { ...m, parts: m.parts.map((p) => (p.type === "text" && p.text === ENV_SOURCE_SAMPLE_REPLY ? { ...p, text: reply } : p)) }
        : m,
    )
  }, [loaded, scenario])
  const anchor = search.get("message")
  useEffect(() => {
    if (!anchor || !loaded?.some(message => message.id === anchor)) return
    const frame = requestAnimationFrame(() =>
      document.querySelector(`[data-message="${CSS.escape(anchor)}"]`)?.scrollIntoView({ block: "center" }))
    return () => cancelAnimationFrame(frame)
  }, [anchor, loaded])

  const openingEvaluation = useRef(false)
  async function openEvaluationFromTest(anchorMessageId: string) {
    if (!session?.localTest || openingEvaluation.current) return
    const objectId = session.localTest.objectId
    const [kind, id] = objectId.split(":")
    const object = kind === "skill" ? devStore.skills.find(item => item.id === id)?.displayName : devStore.agents.find(item => item.id === id)?.name
    if (!object) return
    openingEvaluation.current = true
    let createdId: string | undefined
    try {
      const existing = Object.values(useEvaluationConversations.getState().items).find(value =>
        value.objectId === objectId && value.testSources?.some(source => source.sessionId === session.id))
      const evaluation = existing?.session ?? await sessionService.create(projectId, `评测 ${object}`)
      if (!existing) createdId = evaluation.id
      const messages = loaded?.map(message => ({
        ...message, parts: message.parts.filter(part => part.type === "text" || part.type === "tool" && (part.tool === "mcp" || part.tool === "question")),
      }))
      const source = { sessionId: session.id, projectId, title: session.title, anchorMessageId, session, messages }
      const sources = [...(existing?.testSources ?? []).filter(item => item.sessionId !== session.id), source]
      saveEvaluationConversation({ ...(existing ?? { session: evaluation, objectId, objectName: object, messages: [], request: "", rule: "", files: [], drafts: [], adopted: {} }), testSources: sources })
      useSync.getState().apply({ type: "session.updated", session: evaluation })
      navigate(`/dev/${kind}/${encodeURIComponent(id)}/evaluation?conversation=${encodeURIComponent(evaluation.id)}`)
    } catch (error) {
      if (createdId) await sessionService.remove(createdId)
      showToast({ variant: "error", title: error instanceof Error ? error.message : "无法打开评测会话" })
    } finally {
      openingEvaluation.current = false
    }
  }

  useEffect(() => {
    if (!sessionId && search.get("demo") === "procurement") setDraft(procurementPrompt)
  }, [sessionId, search, setDraft])

  useEffect(() => {
    if (sessionId) void loadMessages(sessionId)
  }, [sessionId, loadMessages])

  // 面板是会话级的：换会话 / 换项目时收起并清空已打开的文件。
  // 例外：从开发页点「编辑」进来时，地址里带着 ?kdskill= / ?agent= / ?mcpapp= / ?workflow=，直接打开对应产物的抽屉
  useEffect(() => {
    const panel = usePanel.getState()
    panel.reset()
    const skill = devStore.skills.find((x) => x.id === editing.kdskill)
    const agent = devStore.agents.find((x) => x.id === editing.agent)
    const app = devStore.mcpApps.find((x) => x.appCode === editing.mcpapp)
    if (skill) panel.toggleDrawer({ kind: "kdskill", id: skill.id, title: skill.displayName })
    if (agent) panel.toggleDrawer({ kind: "agentConfig", id: agent.id, title: agent.name })
    if (app) panel.toggleDrawer({ kind: "kdapp-artifact", id: app.appCode, title: app.appName })
    const workflow = editing.workflow ? workflowService.find(editing.workflow) : undefined
    if (workflow) openWorkflowCanvas(workflow.id, workflow.name)
  }, [sessionId, projectId, editing.kdskill, editing.agent, editing.mcpapp, editing.workflow])

  if (!ready) return <div className="size-full bg-background-page" />
  if (sessionId && !session) return <p role="status" className="p-8">会话已删除或不存在。</p>
  if (!projects.some((x) => x.id === projectId)) return <Navigate to="/" replace />


  const evaluationObject = (sessionId && evaluationSessions[sessionId]?.objectId) || search.get("evaluation")

  if (evaluationObject && deletedObjects?.[evaluationObject]) return <p role="status" className="p-8">被测对象及其评测数据已删除。</p>
  if (evaluationObject) return <EvaluationSession key={sessionId || evaluationObject} projectId={projectId} sessionId={sessionId} objectId={evaluationObject} />

  return (
    <div className="relative size-full min-h-0 flex-1 overflow-hidden flex flex-col bg-background-page">
      <PageActions inSession={!!sessionId} />
      <div className="relative flex-1 min-h-0 flex flex-row overflow-hidden">
        <div
          className={cx(
            "@container relative shrink-0 flex flex-col min-h-0 h-full z-[1] overflow-hidden transition-[width] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            "flex-none",
            previewOpen || (sessionId && repairLinks[sessionId]) ? "min-w-0" : "min-w-[680px]",
            !sessionId && "pt-[calc(30vh_-_56px)]",
            sessionCollapsed && "pointer-events-none",
            resizing && "!transition-none",
          )}
          // 收起时也给一个明确的宽度（100%）：从 auto 过渡浏览器不会插值，面板开合会先跳一下
          style={{ width: sessionCollapsed ? 0 : previewOpen ? (workflowOpen ? `${workflowChat * 100}%` : SESSION_WIDTH) : "100%" }}
        >
          <div className={cx("min-h-0 relative", sessionId ? "flex-1 overflow-hidden" : "w-full shrink-0 overflow-visible")}>
            {session ? (
              loaded ? (
                <MessageTimeline session={session} messages={timeline ?? loaded}
                  onEvaluate={session.localTest ? id => void openEvaluationFromTest(id) : undefined}
                  titleActions={repairTarget ? <div className={previewOpen ? "" : "pr-28"}><Button variant="ghost" className="eval-session-action" icon="arrow-left" onClick={() => returnUrl && navigate(returnUrl)}>返回评测</Button></div> : undefined}
                  titleDescription={repairTarget ? <div className="eval-repair-reference">
                    <span>本次修复依据：{repairRun ? <button type="button" className="text-text-brand hover:underline cursor-pointer" onClick={openRepairReport} aria-label={`查看报告 ${repairRun.code}`}>{repairRun.code}</button> : "报告不可用"}</span>
                    {(repairItems[sessionId!]?.runIds || []).filter(id => id !== repairTarget.runId).length > 0 && <span>此前依据：{(repairItems[sessionId!]?.runIds || []).filter(id => id !== repairTarget.runId).map(id => useEvaluation.getState().runs[`${repairTarget.objectType}:${repairTarget.objectId}`]?.find(r => r.id === id)?.code || "报告不可用").join("、")}</span>}
                  </div> : undefined}
                />
              ) : (
                <div className="size-full flex items-center justify-center" role="status" aria-label={t("session.messages.loading")}>
                  <div className="session-loading-logo" />
                </div>
              )
            ) : (
              <NewSessionView />
            )}
          </div>

          <SessionPromptDock inSession={!!sessionId}>
              {sessionId ? (
                <Composer
                  defaultSkill={repairTarget?.objectType === "skill" ? "skill-builder" : repairTarget?.objectType === "agent" ? "agent-builder" : undefined}
                  placeholder={repairTarget ? "分析失败原因，或补充你的修复要求…" : session?.localTest
                    ? t(session.localTest.objectId.startsWith("skill:") ? "prompt.placeholder.localTestSkill"
                      : session.localTest.objectId.startsWith("mcpapp:") ? "prompt.placeholder.localTestMcpApp"
                      : "prompt.placeholder.localTestAgent")
                    : undefined}
                  projectId={projectId}
                  sessionId={sessionId}
                  working={session?.status === "running"}
                  onSubmit={(text) => void controller.submit(text)}
                  onAbort={controller.abort}
                  onCreateProject={() => void actions.createProject()}
                />
              ) : (
                <div className="relative">
                  <PromptInput
                    projectId={projectId}
                    working={false}
                    onSubmit={(text) => void controller.submit(text)}
                    onAbort={controller.abort}
                    onCreateProject={() => void actions.createProject()}
                    onSkillChange={setSkill}
                  />
                  <SkillTabs onPick={(name) => setDraft(`/${name} `)} />
                </div>
              )}
          </SessionPromptDock>

          {!sessionId && <RecommendationCards skill={skill} onApply={setDraft} />}
          {!sessionId && (
            <p className="absolute left-1/2 -translate-x-1/2 bottom-[10px] text-center text-12-regular text-[var(--neutral-400)] z-10">
              {t("prompt.disclaimer")}
            </p>
          )}
        </div>
        <PreviewPanel projectId={projectId} sessionId={sessionId} working={session?.status === "running"} />
      </div>
    </div>
  )
}

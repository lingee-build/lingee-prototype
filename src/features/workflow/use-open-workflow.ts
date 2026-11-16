import { useNavigate } from "react-router"
import { WORKFLOW_CREATOR } from "@/mock/fixtures/workflow-cases"
import type { Workflow } from "@/mock/fixtures/workflows"
import { sessionService } from "@/services"
import { workflowService } from "@/services/workflow"
import { useLayout } from "@/stores/layout"
import { usePrompt } from "@/stores/prompt"
import { useSync } from "@/stores/sync"

/**
 * 打开工作流详情 = 进入它关联的 Build 会话，右侧打开画布（与技能 / 智能体「编辑」进入会话的方式一致）。
 * 没有关联会话（种子数据、或刷新后内存会话已清空）时新建一个，并在输入框里带上 workflow-builder。
 */
export function useOpenWorkflow() {
  const navigate = useNavigate()
  return async (target: Workflow, options?: { replace?: boolean }) => {
    // 列表里的数据可能是旧的，以服务里的最新记录为准（关联会话可能刚建好）
    const workflow = workflowService.find(target.id) ?? target
    const { sessions, projects } = useSync.getState()
    const linked = workflow.sessionId ? sessions.find((x) => x.id === workflow.sessionId) : undefined
    const projectId = linked?.projectId ?? projects.find((x) => x.id === workflow.projectId)?.id ?? projects[0]?.id
    if (!projectId) return
    let sessionId = linked?.id
    if (!sessionId) {
      const session = await sessionService.create(projectId, `编辑工作流：${workflow.name}`)
      useSync.getState().apply({ type: "session.updated", session })
      useSync.setState((s) => ({ messages: { ...s.messages, [session.id]: [] } }))
      workflowService.linkSession(workflow.id, session.id, projectId)
      usePrompt.getState().setDraft(`/${WORKFLOW_CREATOR} `, session.id)
      sessionId = session.id
    }
    useLayout.getState().expandGroup(projectId)
    navigate(`/p/${projectId}/session/${sessionId}?workflow=${encodeURIComponent(workflow.id)}`, { replace: options?.replace })
  }
}

import { usePrompt } from "@/stores/prompt"
import { useNavigate } from "react-router"
import { sessionService } from "@/services"
import { useLayout } from "@/stores/layout"
import { useSync } from "@/stores/sync"
import { parseSlash } from "@/features/prompt-input/skill-entries"

/** 会话页的发送 / 停止逻辑。新任务页发送时先建会话再跳转，随后由事件流驱动界面 */
export function useSessionController(projectId: string, sessionId?: string) {
  const navigate = useNavigate()
  const apply = useSync((s) => s.apply)

  return {
    async submit(text: string) {
      if (sessionId) return sessionService.prompt(sessionId, text, apply, usePrompt.getState().modelId)
      const title = parseSlash(text).body.slice(0, 24) || text.slice(0, 24)
      const session = await sessionService.create(projectId, title)
      apply({ type: "session.updated", session })
      useSync.setState((s) => ({ messages: { ...s.messages, [session.id]: [] } }))
      useLayout.getState().expandGroup(projectId)
      navigate(`/p/${projectId}/session/${session.id}`)
      sessionService.prompt(session.id, text, apply, usePrompt.getState().modelId)
    },
    abort() {
      if (sessionId) sessionService.abort(sessionId)
    },
  }
}

import { sessionService } from "@/services/session"
import { useNavigate } from "react-router"
import { usePrompt } from "@/stores/prompt"
import { useSync } from "@/stores/sync"

/**
 * 从开发页跳到新任务页，并把一段草稿（通常以 "/技能名" 开头）带进输入框。「新建」走这里；「编辑」见 use-edit-session。
 */
export function useStartSession() {
  const navigate = useNavigate()
  const setDraft = usePrompt((s) => s.setDraft)
  return async (draft: string, projectId?: string, localTest?: { objectId: string; name: string }) => {
    const projects = useSync.getState().projects
    const target = projects.find((x) => x.id === projectId)?.id ?? projects[0]?.id
    if (!target) return
    // 草稿先存起来，新任务页的输入框挂载后会自己取走
    if (!localTest) {
      setDraft(draft)
      navigate(`/p/${target}/session`)
      return
    }
    const session = await sessionService.create(target, `测试 · ${localTest.name}`, { objectId: localTest.objectId })
    setDraft(draft, session.id)
    useSync.getState().apply({ type: "session.updated", session })
    navigate(`/p/${target}/session/${session.id}`)
  }
}

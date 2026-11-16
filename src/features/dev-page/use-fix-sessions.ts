import { useNavigate } from "react-router"
import { sessionService } from "@/services"
import { useLayout } from "@/stores/layout"
import { usePrompt } from "@/stores/prompt"
import { useSync } from "@/stores/sync"
import { buildBatchFixPrompt, type SkillFixEntry } from "@/features/skill-batch/fix-prompt"
import { skillFixScenario } from "@/mock/scenarios/skill-fix"

/**
 * 去修复：全部条目建一个会话并进入，完整修复指令（含全部技能）作为首条消息发送——
 * 原型演示用单会话承载，便于查看提示词全文与会话反应；产品侧按项目分组的逻辑见 PRD 需求项 5。
 */
export function useStartFixSessions() {
  const navigate = useNavigate()
  return async (entries: SkillFixEntry[]) => {
    if (entries.length === 0) return
    if (!useSync.getState().ready) await useSync.getState().bootstrap()
    const projectId = entries[0]!.skill.projectId
    const { prompt } = buildBatchFixPrompt(entries)
    const session = await sessionService.create(projectId, `修复 · ${entries.map((x) => x.skill.displayName).join("、")}`)
    useSync.getState().apply({ type: "session.updated", session: structuredClone(session) })
    useSync.setState((s) => ({ messages: { ...s.messages, [session.id]: [] } }))
    // 修复指令直接作为首条消息发送，会话由修复剧本接管（修复进展 → 资源澄清卡）
    sessionService.prompt(session.id, prompt, useSync.getState().apply, usePrompt.getState().modelId, skillFixScenario(entries))
    useLayout.getState().expandGroup(projectId)
    navigate(`/p/${projectId}/session/${session.id}`)
  }
}

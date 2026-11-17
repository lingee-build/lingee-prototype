import { useNavigate } from "react-router"
import { sessionService } from "@/services"
import { useLayout } from "@/stores/layout"
import { usePrompt } from "@/stores/prompt"
import { useSync } from "@/stores/sync"
import { buildBatchFixPrompt, type SkillFixEntry } from "@/features/skill-batch/fix-prompt"
import { skillFixScenario } from "@/mock/scenarios/skill-fix"
import { setPendingScenario } from "@/mock/stream-engine"

/**
 * 去修复（PRD 需求项 5，会话创建维持 build 现状口径）：
 * - 单技能 / 同项目：按技能归属项目建一个修复会话并进入，完整修复指令预填输入框、由用户点发送（发送后由修复剧本接管）；
 * - 跨项目：按项目分组，每组各建一个会话、各组修复指令都自动发送；用户跳进第一个会话看进展，其余会话已在后台建好（会话列表可进入）。
 */
export function useStartFixSessions() {
  const navigate = useNavigate()
  return async (entries: SkillFixEntry[]) => {
    if (entries.length === 0) return
    if (!useSync.getState().ready) await useSync.getState().bootstrap()
    // 按技能归属项目分组（保持传入顺序，组内顺序不变）
    const groups: Array<{ projectId: string; entries: SkillFixEntry[] }> = []
    for (const entry of entries) {
      const group = groups.find((g) => g.projectId === entry.skill.projectId)
      if (group) group.entries.push(entry)
      else groups.push({ projectId: entry.skill.projectId, entries: [entry] })
    }
    const crossProject = groups.length > 1
    let first: { id: string; projectId: string } | undefined
    for (const group of groups) {
      const { prompt } = buildBatchFixPrompt(group.entries)
      const session = await sessionService.create(group.projectId, `修复 · ${group.entries.map((x) => x.skill.displayName).join("、")}`)
      useSync.getState().apply({ type: "session.updated", session: structuredClone(session) })
      useSync.setState((s) => ({ messages: { ...s.messages, [session.id]: [] } }))
      if (crossProject) {
        // 跨项目：各组修复指令直接作为首条消息发送，会话由修复剧本接管（修复进展 → 资源澄清卡）
        sessionService.prompt(session.id, prompt, useSync.getState().apply, usePrompt.getState().modelId, skillFixScenario(group.entries))
      } else if (!first) {
        // 同项目：修复指令预填输入框由用户点发送；挂起修复剧本，回放引擎在发送时取走
        usePrompt.getState().setDraft(prompt, session.id)
        setPendingScenario(session.id, skillFixScenario(group.entries))
      }
      if (!first) first = { id: session.id, projectId: group.projectId }
      useLayout.getState().expandGroup(group.projectId)
    }
    if (first) navigate(`/p/${first.projectId}/session/${first.id}`)
  }
}

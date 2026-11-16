import { devStore } from '../dev-store'
import { useEvaluation, saveCases, evaluationObjectUnavailable } from '@/services/evaluation'
import { respondToEvaluation } from '@/features/evaluation/conversation-response'
import type { EvaluationConversation } from '@/services/evaluation-conversations'
import type { Scenario, ScenarioContext } from './types'

/** 普通开发对话中生成用例；目标不唯一时先确认，始终读取当前已保存列表。 */
export function evaluationGenerateScenario({ prompt, projectId }: ScenarioContext): Scenario {
  const objects = [
    ...devStore.skills.filter(s => s.projectId === projectId).map(s => ({ id: `skill:${s.id}`, name: s.displayName, route: `/dev/skill/${s.id}/evaluation` })),
    ...devStore.agents.filter(a => a.projectId === projectId).map(a => ({ id: `agent:${a.id}`, name: a.name, route: `/dev/agent/${a.id}/evaluation` })),
  ]
  const named = objects.filter(o => prompt.includes(o.name) || prompt.includes(o.id.split(':')[1]))
  const candidates = named.length ? named : objects
  let chosen = candidates.length === 1 ? candidates[0] : undefined
  return { todos: ['确认评测对象', '生成并保存当前用例'], steps: [
    chosen ? { text: `为「${chosen.name}」准备评测用例。` } : candidates.length ? {
      question: [{ question: '要为哪个对象生成评测用例？', options: candidates.map(o => ({ label: `${o.name} · ${o.id}`, description: '生成后直接保存到该对象的当前用例列表' })), multiple: false }],
      onAnswer: answers => { chosen = candidates.find(o => `${o.name} · ${o.id}` === answers[0]?.[0]) },
    } : { text: '当前项目没有可评测的技能或智能体，请先创建或导入对象。' },
    { resolve: () => {
      if (!chosen || evaluationObjectUnavailable(chosen.id)) return { text: '未确认可用对象，本次未生成用例。' }
      const next: EvaluationConversation = { session: { id: 'preview', projectId, title: '生成用例', status: 'idle', time: { created: Date.now(), updated: Date.now() } }, objectId: chosen.id, objectName: chosen.name, messages: [], request: prompt, rule: '', files: [], drafts: structuredClone(useEvaluation.getState().cases[chosen.id] || []), adopted: {} }
      const response = respondToEvaluation(next, prompt)
      if (response.changed && !saveCases(chosen.id, next.drafts)) return { text: '用例保存失败，原列表已保留。请恢复本地存储后重试。' }
      return { text: `${response.text}\n\n本地规则模拟，未接入真实生成模型。可打开评测工作区继续调整和运行。`, card: () => ({ kind: 'evaluation-cases', config: { id: chosen!.id, title: `${chosen!.name} · 评测用例`, description: `当前 ${next.drafts.length} 条用例` } }) }
    } },
  ] }
}

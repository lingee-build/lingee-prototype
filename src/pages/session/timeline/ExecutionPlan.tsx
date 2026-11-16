import { Markdown } from '@/ui'
import { useT } from '@/i18n'
import type { ExecutionPlanPart } from '@/mock/types'

/** Render the plan through the same Markdown component as the assistant's prose. */
export function ExecutionPlan({ part }: { part: ExecutionPlanPart }) {
  const t = useT()
  const flow = part.stages.map(stage => stage.length === 1
    ? stage[0].title
    : `${t('proto.plan.parallel')}\n${stage.map((node,index) => `${index === stage.length - 1 ? '└─' : '├─'} ${node.title}`).join('\n')}`,
  ).join('\n        ↓\n')
  return <div data-component="execution-plan" aria-label={t('proto.plan.title')}>
    <Markdown text={`\`\`\`text\n${flow}\n\`\`\``} />
  </div>
}

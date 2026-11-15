import { useEffect, useState } from "react"
import { currentEvaluationEnvironment, environmentLabel, loadSalesEvaluationDemo, useEvaluation, type EvalEnvironment } from "@/services/evaluation"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router"
import { EvaluationPanel } from "@/features/evaluation/EvaluationPanel"
import { agentService, skillService } from "@/services"
import { useT } from "@/i18n"
import { useLayout } from "@/stores/layout"

/** 对象评测工作区：独立路由，沿用对象的用例、草稿和运行记录。 */
export function Component() {
  const { mode, objectId } = useParams()
  useEffect(() => { void loadSalesEvaluationDemo(`${mode}:${objectId}`) }, [mode, objectId])
  const deleted = useEvaluation(s => !!s.deletedObjects?.[`${mode}:${objectId}`])
  const t = useT()
  const sidebarOpened = useLayout(s => s.sidebarOpened)
  const [environment, setEnvironment] = useState<EvalEnvironment | undefined>(currentEvaluationEnvironment)
  const { data: target, isPending } = useQuery({
    queryKey: ["evaluation-target", mode, objectId],
    queryFn: async () => {
      if (!objectId) return null
      if (mode === "skill") {
        const skill = await skillService.get(objectId)
        return skill ? { id: skill.id, name: skill.displayName } : null
      }
      if (mode === "agent") {
        const agent = await agentService.get(objectId)
        return agent ? { id: agent.id, name: agent.name } : null
      }
      return null
    },
    staleTime: 0,
  })

  return (
    <section className="eval-workspace flex h-full min-h-0 w-full flex-col bg-background-page" aria-label={t("proto.eval.title")} data-sidebar-collapsed={!sidebarOpened || undefined}>
      {target && !deleted ? (
        <EvaluationPanel key={`${mode}:${target.id}`} objectId={`${mode}:${target.id}`} name={target.name} onEnvironmentChange={setEnvironment} heading={<>
        <h1 className="flex flex-1 min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[14px] leading-[22px] font-medium text-text-strong">
          {target && <span className="break-words">{target.name}</span>}
          <span>{t("proto.eval.title")}</span>

        </h1>
        </>} />
      ) : (
        <p className="p-8 text-text-weak" role="status">{deleted ? "被测对象及其评测数据已删除，无法查看或重新运行。" : t(isPending ? "proto.eval.loading" : "proto.eval.notFound")}</p>
      )}
    </section>
  )
}

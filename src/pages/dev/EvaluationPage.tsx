import { useState } from "react"
import { currentEvaluationEnvironment, environmentLabel, useEvaluation, type EvalEnvironment } from "@/services/evaluation"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router"
import { EvaluationPanel } from "@/features/evaluation/EvaluationPanel"
import { agentService, skillService } from "@/services"
import { useT } from "@/i18n"
import { IconButton } from "@/ui"
import { useLayout } from "@/stores/layout"

/** 对象评测工作区：独立路由，沿用对象的用例、草稿和运行记录。 */
export function Component() {
  const { mode, objectId } = useParams()
  const deleted = useEvaluation(s => !!s.deletedObjects?.[`${mode}:${objectId}`])
  const navigate = useNavigate()
  const t = useT()
  const sidebarOpened = useLayout(s => s.sidebarOpened)
  const [detailOpen, setDetailOpen] = useState(false)
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
    <section className="eval-workspace flex h-full min-h-0 w-full flex-col bg-background-page" aria-label={t("proto.eval.title")}>
      <header data-sidebar-collapsed={!sidebarOpened || undefined} className="eval-workspace-header flex shrink-0 items-center gap-3 border-b border-[var(--border-base)]">
        {!detailOpen && <IconButton icon="arrow-left" variant="ghost" className="!text-[var(--text-weak)]" iconClass="!text-[var(--text-weak)]" aria-label={t("proto.eval.backList")} title={t("proto.eval.backList")} onClick={() => navigate(`/dev/${mode === "agent" ? "agent" : "skill"}`)} />}
        <h1 className="flex flex-1 min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[18px] leading-8 font-medium text-text-strong">
          {target && <span className="break-words">{target.name}</span>}
          <span>{t("proto.eval.title")}</span>
          <span className="session-title-local-test-badge shrink-0 inline-flex items-center gap-1 h-[18px] px-1 rounded-[4px] text-[12px] font-normal leading-[18px] select-none" aria-label={`运行环境：${environmentLabel(environment)}`}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="shrink-0" aria-hidden="true"><path d="M5.09814 3.25586C5.21715 3.00678 5.51551 2.90112 5.76465 3.02002C6.13673 3.19767 6.46072 3.46219 6.70947 3.79102C6.95823 4.11989 7.12465 4.50373 7.19434 4.91016C7.26402 5.31659 7.23486 5.73399 7.10986 6.12695C6.98487 6.51979 6.76767 6.87704 6.47607 7.16846L4.39893 9.24512C3.91571 9.72832 3.2605 9.99994 2.57715 10C1.8937 10 1.23815 9.72839 0.754883 9.24512C0.271615 8.76185 0 8.1063 0 7.42285C5.80821e-05 6.7395 0.271682 6.08429 0.754883 5.60107L1.56592 4.79004C1.76119 4.59487 2.07772 4.59481 2.27295 4.79004C2.46808 4.98528 2.46809 5.30184 2.27295 5.49707L1.46191 6.30811C1.16625 6.60378 1.00006 7.00471 1 7.42285C1 7.84108 1.16618 8.24235 1.46191 8.53809C1.75765 8.83382 2.15892 9 2.57715 9C2.99529 8.99994 3.39622 8.83375 3.69189 8.53809L5.76904 6.46143C5.94749 6.28308 6.08074 6.06415 6.15723 5.82373C6.23372 5.58326 6.25114 5.32781 6.2085 5.0791C6.16586 4.83048 6.06426 4.59573 5.91211 4.39453C5.7599 4.1933 5.56168 4.03109 5.33398 3.92236C5.08479 3.80339 4.97917 3.50506 5.09814 3.25586ZM9 2.57715C9 2.15892 8.83382 1.75765 8.53809 1.46191C8.24235 1.16618 7.84108 1 7.42285 1C7.00471 1.00006 6.60378 1.16625 6.30811 1.46191L4.23096 3.53857C4.05251 3.71692 3.91926 3.93585 3.84277 4.17627C3.76628 4.41674 3.74886 4.67219 3.7915 4.9209C3.83414 5.16952 3.93574 5.40427 4.08789 5.60547C4.2401 5.8067 4.43832 5.96891 4.66602 6.07764C4.91521 6.19661 5.02083 6.49494 4.90186 6.74414C4.78285 6.99322 4.48449 7.09889 4.23535 6.97998C3.86327 6.80233 3.53928 6.53781 3.29053 6.20898C3.04177 5.88011 2.87535 5.49627 2.80566 5.08984C2.73598 4.68341 2.76514 4.26601 2.89014 3.87305C3.01513 3.48021 3.23234 3.12295 3.52393 2.83154L5.60107 0.754883C6.08429 0.271682 6.7395 5.8082e-05 7.42285 0C8.1063 0 8.76185 0.271615 9.24512 0.754883C9.72839 1.23815 10 1.8937 10 2.57715C9.99994 3.2605 9.72832 3.91571 9.24512 4.39893L8.43408 5.20996C8.23881 5.40513 7.92228 5.40519 7.72705 5.20996C7.53192 5.01472 7.53191 4.69816 7.72705 4.50293L8.53809 3.69189C8.83375 3.39622 8.99994 2.99529 9 2.57715Z" /></svg>
            <span>{environmentLabel(environment)}</span>
          </span>
        </h1>
      </header>
      {target && !deleted ? (
        <EvaluationPanel key={`${mode}:${target.id}`} objectId={`${mode}:${target.id}`} name={target.name} onEnvironmentChange={setEnvironment} onDetailChange={setDetailOpen} />
      ) : (
        <p className="p-8 text-text-weak" role="status">{deleted ? "被测对象及其评测数据已删除，无法查看或重新运行。" : t(isPending ? "proto.eval.loading" : "proto.eval.notFound")}</p>
      )}
    </section>
  )
}

import { useQuery } from "@tanstack/react-query"
import { publicUrl } from "@/lib/public-url"
import { BrandButton, Icon, showToast, useDialog } from "@/ui"
import { useT } from "@/i18n"
import type { Agent } from "@/mock/fixtures/dev"
import { agentService } from "@/services"
import { domainI18nKeys, pickAvatar, type TabProps } from "../form"
import { AddSubAgentDialog } from "./AddSubAgentDialog"
import { PublishTag, SourceTag, tagOf } from "./SubAgentTag"

/**
 * 「子智能体」页签：主智能体可以引用其它智能体作为子智能体，对话时由主智能体按需分派。
 * 一行一张卡片（头像、名称、领域、来源、发布状态、描述）；点卡片看它的详情，悬停出现移出按钮。
 * 来自 SubAgent 需求原型。
 */
export function SubAgentTab(props: TabProps & { hostId: string; onOpenAgent: (agent: Agent) => void }) {
  const t = useT()
  const dialog = useDialog()
  const { form, set, readonly } = props
  const candidates = useQuery({ queryKey: ["agent-candidates"], queryFn: agentService.candidates, staleTime: 0 })
  const subs = form.subs.flatMap((id) => (candidates.data ?? []).filter((x) => x.id === id))
  const count = (tag: string) => subs.filter((x) => tagOf(x) === tag).length

  const openAdd = () =>
    dialog.show(() => (
      <AddSubAgentDialog
        hostId={props.hostId}
        existing={form.subs}
        onConfirm={(ids) => {
          set({ subs: [...form.subs, ...ids] })
          showToast({ variant: "success", title: t("proto.subAgent.added", { count: ids.length }) })
        }}
      />
    ))
  const remove = (agent: Agent) => {
    set({ subs: form.subs.filter((id) => id !== agent.id) })
    showToast({ title: t("proto.subAgent.removed", { name: agent.name }) })
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {!readonly && (
        <div className="shrink-0 flex items-center gap-3">
          <BrandButton variant="auxiliary" size="normal" icon="plus-16" iconSize="small" onClick={openAdd}>
            {t("proto.subAgent.add")}
          </BrandButton>
          <span className="ml-auto text-[12px] text-text-weak truncate">
            {t("proto.subAgent.summary", { total: subs.length, own: count("own"), official: count("official"), beta: count("beta") })}
          </span>
        </div>
      )}
      {!candidates.isPending && subs.length === 0 ? (
        <div className="agent-config-list-card border border-dashed border-[var(--border-weak-base)] px-4 py-8 text-center text-[13px] text-text-weak">
          {t(readonly ? "proto.subAgent.emptyReadonly" : "proto.subAgent.empty")}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-3">
          {subs.map((agent) => (
            <div
              key={agent.id}
              className="group relative shrink-0 flex items-start gap-3 agent-config-list-card border border-[var(--border-weak-base)] bg-[var(--input-base)] px-4 py-3 cursor-pointer transition-all hover:border-[var(--primary-200)] hover:shadow-sm"
              title={t("proto.subAgent.viewDetail", { name: agent.name })}
              onClick={() => props.onOpenAgent(agent)}
            >
              <img src={publicUrl(agent.avatar || pickAvatar(agent.id))} alt="" className="size-8 shrink-0 rounded-full object-cover mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 pr-7">
                  <span className="truncate text-[14px] font-semibold text-text-strong max-w-[40%]">{agent.name}</span>
                  {domainI18nKeys[agent.domain] && (
                    <span className="shrink-0 rounded-[5px] bg-[var(--surface-base)] px-2 py-[2px] text-[11px] text-text-base">{t(domainI18nKeys[agent.domain])}</span>
                  )}
                  <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    <SourceTag agent={agent} />
                    <PublishTag agent={agent} />
                  </span>
                </div>
                <div className="text-[12px] leading-[18px] text-text-weak line-clamp-2">{agent.desc}</div>
              </div>
              {!readonly && (
                <button
                  type="button"
                  className="absolute right-2 top-2 hidden group-hover:flex size-7 cursor-pointer items-center justify-center rounded-lg border-none bg-[var(--input-base)] [--icon-fill:var(--text-secondary)] hover:bg-[rgba(255,158,166,0.12)] hover:[--icon-fill:var(--text-on-error-base)]"
                  title={t("proto.subAgent.remove")}
                  aria-label={t("proto.subAgent.remove")}
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(agent)
                  }}
                >
                  <Icon name="trash-fill" size="small" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

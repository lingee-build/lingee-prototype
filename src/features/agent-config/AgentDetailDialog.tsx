import type { CSSProperties } from "react"
import { publicUrl } from "@/lib/public-url"
import { BrandButton, Dialog, Tag, useDialog } from "@/ui"
import { useT } from "@/i18n"
import type { Agent } from "@/mock/fixtures/dev"
import { useAgentActions } from "@/features/agent-actions/use-agent-actions"
import { AgentConfigPanel } from "./AgentConfigPanel"
import { AgentChangedAlert, AgentStatusTag } from "./AgentStatusTag"
import { domainI18nKeys, pickAvatar } from "./form"

/**
 * 智能体详情弹窗（只读）。
 * 布局：页签栏右侧是「编辑」，「基础信息」页签下方依次是
 * 头像 + 名称 + 状态 + 领域 + 编码、状态不一致提示、功能描述、模型策略、更新日志。
 */
export function AgentDetailDialog(props: { agent: Agent; onChanged?: () => void }) {
  const t = useT()
  const dialog = useDialog()
  const { agent } = props
  const actions = useAgentActions(() => props.onChanged?.())

  return (
    <Dialog fit title={t("kcode.agentDev.detail.title")} className="!w-[720px] !max-w-[90vw] overflow-hidden">
      <div className="flex flex-col" style={{ height: "min(540px, 70vh)" }}>
        <div className="agent-detail-cards relative flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pt-0 pb-5">
          <AgentConfigPanel
            agent={agent}
            readonly
            hideIdentity
            action={
              <BrandButton
                variant="primary"
                size="normal"
                onClick={() => {
                  dialog.close()
                  actions.edit(agent)
                }}
              >
                {t("kcode.agentDev.menu.edit")}
              </BrandButton>
            }
            subHeader={
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-2xl overflow-hidden">
                    <img src={publicUrl(agent.avatar || pickAvatar(agent.id))} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-[600] leading-[22px] text-text-strong truncate" title={agent.name}>
                        {agent.name}
                      </span>
                      <AgentStatusTag agent={agent} />
                      {agent.domain && (
                        <Tag type="normal" className="whitespace-nowrap shrink-0 !rounded-[6px] !text-text-weak">
                          {domainI18nKeys[agent.domain] ? t(domainI18nKeys[agent.domain]) : agent.domain}
                        </Tag>
                      )}
                    </div>
                    <span className="text-[14px] text-[var(--text-tile-desc)] font-medium leading-[22px] truncate" title={agent.id}>
                      {agent.id}
                    </span>
                  </div>
                </div>
                <AgentChangedAlert agent={agent} />
              </div>
            }
          />
        </div>
      </div>
    </Dialog>
  )
}

import { Icon, Tag, Tooltip } from "@/ui"
import { useT } from "@/i18n"
import type { Agent } from "@/mock/fixtures/dev"

/**
 * 智能体的状态标签：
 * - 本地改过但云端还有记录：显示「已保存」+ 云朵，悬停说明云端状态
 * - 已驳回且有原因：悬停看驳回原因
 */
export function AgentStatusTag(props: { agent: Agent }) {
  const t = useT()
  const { agent } = props
  const reason = agent.rejectionRemark ? t("ui.tile.rejectionReason", { reason: agent.rejectionRemark }) : ""

  if (agent.isChanged && agent.backendStatus)
    return (
      <Tooltip
        value={`${t(`kcode.agentDev.changedTip.${agent.backendStatus}`)}${agent.backendStatus === "rejected" && reason ? `\n${reason}` : ""}`}
        placement="top"
        gutter={4}
      >
        <Tag type="normal" className="whitespace-nowrap shrink-0 cursor-pointer">
          <Icon name="cloud" className="size-4 mr-1 inline-block" />
          {t("kcode.agentDev.status.saved")}
        </Tag>
      </Tooltip>
    )
  if (agent.status === "rejected" && reason)
    return (
      <Tooltip value={reason} placement="top" gutter={4}>
        <Tag type="error" className="whitespace-nowrap shrink-0 cursor-pointer">
          <Icon name="info" className="size-4 text-[var(--danger-600)] mr-1 inline-block" />
          {t(`kcode.agentDev.status.${agent.status}`)}
        </Tag>
      </Tooltip>
    )
  return (
    <Tag type={agent.status === "rejected" ? "error" : "normal"} className="whitespace-nowrap shrink-0">
      {t(`kcode.agentDev.status.${agent.status}`)}
    </Tag>
  )
}

/** 本地与云端状态不一致时的提示条（驳回时为橙色并带原因） */
export function AgentChangedAlert(props: { agent: Agent }) {
  const t = useT()
  const { agent } = props
  if (!agent.isChanged || !agent.backendStatus) return null
  const rejected = agent.backendStatus === "rejected"
  return (
    <div
      className={`rounded-[16px] px-[11px] py-[9px] flex items-center gap-2 border ${
        rejected ? "bg-[var(--orange-50)] border-[var(--orange-200)]" : "bg-[var(--primary-50)] border-[var(--primary-200)]"
      }`}
    >
      <Icon name="info-fill" size="small" className={`size-5 shrink-0 ${rejected ? "text-[var(--orange-600)]" : "text-[var(--primary-600)]"}`} />
      <span className="text-[14px] leading-[20px] text-[var(--gray-800)]">
        {t(`kcode.agentDev.changedTip.${agent.backendStatus}`)}
        {rejected && agent.rejectionRemark ? t("ui.tile.rejectionReason", { reason: agent.rejectionRemark }) : ""}
      </span>
    </div>
  )
}

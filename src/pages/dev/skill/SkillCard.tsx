import { UpgradeCard } from "@/features/artifact-upgrade/UpgradeGate"
import type { ReactNode } from "react"
import { CapsuleTag, Icon, Tile, Tooltip, type IconName } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { Skill } from "@/mock/fixtures/dev"
import { DynamicSkillIcon } from "@/features/dev-page/DynamicSkillIcon"

const MUTED = "text-text-base"
const ENTERPRISE_COLOR: Record<Skill["enterpriseStatus"], string> = {
  published: "text-[var(--success-600)]",
  submitted: "text-[var(--primary-600)]",
  rejected: "text-[var(--danger-600)]",
  saved: MUTED,
}

/** 通道行：图标 + 通道名 + 状态；提交后本地又有修改时，行尾出现云朵按钮提示继续提交 */
function ChannelRow(props: { icon: IconName; label: string; status: string; statusClass: string; cloudTip?: string; onCloud?: () => void }) {
  return (
    <div className="flex items-center justify-between min-h-[24px]">
      <div className="flex items-center gap-1 min-w-0">
        <Icon name={props.icon} size="small" className={`size-3.5 shrink-0 ${MUTED}`} />
        <span className={`text-[12px] leading-[18px] whitespace-nowrap ${MUTED}`}>{props.label}</span>
        <span className={`text-[12px] leading-[18px] whitespace-nowrap ${props.statusClass}`}>{props.status}</span>
      </div>
      {props.cloudTip && (
        <Tooltip value={props.cloudTip} placement="top" gutter={4}>
          <button
            type="button"
            className="flex size-6 cursor-pointer items-center justify-center rounded-[6px] border-none bg-transparent transition-colors hover:bg-[var(--surface-base)]"
            onClick={(e) => {
              e.stopPropagation()
              props.onCloud?.()
            }}
          >
            <Icon name="cloud" size="small" className="size-4" />
          </button>
        </Tooltip>
      )}
    </div>
  )
}

export function SkillCard(props: {
  skill: Skill
  /** 随哪个智能体审核中（审核锁） */
  auditAgentName?: string
  selected: boolean
  action: ReactNode
  onClick: () => void
  onContinueSubmit: (route: "personal" | "enterprise") => void
}) {
  const t = useT()
  const { skill } = props
  const enterpriseKey = skill.enterpriseStatus === "saved" ? "none" : skill.enterpriseStatus
  return (
    <UpgradeCard id={skill.id}>
      <Tile
        name={skill.displayName}
        desc={skill.desc}
        className={cx("dev-page-tile tile-filled skill-dev-tile group cursor-pointer", props.selected && "skill-dev-tile-selected")}
        subname={<CapsuleTag>{skill.category}</CapsuleTag>}
        icon={<DynamicSkillIcon name={skill.displayName} size={48} />}
        action={props.action}
        onClick={props.onClick}
        footer={
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <ChannelRow
              icon="user"
              label={t("kcode.skillDev.channel.personal")}
              status={t(`kcode.skillDev.channelStatus.personal.${skill.personalInstalled ? "installed" : "notInstalled"}`)}
              statusClass={skill.personalInstalled ? "text-[var(--success-600)]" : MUTED}
              cloudTip={skill.personalInstalled && skill.changed ? t("kcode.skillDev.cloud.installTip") : undefined}
              onCloud={() => props.onContinueSubmit("personal")}
            />
            <ChannelRow
              icon="building"
              label={t("kcode.skillDev.channel.enterprise")}
              status={`${t(`kcode.skillDev.channelStatus.enterprise.${enterpriseKey}`)}${props.auditAgentName ? ` · 随「${props.auditAgentName}」` : ""}`}
              statusClass={ENTERPRISE_COLOR[skill.enterpriseStatus]}
              cloudTip={skill.enterpriseStatus !== "saved" && skill.changed ? t("kcode.skillDev.cloud.submitTip") : undefined}
              onCloud={() => props.onContinueSubmit("enterprise")}
            />
          </div>
        }
      />
    </UpgradeCard>
  )
}

import { useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react"
import { useT } from "@/i18n"
import { Icon, type IconName } from "../icon/Icon"
import { Tooltip } from "../tooltip/Tooltip"

/** 文本被截断时才出提示气泡，没截断就不打扰 */
function TruncatedTooltip(props: { value?: string; children: ReactNode; triggerClass?: string; slot: string; multiline?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [truncated, setTruncated] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setTruncated(props.multiline ? el.scrollHeight > el.clientHeight : el.scrollWidth > el.clientWidth)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [props.value, props.multiline])

  return (
    <Tooltip value={props.value} placement="top" gutter={4} className={props.triggerClass} inactive={!truncated}>
      <span ref={ref} data-slot={props.slot}>
        {props.children}
      </span>
    </Tooltip>
  )
}

export type TileStatus = "saved" | "published" | "submitted" | "rejected" | "developing" | "pending" | "completed"

export interface TileProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode
  name?: string
  desc?: string
  /** 卡片状态（右下角） */
  status?: TileStatus
  /** 驳回原因，status 为 rejected 时悬停状态可见 */
  reason?: string
  /** 右上角操作插槽，如三点菜单 */
  action?: ReactNode
  /** 底部插槽，如通道状态、标签 */
  footer?: ReactNode
  /** 本地改过但还没提交：主状态显示「已保存」+ 云朵图标 */
  isChanged?: boolean
  /** 云端审核状态（isChanged 时用于悬停提示） */
  backendStatus?: TileStatus
  /** 自定义「变更提示」文案，不传用通用文案 ui.tile.changedTip.* */
  changedTipText?: (status: TileStatus) => string
  changedIcon?: IconName
  changedLabel?: string
  onChangedClick?: () => void
  changedLoading?: boolean
  /** 名称行内紧跟标题的附加元素 */
  nameExtra?: ReactNode
  /** 标题下方的副标题插槽，如分类胶囊 */
  subname?: ReactNode
}

/** 开发页里的卡片（技能 / 智能体 / 业务组件通用）。结构对齐 kcode-ui 的 Tile */
export function Tile({
  icon,
  name,
  desc,
  status,
  reason,
  action,
  footer,
  isChanged,
  backendStatus,
  changedTipText,
  changedIcon,
  changedLabel,
  onChangedClick,
  changedLoading,
  nameExtra,
  subname,
  children,
  ...rest
}: TileProps) {
  const t = useT()
  const changedTip = (value: TileStatus) => (changedTipText ? changedTipText(value) : t(`ui.tile.changedTip.${value}`))
  return (
    <div {...rest} data-component="tile">
      <div data-slot="tile-body">
        {icon && <div data-slot="tile-icon">{icon}</div>}
        <div data-slot="tile-content">
          <div data-slot="tile-header">
            <div data-slot="tile-title">
              <div data-slot="tile-name-row">
                {name && (
                  <TruncatedTooltip value={name} triggerClass="min-w-0 flex-1" slot="tile-name">
                    {name}
                  </TruncatedTooltip>
                )}
                {nameExtra}
              </div>
              {subname && <div data-slot="tile-subname">{subname}</div>}
            </div>
            <div data-slot="tile-action">{action}</div>
          </div>
          <TruncatedTooltip value={desc} triggerClass="min-w-0" slot="tile-desc" multiline>
            {desc}
          </TruncatedTooltip>
        </div>
      </div>
      {(footer || status) && (
        <div data-slot="tile-footer">
          <div data-slot="tile-tags">{footer}</div>
          {status &&
            (isChanged && backendStatus ? (
              <Tooltip
                value={
                  backendStatus === "rejected" && reason
                    ? `${changedTip(backendStatus)}\n${t("ui.tile.rejectionReason", { reason })}`
                    : changedTip(backendStatus)
                }
                placement="top"
                gutter={4}
              >
                <span
                  data-slot="tile-status"
                  data-status="saved"
                  className={changedLoading ? "pointer-events-none" : undefined}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!changedLoading) onChangedClick?.()
                  }}
                >
                  {changedLoading ? (
                    <Icon name="loading" data-slot="tile-status-icon" className="animate-spin" />
                  ) : (
                    <Icon name={changedIcon ?? "cloud"} data-slot="tile-status-icon" />
                  )}
                  {changedLabel ?? t("ui.tile.status.saved")}
                </span>
              </Tooltip>
            ) : status === "rejected" && reason ? (
              <Tooltip value={t("ui.tile.rejectionReason", { reason })} placement="top" gutter={4}>
                <span data-slot="tile-status" data-status={status} onClick={(e) => e.stopPropagation()}>
                  <Icon name="info" data-slot="tile-status-icon" />
                  {t(`ui.tile.status.${status}`)}
                </span>
              </Tooltip>
            ) : (
              <span data-slot="tile-status" data-status={status}>
                {t(`ui.tile.status.${status}`)}
              </span>
            ))}
        </div>
      )}
      {children}
    </div>
  )
}

export function CapsuleTag(props: { children: ReactNode; className?: string }) {
  return (
    <span className={`rounded-[21px] px-2 py-1 text-[12px] leading-[16px] text-[var(--neutral-600)] bg-[var(--neutral-50)] ${props.className ?? ""}`}>
      {props.children}
    </span>
  )
}

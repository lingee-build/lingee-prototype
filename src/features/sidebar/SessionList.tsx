import { useState } from "react"
import { Link, useParams } from "react-router"
import { DropdownMenu, Icon } from "@/ui"
import { inlinePaths } from "@/ui/icon/inline-paths.gen"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { Session } from "@/mock/types"
import { useLayout } from "@/stores/layout"
import { useSync } from "@/stores/sync"
import { sessionPath } from "./helpers"
import type { SidebarActions } from "./use-sidebar-actions"

type DotVariant = "running" | "clarification" | "error" | "unread"

/** 会话状态圆点：运行中带呼吸动画，其余为静态 */
function StatusDot(props: { variant: DotVariant }) {
  return (
    <span className="size-5 shrink-0 inline-flex items-center justify-center" aria-hidden="true">
      <span className="status-dot" data-variant={props.variant} />
    </span>
  )
}

// 优先级：运行中(蓝) > 待澄清(橙) > 异常(橙) > 未读(绿)；无活跃状态不渲染、不占位
const dotVariant = (session: Session): DotVariant | undefined =>
  session.status !== "idle" ? session.status : session.unread ? "unread" : undefined

export function SessionSkeleton(props: { count: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: props.count }, (_, i) => (
        <div key={i} className="flex items-center h-9 px-2.5">
          <div className="h-[14px] rounded-md bg-[var(--neutral-100)] animate-pulse" style={{ width: `${[72, 56, 64, 48][i % 4]}%` }} />
        </div>
      ))}
    </div>
  )
}

function SessionRow(props: { session: Session; actions: SidebarActions; menuOpen: boolean; onMenuOpenChange: (open: boolean) => void }) {
  const t = useT()
  const params = useParams()
  const projects = useSync((s) => s.projects)
  const pinned = useLayout((s) => s.pinnedSessions.includes(props.session.id))
  const { session, actions } = props
  const active = params.sessionId === session.id
  const variant = dotVariant(session)
  const others = projects.filter((x) => x.id !== session.projectId)

  return (
    <div
      data-session-id={session.id}
      className={cx(
        "group/session-item relative w-full flex items-center",
        "flex px-2.5 items-stretch gap-1.5 self-stretch rounded-[18px] cursor-pointer leading-[20px]",
        "hover:bg-[var(--neutral-100)]",
        (active || props.menuOpen) && "bg-[var(--neutral-100)]",
      )}
    >
      <Link
        to={sessionPath(session)}
        className={cx(
          "flex-1 min-w-0 flex items-center truncate cursor-pointer gap-1.5 py-2 text-[14px] font-normal leading-[20px]",
          active ? "text-[var(--neutral-900))]" : "text-[var(--neutral-700))]",
        )}
      >
        {variant && <StatusDot variant={variant} />}
        <span className="truncate" title={session.title}>
          {session.title}
        </span>
      </Link>

      <div
        className={cx(
          "absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center transition-opacity",
          props.menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none group-hover/session-item:opacity-100 group-hover/session-item:pointer-events-auto",
        )}
      >
        <DropdownMenu placement="bottom-end" open={props.menuOpen} onOpenChange={props.onMenuOpenChange}>
          <DropdownMenu.Trigger className="relative flex items-center justify-center size-7 rounded-[50%] transition-colors cursor-pointer">
            <div className="size-7 rounded-[50%] flex items-center justify-center bg-[var(--surface-base)]">
              <Icon name="dot-grid-16" className="shrink-0 text-text-base" />
            </div>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content>
              <DropdownMenu.Item
                onSelect={() => actions.pinSession(session.id)}
                className="group/project flex items-center cursor-pointer"
                style={{ gap: 4 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d={inlinePaths.pin} fill="currentColor" />
                </svg>
                <span className="text-[var(--neutral-700)] text-[14px] font-[400] leading-[22px]">
                  {t(pinned ? "kcode.session.unpinTop" : "kcode.session.pinTop")}
                </span>
              </DropdownMenu.Item>

              <DropdownMenu.Item
                onSelect={() => actions.renameSession(session.id)}
                className="flex items-center cursor-pointer gap-1"
                style={{ gap: 4 }}
              >
                <Icon name="pencil-16" size="small" />
                <span className="text-[var(--neutral-700)] text-[14px] font-[400] leading-[22px]">{t("kcode.session.rename")}</span>
              </DropdownMenu.Item>

              {others.length > 0 && (
                <DropdownMenu.Sub gutter={10}>
                  <DropdownMenu.SubTrigger className="w-full cursor-pointer gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="w-4 h-4 shrink-0 text-[var(--neutral-600)]"
                    >
                      <path d={inlinePaths.moveToProject} fill="currentColor" />
                    </svg>
                    <span className="flex-1 text-left text-[var(--neutral-700)] text-[14px] font-[400] leading-[22px]">
                      {t("kcode.session.moveToProject")}
                    </span>
                    <Icon name="chevron-right-16" size="small" className="text-[var(--neutral-400)]" />
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent style={{ width: 189, minWidth: 189, maxWidth: 189 }}>
                      {others.map((project) => (
                        <DropdownMenu.Item
                          key={project.id}
                          onSelect={() => actions.moveSession(session.id, project.id)}
                          className="flex items-center cursor-pointer min-w-0 gap-1"
                        >
                          <span className="truncate" title={project.name}>
                            {project.name}
                          </span>
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
              )}

              <DropdownMenu.Item
                onSelect={() => actions.archiveSession(session.id)}
                className="flex items-center cursor-pointer gap-1"
                style={{ gap: 4 }}
              >
                <Icon name="archive" size="small" className="text-[var(--neutral-600)]" />
                <span className="text-[var(--neutral-700)] text-[14px] font-[400] leading-[22px]">{t("kcode.session.archive")}</span>
              </DropdownMenu.Item>

              <DropdownMenu.Item
                onSelect={() => actions.deleteSession(session.id)}
                className="flex items-center cursor-pointer gap-1 group/project"
                variant="destructive"
              >
                <Icon name="trash-16" size="small" className="text-[var(--neutral-600)] group-hover/project:text-[var(--danger-600)]" />
                <span className="text-[14px] font-normal leading-[22px]">{t("kcode.session.delete")}</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu>
      </div>
    </div>
  )
}

/** 会话列表：默认展示 5 条，「显示更多」每次加 10 条 */
export function SessionList(props: { sessions: Session[]; actions: SidebarActions; loading?: boolean; paged?: boolean }) {
  const t = useT()
  const [limit, setLimit] = useState(5)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const shown = props.paged === false ? props.sessions : props.sessions.slice(0, limit)

  if (props.sessions.length === 0)
    return (
      <div className="flex flex-col gap-0.5">
        {props.loading ? (
          <SessionSkeleton count={4} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 self-stretch px-2.5 py-2 rounded-[18px]">
            <Icon name="empty-box" containerClass="size-7" />
            <span className="text-[var(--neutral-400)] text-[14px] font-normal leading-[20px]">{t("kcode.session.empty")}</span>
          </div>
        )}
      </div>
    )

  return (
    <div className="flex flex-col gap-0.5">
      {shown.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          actions={props.actions}
          menuOpen={openMenuId === session.id}
          onMenuOpenChange={(open) => setOpenMenuId(open ? session.id : null)}
        />
      ))}
      {props.paged !== false && props.sessions.length > limit && (
        <button
          type="button"
          className="flex items-center cursor-pointer text-[12px] font-[400] leading-[18px] text-[var(--neutral-400)] hover:text-[var(--neutral-600)] transition-colors px-2.5 py-1"
          onClick={() => setLimit(limit + 10)}
        >
          {t("kcode.session.showMore")}
        </button>
      )}
    </div>
  )
}

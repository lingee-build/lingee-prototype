import { useState } from "react"
import { DropdownMenu, Icon, Tooltip, showToast } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { Project, Session } from "@/mock/types"
import { useLayout } from "@/stores/layout"
import { useSync } from "@/stores/sync"
import { GroupHeader } from "./GroupHeader"
import { SessionList } from "./SessionList"
import { byUpdated, groupSessionsByDate } from "./helpers"
import type { SidebarActions } from "./use-sidebar-actions"

const ICON_BUTTON =
  "flex items-center justify-center cursor-pointer hover:bg-[var(--neutral-100)] transition-colors w-7 h-7 rounded-[8px] hover:[--icon-fill:var(--neutral-900)]"

function ProjectGroup(props: { project: Project; sessions: Session[]; actions: SidebarActions; loading: boolean }) {
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const expanded = useLayout((s) => s.expandedGroups.includes(props.project.id))
  const toggleGroup = useLayout((s) => s.toggleGroup)
  const { project, actions } = props

  return (
    <div>
      <GroupHeader
        label={project.name}
        expanded={expanded}
        onToggle={() => toggleGroup(project.id)}
        rightSlot={
          <div
            className={cx(
              "transition-opacity flex items-center gap-1",
              menuOpen ? "opacity-100" : "opacity-0 group-hover/project:opacity-100",
            )}
            style={{ marginLeft: "auto" }}
          >
            <Tooltip value={t("kcode.nav.add")} placement="top">
              <button type="button" className={ICON_BUTTON} onClick={() => actions.newTask(project.id)}>
                <Icon name="plus-16" size="small" />
              </button>
            </Tooltip>
            <DropdownMenu placement="bottom-end" open={menuOpen} onOpenChange={setMenuOpen}>
              <Tooltip value={t("kcode.nav.more")} placement="top">
                <DropdownMenu.Trigger className={ICON_BUTTON}>
                  <Icon name="side-more" size="small" className="text-[var(--neutral-700)]" />
                </DropdownMenu.Trigger>
              </Tooltip>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="project-actions-menu">
                  <DropdownMenu.Item onSelect={() => showToast({ title: project.worktree })} className="flex items-center cursor-pointer gap-1">
                    <Icon name="folder-16" size="small" className="text-[var(--neutral-600)]" />
                    <span>{t("kcode.project.openFolder")}</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onSelect={() => actions.renameProject(project.id)} className="flex items-center cursor-pointer gap-1">
                    <Icon name="pencil-16" size="small" className="text-[var(--neutral-600)]" />
                    <span>{t("kcode.project.editName")}</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => actions.deleteProject(project.id)}
                    className="group/project flex items-center cursor-pointer gap-1"
                    variant="destructive"
                  >
                    <Icon name="trash-16" size="small" className="text-[var(--neutral-600)] group-hover/project:text-[var(--danger-600)]" />
                    <span>{t("kcode.session.delete")}</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu>
          </div>
        }
      />
      {expanded && <SessionList sessions={props.sessions} actions={actions} loading={props.loading} />}
    </div>
  )
}

/** 会话区：置顶 + 三种分组方式（按项目 / 按日期 / 不分组） */
export function SessionGroups(props: { actions: SidebarActions }) {
  const t = useT()
  const { projects, sessions, ready } = useSync()
  const { groupBy, selectedProjects, pinnedSessions, expandedGroups, toggleGroup } = useLayout()
  const [pinnedExpanded, setPinnedExpanded] = useState(true)

  const visibleProjects = selectedProjects ? projects.filter((x) => selectedProjects.includes(x.id)) : projects
  const visibleIds = new Set(visibleProjects.map((x) => x.id))
  const pinned = pinnedSessions.flatMap((id) => sessions.filter((x) => x.id === id))
  const rest = sessions.filter((x) => visibleIds.has(x.projectId) && !pinnedSessions.includes(x.id)).sort(byUpdated)

  return (
    <div
      data-component="sidebar-session-scroll"
      data-slot="sidebar-scroll"
      className="flex-1 min-h-0 overflow-y-auto px-2 pl-4 [overflow-anchor:none] [scrollbar-gutter:stable]"
      style={{ contain: "layout style" }}
    >
      {pinned.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            className="group/project flex h-8 items-center gap-2 flex-1 bg-transparent border-none p-0 cursor-pointer transition-colors"
            onClick={() => setPinnedExpanded(!pinnedExpanded)}
          >
            <span
              className="text-[var(--neutral-600)] text-[12px] font-normal leading-[18px] group-hover/project:text-[var(--neutral-700)]"
              title={t("kcode.nav.pinned")}
            >
              {t("kcode.nav.pinned")}
            </span>
            <span className="flex items-center opacity-0 group-hover/project:opacity-100 transition-opacity">
              <Icon name={pinnedExpanded ? "chevron-down-16" : "chevron-right-16"} size="small" className="text-[var(--neutral-700)]" />
            </span>
          </button>
          {pinnedExpanded && <SessionList sessions={pinned} actions={props.actions} paged={false} />}
        </div>
      )}

      <div className="flex flex-col">
        {groupBy === "project" &&
          visibleProjects.map((project) => (
            <ProjectGroup
              key={project.id}
              project={project}
              sessions={rest.filter((x) => x.projectId === project.id)}
              actions={props.actions}
              loading={!ready}
            />
          ))}

        {groupBy === "date" &&
          groupSessionsByDate(rest).map((group) => (
            <div key={group.key}>
              <GroupHeader
                label={t(`kcode.nav.${group.key}`)}
                expanded={expandedGroups.includes(group.key)}
                onToggle={() => toggleGroup(group.key)}
              />
              {expandedGroups.includes(group.key) && <SessionList sessions={group.items} actions={props.actions} />}
            </div>
          ))}

        {groupBy === "none" && (
          <>
            <span
              style={{
                display: "block",
                marginTop: 12,
                marginBottom: 4,
                color: "var(--neutral-500, rgba(0, 0, 0, 0.46))",
                fontFamily: '"PingFang SC"',
                fontSize: 12,
                fontWeight: 500,
                lineHeight: "18px",
              }}
            >
              {t("kcode.nav.recent")}
            </span>
            <SessionList sessions={rest} actions={props.actions} loading={!ready} />
          </>
        )}
      </div>
    </div>
  )
}

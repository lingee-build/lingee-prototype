import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { Button, DropdownMenu, Icon, Tooltip } from "@/ui"
import { inlinePaths } from "@/ui/icon/inline-paths.gen"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { useSync } from "@/stores/sync"

const MUTED = "var(--fg-color-black-muted, rgba(0, 0, 0, 0.64))"

/** 新会话时输入框下方的项目选择（git 项目会额外带出当前分支） */
export function ProjectPicker(props: { projectId: string; onCreateProject: () => void }) {
  const header = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    const element = header.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      element.classList.remove("collapsed")
      const required = Array.from(element.children).reduce((width, child) => width + child.getBoundingClientRect().width, 28)
      const next = element.clientWidth < Math.max(420, required)
      element.classList.toggle("collapsed", next)
      setCollapsed(next)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const t = useT()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const projects = useSync((s) => s.projects)
  const current = projects.find((x) => x.id === props.projectId)

  return (
    <div ref={header} data-component="prompt-new-session-header" className={cx("shrink-0 flex items-center flex-wrap px-3 pt-1 pb-1", collapsed && "collapsed")} style={{ gap: "var(--2x-small, 4px)" }}>
      <div data-component="prompt-project-top-control">
        <DropdownMenu placement="bottom-start" gutter={10} open={open} onOpenChange={setOpen}>
          <DropdownMenu.Trigger asChild>
            <Button
              variant="ghost"
              size="normal"
              className="group max-w-[280px] rounded-[8px] border-none bg-transparent hover:[--fg-color-black-muted:var(--fg-color-black-muted-hover)] data-[expanded]:[--fg-color-black-muted:var(--fg-color-black-muted-hover)]"
              style={{ display: "flex", height: 32, padding: "0 var(--x-small, 8px)", flexDirection: "column", justifyContent: "center", alignItems: "center" }}
              data-action="prompt-project-top"
            >
              <span className="flex items-center min-w-0 w-full" style={{ gap: "var(--2x-small, 4px)" }}>
                <Icon name="folder-group" size="small" className="size-4 shrink-0" style={{ color: MUTED }} />
                <span
                  title={current?.name}
                  className="truncate prompt-new-session-name"
                  style={{ color: MUTED, fontSize: "var(--font-size-small-14, 14px)", fontWeight: 400, lineHeight: "18px" }}
                >
                  {current?.name}
                </span>
                {current?.git ? (
                  <Icon name="chevron-right-16" size="small" className="size-4 shrink-0" style={{ color: MUTED }} />
                ) : (
                  <Icon
                    name="chevron-down"
                    size="small"
                    className={cx("size-4 shrink-0 transition-transform duration-200", open && "rotate-180")}
                    style={{ color: MUTED }}
                  />
                )}
              </span>
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content>
              <div className="flex flex-col gap-[2px] overflow-y-auto" style={{ maxHeight: 202 }}>
                {projects.map((project) => (
                  <DropdownMenu.Item
                    key={project.id}
                    onSelect={() => navigate(`/p/${project.id}/session`)}
                    className={cx(
                      "flex items-center justify-between cursor-pointer gap-1 text-[var(--neutral-700)]",
                      project.id === props.projectId && "text-[var(--neutral-900)]",
                    )}
                  >
                    <Tooltip
                      placement="top"
                      value={project.worktree}
                      contentStyle={{ wordBreak: "break-all", whiteSpace: "normal", maxWidth: 400 }}
                      className="flex-1 min-w-0"
                    >
                      <span className="min-w-0 max-w-[200px] truncate text-[14px] font-[400] leading-[20px]">{project.name}</span>
                    </Tooltip>
                    {project.id === props.projectId && <Icon name="check" size="small" className="ml-3 shrink-0 text-[var(--neutral-600)]" />}
                  </DropdownMenu.Item>
                ))}
              </div>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                onSelect={props.onCreateProject}
                className="group flex items-center cursor-pointer gap-2 text-[var(--neutral-700)] active:text-[var(--neutral-900)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ width: 16, height: 16, flexShrink: 0 }}>
                  <path d={inlinePaths.folderPlus} fill="currentColor" />
                </svg>
                <span className="text-[var(--neutral-700)] text-[14px] font-[400] leading-[20px] group-active:text-[var(--neutral-900)]">
                  {t("kcode.nav.newProject")}
                </span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu>
      </div>
      {current?.git && current.branch && (
        <span className="inline-flex items-center gap-1 h-8 px-2 rounded-[8px]" style={{ color: MUTED, fontSize: 14, lineHeight: "18px" }}>
          <Icon name="git-branch-network" size="small" className="size-4 shrink-0" style={{ color: MUTED }} />
          <span className="truncate prompt-new-session-name max-w-[200px]" title={current.branch}>
            {current.branch}
          </span>
          <Icon name="chevron-right-16" size="small" style={{ color: MUTED }} />
        </span>
      )}
    </div>
  )
}

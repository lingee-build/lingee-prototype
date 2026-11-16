import { Suspense } from "react"
import { Outlet, useParams } from "react-router"
import { Icon, Tooltip } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { Sidebar } from "@/features/sidebar/Sidebar"
import { useLayout } from "@/stores/layout"
import { useRestoreSidebar } from "@/features/workflow/open-canvas"

/** 主框架：左侧栏（可收起）+ 右侧内容区，结构与过渡动画对齐原工程 pages/layout.tsx */
export function AppShell() {
  const t = useT()
  const params = useParams()
  const { sidebarOpened, sidebarWidth, toggleSidebar } = useLayout()
  useRestoreSidebar()
  const side = sidebarOpened ? sidebarWidth : 0
  const toggleLabel = t(sidebarOpened ? "command.sidebar.close" : "command.sidebar.open")

  return (
    <div className="relative flex-1 min-h-0 min-w-0 flex flex-col select-none [&_input]:select-text [&_textarea]:select-text [&_[contenteditable]]:select-text">
      <div className="flex-1 min-h-0 min-w-0 flex">
        <div className="flex-1 min-h-0 relative">
          <div className="size-full relative overflow-x-hidden">
            <nav
              aria-label={t("sidebar.nav.projectsAndSessions")}
              data-component="sidebar-nav-desktop"
              className="absolute inset-y-0 left-0 overflow-hidden z-10 bg-background-sidebar transform-gpu transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none"
              style={{ width: sidebarWidth, transform: sidebarOpened ? "translateX(0)" : `translateX(-${sidebarWidth}px)` }}
            >
              <div className="@container w-full h-full contain-strict">
                <Sidebar />
              </div>
            </nav>

            <div className="absolute z-50" style={{ top: 12, left: 8 }}>
              <Tooltip placement="right" value={toggleLabel} openDelay={300}>
                <button
                  type="button"
                  className="p-0 w-7 h-7 border-none bg-transparent cursor-pointer inline-flex items-center justify-center outline-none rounded-[8px] text-[var(--icon-fill)] hover:bg-[var(--icon-bg-hover)] transition-colors active:[--icon-fill:var(--icon-fill-active)]"
                  onClick={toggleSidebar}
                  aria-label={toggleLabel}
                >
                  <Icon name={sidebarOpened ? "sidepanel-close" : "sidepanel-open"} size="small" />
                </button>
              </Tooltip>
            </div>

            <div
              className="absolute inset-0 inset-y-0 right-0 left-0 z-20 transform-gpu transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none"
              style={{ transform: `translateX(${side}px)`, width: sidebarOpened ? `calc(100% - ${side}px)` : "100%" }}
            >
              <main
                className={cx(
                  "size-full overflow-x-hidden flex flex-col items-start contain-strict bg-[var(--main-bg)]",
                  params.sessionId && "overflow-hidden",
                )}
              >
                <Suspense fallback={<div className="size-full" />}>
                  <Outlet />
                </Suspense>
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

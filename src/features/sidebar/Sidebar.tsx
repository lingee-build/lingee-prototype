import { useEffect } from "react"
import { useDialog } from "@/ui"
import { NavSection } from "./NavSection"
import { ProjectsHeader } from "./ProjectsHeader"
import { SearchDialog } from "./SearchDialog"
import { SessionGroups } from "./SessionGroups"
import { UserMenu } from "./UserMenu"
import { useSidebarActions } from "./use-sidebar-actions"

/** 左侧栏：导航 → 项目/会话 → 用户入口。各区块各自成文件，这里只做拼装 */
export function Sidebar() {
  const dialog = useDialog()
  const actions = useSidebarActions()
  const openSearch = () => dialog.show(() => <SearchDialog onNewTask={() => actions.newTask()} />)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return
      e.preventDefault()
      openSearch()
    }
    window.addEventListener("keydown", onKeyDown, { capture: true })
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true })
  })

  return (
    <div data-component="sidebar-nav" className="h-full flex flex-col overflow-hidden max-w-[300px] bg-background-sidebar rounded-l-[32px]">
      <NavSection onNewTask={() => actions.newTask()} />
      <ProjectsHeader onSearch={openSearch} onCreateProject={() => void actions.createProject()} onImportProject={() => void actions.importProject()} />
      <SessionGroups actions={actions} />
      <UserMenu />
    </div>
  )
}

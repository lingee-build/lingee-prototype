import { useEffect } from "react"
import { useLayout } from "@/stores/layout"
import { usePanel } from "@/stores/panel"

const RESTORE_KEY = "lingee-prototype.workflow.sidebar-restore"

/** 收起 Build 左侧边栏，并记下「是工作流画布收起的」，画布关闭时由 useCollapseSidebar 恢复 */
export function collapseSidebarForCanvas() {
  if (!useLayout.getState().sidebarOpened) return
  sessionStorage.setItem(RESTORE_KEY, "1")
  useLayout.setState({ sidebarOpened: false })
}

/** 画布打开期间收起侧边栏，卸载时恢复；期间仍可用左上角按钮手动展开 */
export function useCollapseSidebar() {
  useEffect(() => {
    collapseSidebarForCanvas()
    return () => {
      if (!sessionStorage.getItem(RESTORE_KEY)) return
      sessionStorage.removeItem(RESTORE_KEY)
      useLayout.setState({ sidebarOpened: true })
    }
  }, [])
}

/**
 * 兜底：画布收起了侧边栏，但页面被整页刷新或跳走（卸载清理来不及执行）时，
 * 只要当前没有打开工作流画布，就把侧边栏恢复。挂在 AppShell 上，随路由与面板变化检查。
 */
export function useRestoreSidebar() {
  const canvasOpen = usePanel((s) => s.view === "drawer" && s.drawer?.kind === "workflow")
  useEffect(() => {
    if (canvasOpen || !sessionStorage.getItem(RESTORE_KEY)) return
    const timer = setTimeout(() => {
      if (usePanel.getState().drawer?.kind === "workflow" || !sessionStorage.getItem(RESTORE_KEY)) return
      sessionStorage.removeItem(RESTORE_KEY)
      useLayout.setState({ sidebarOpened: true })
    }, 300)
    return () => clearTimeout(timer)
  }, [canvasOpen])
}

/** 在会话右侧打开工作流画布；已经打开时保持打开（对话改画布时调用，不做开合切换） */
export function openWorkflowCanvas(id: string, title: string) {
  const panel = usePanel.getState()
  if (panel.view === "drawer" && panel.drawer?.kind === "workflow" && panel.drawer.id === id) return
  collapseSidebarForCanvas()
  panel.toggleDrawer({ kind: "workflow", id, title })
}

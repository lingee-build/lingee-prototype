import { create } from "zustand"
import { persist } from "zustand/middleware"

export type GroupByMode = "project" | "date" | "none"

interface LayoutState {
  sidebarOpened: boolean
  sidebarWidth: number
  groupBy: GroupByMode
  /** null 表示「所有项目」 */
  selectedProjects: string[] | null
  expandedGroups: string[]
  pinnedSessions: string[]
  toggleSidebar: () => void
  setGroupBy: (mode: GroupByMode) => void
  setSelectedProjects: (ids: string[] | null) => void
  toggleGroup: (key: string) => void
  expandGroup: (key: string) => void
  togglePinned: (sessionId: string) => void
}

/** 纯界面状态（侧边栏开合、分组方式、置顶等），持久化到 localStorage */
export const useLayout = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarOpened: true,
      sidebarWidth: 280,
      groupBy: "project",
      selectedProjects: null,
      expandedGroups: ["scm-skills", "hr-assistant"],
      pinnedSessions: [],
      toggleSidebar: () => set((s) => ({ sidebarOpened: !s.sidebarOpened })),
      setGroupBy: (groupBy) => set({ groupBy }),
      setSelectedProjects: (selectedProjects) => set({ selectedProjects }),
      toggleGroup: (key) =>
        set((s) => ({
          expandedGroups: s.expandedGroups.includes(key)
            ? s.expandedGroups.filter((x) => x !== key)
            : [...s.expandedGroups, key],
        })),
      expandGroup: (key) =>
        set((s) => (s.expandedGroups.includes(key) ? s : { expandedGroups: [...s.expandedGroups, key] })),
      togglePinned: (sessionId) =>
        set((s) => ({
          pinnedSessions: s.pinnedSessions.includes(sessionId)
            ? s.pinnedSessions.filter((x) => x !== sessionId)
            : [sessionId, ...s.pinnedSessions],
        })),
    }),
    { name: "lingee-prototype.layout" },
  ),
)

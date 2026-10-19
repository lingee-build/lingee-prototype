import { create } from "zustand"

export type PreviewView = "review" | "fileTree" | "wiki" | "drawer"

/** 右侧面板里打开的「产物抽屉」：技能预览 / 智能体配置 / 业务组件详情 */
export interface DrawerTarget {
  kind: "kdskill" | "agentConfig" | "kdapp-artifact"
  id: string
  title: string
}

interface PanelState {
  /** 右侧预览面板当前显示的视图；几种视图互斥，undefined 表示面板收起 */
  view?: PreviewView
  drawer?: DrawerTarget
  /** 会话区是否被折叠（预览面板占满整行） */
  sessionCollapsed: boolean
  fileTreeWidth: number
  /** 文件树视图里左侧的树是否被隐藏（只留文件内容） */
  treeHidden: boolean
  /** 已打开的文件路径，顺序即标签顺序 */
  files: string[]
  active?: string
  toggleView: (view: Exclude<PreviewView, "drawer">) => void
  /** 打开产物抽屉；对同一个产物再点一次则收起（和线上点卡片的行为一致） */
  toggleDrawer: (target: DrawerTarget) => void
  closeDrawer: () => void
  toggleSessionCollapsed: () => void
  setTreeHidden: (hidden: boolean) => void
  openFile: (path: string) => void
  closeFile: (path: string) => void
  closeOthers: (path: string) => void
  closeToRight: (path: string) => void
  closeAll: () => void
  setActive: (path: string) => void
  reset: () => void
}

const initial = {
  view: undefined as PreviewView | undefined,
  drawer: undefined as DrawerTarget | undefined,
  sessionCollapsed: false,
  treeHidden: false,
  files: [] as string[],
  active: undefined as string | undefined,
}

/** 会话右侧预览面板的状态：当前视图、文件树、已打开的文件标签 */
export const usePanel = create<PanelState>((set) => ({
  ...initial,
  fileTreeWidth: 200,
  toggleView: (view) => set((s) => (s.view === view ? { view: undefined, sessionCollapsed: false } : { view })),
  toggleDrawer: (target) =>
    set((s) =>
      s.view === "drawer" && s.drawer?.kind === target.kind && s.drawer.id === target.id
        ? { view: undefined, drawer: undefined, sessionCollapsed: false }
        : { view: "drawer", drawer: target },
    ),
  closeDrawer: () => set({ view: undefined, drawer: undefined, sessionCollapsed: false }),
  toggleSessionCollapsed: () => set((s) => ({ sessionCollapsed: !s.sessionCollapsed })),
  setTreeHidden: (treeHidden) => set({ treeHidden }),
  // 从任何地方打开文件（审查里的「打开文件」、消息里的文件链接）都切到文件树视图
  openFile: (path) => set((s) => ({ view: "fileTree", active: path, files: s.files.includes(path) ? s.files : [...s.files, path] })),
  closeFile: (path) =>
    set((s) => {
      const files = s.files.filter((x) => x !== path)
      if (s.active !== path) return { files }
      // 关掉当前标签：优先落到右边相邻的，其次左边
      const index = s.files.indexOf(path)
      return { files, active: files[index] ?? files[index - 1], treeHidden: files.length === 0 ? false : s.treeHidden }
    }),
  closeOthers: (path) => set({ files: [path], active: path }),
  closeToRight: (path) =>
    set((s) => {
      const files = s.files.slice(0, s.files.indexOf(path) + 1)
      return { files, active: s.active && files.includes(s.active) ? s.active : path }
    }),
  closeAll: () => set({ files: [], active: undefined, treeHidden: false }),
  setActive: (active) => set({ active }),
  reset: () => set(initial),
}))

import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * 个人技能库（US-2026-082714）：安装 = 把项目技能当前内容复制一份到用户目录，
 * 形成独立的个人技能，跨工程可用。同名判定只看技能名，与所在工程无关。
 */
export interface PersonalSkill {
  /** 技能名，来自 SKILL.md；同名判定的唯一键 */
  name: string
  displayName: string
  desc: string
  /** 来源工程，仅用于展示 */
  projectId: string
  projectName: string
  installedAt: string
  /** 覆盖同名技能时保持覆盖前的启用状态 */
  enabled: boolean
}

export type InstallInput = Omit<PersonalSkill, "installedAt" | "enabled">

interface PersonalSkillState {
  items: PersonalSkill[]
  /** 没有同名就新增（默认启用）；有同名就整份替换内容，启用状态沿用旧的 */
  install: (input: InstallInput) => void
  uninstall: (name: string) => void
  setEnabled: (name: string, enabled: boolean) => void
}

const stamp = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 预置两条，便于评审直接看覆盖警告与停用状态；「发货通知单查询」项目里也有同名技能 */
const SEED: PersonalSkill[] = [
  {
    name: "delivery-notice-query",
    displayName: "发货通知单查询",
    desc: "按单据编号、状态和通知日期组合筛选发货通知单。",
    projectId: "scm-skills",
    projectName: "供应链技能包",
    installedAt: "2026-11-10 09:24",
    enabled: true,
  },
  {
    name: "leave-request",
    displayName: "办理请假申请",
    desc: "通过对话收集假期类型、起止日期、事由与代理人。",
    projectId: "hr-assistant",
    projectName: "HR 智能助手",
    installedAt: "2026-11-12 15:02",
    enabled: false,
  },
]

export const usePersonalSkills = create<PersonalSkillState>()(
  persist(
    (set) => ({
      items: SEED,
      install: (input) =>
        set((state) => {
          const exists = state.items.find((x) => x.name === input.name)
          // 覆盖：内容整份替换，但启用状态沿用覆盖前的（AC-4 停用的仍停用）
          const next: PersonalSkill = { ...input, installedAt: stamp(), enabled: exists ? exists.enabled : true }
          return { items: exists ? state.items.map((x) => (x.name === input.name ? next : x)) : [...state.items, next] }
        }),
      uninstall: (name) => set((state) => ({ items: state.items.filter((x) => x.name !== name) })),
      setEnabled: (name, enabled) =>
        set((state) => ({ items: state.items.map((x) => (x.name === name ? { ...x, enabled } : x)) })),
    }),
    // 原型演示用：个人技能库落在 localStorage，刷新和重新打开页面后安装结果还在
    { name: "proto-personal-skills", partialize: (state) => ({ items: state.items }) },
  ),
)

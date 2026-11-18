import { create } from "zustand"
import { persist } from "zustand/middleware"

/** 原型的租户（单租户演示） */
export const DEMO_TENANT = { id: "kingdee-demo", name: "金蝶演示租户" }

/** Work 中「我开发的」智能体实例：同一用户 + 同一租户 + 同一个 Build 智能体只保留一个 */
export interface DevelopedAgent {
  /** 实例唯一键：tenant:account:sourceAgentId */
  key: string
  tenantId: string
  /** "*" = 演示种子，任何账号都可见 */
  account: string
  sourceAgentId: string
  sourceProjectId: string
  name: string
  desc: string
  avatar: string
  /** 包内技能：随智能体安装，不生成独立技能资产 */
  skills: Array<{ name: string; displayName: string; desc: string }>
  /** 仅引用 */
  knowledgeRefs: string[]
  mcpRefs: string[]
  installedAt: string
}

/** Work 中「我添加的」智能体（来自市场、企业资源），演示数据 */
export interface AddedAgent {
  id: string
  name: string
  desc: string
  avatar: string
  source: "市场" | "企业资源"
  skills: Array<{ displayName: string; desc: string }>
}

export const ADDED_AGENTS: AddedAgent[] = [
  { id: "mk-travel", name: "差旅出行助手", desc: "按差旅标准推荐航班与酒店，自动生成出差申请。", avatar: "/avatar-agent-2.png", source: "市场", skills: [{ displayName: "差旅标准查询", desc: "查询职级对应的交通与住宿标准。" }] },
  { id: "ent-scm", name: "供应链协同助手", desc: "覆盖采购、库存、发货全链路的问答与单据处理。", avatar: "/preset-agent-avatar-1.png", source: "企业资源", skills: [{ displayName: "发货通知单查询", desc: "按单据编号、状态筛选发货通知单。" }, { displayName: "即时库存查询", desc: "按物料、仓库查询即时库存。" }] },
  { id: "ent-hr", name: "HR 智能助手", desc: "解答假期、薪资、入转调离等员工高频问题。", avatar: "/preset-agent-avatar-2.png", source: "企业资源", skills: [{ displayName: "办理请假申请", desc: "收集请假信息并生成请假单草稿。" }] },
]

/** 演示种子：Build 源智能体已删除的个人安装实例（可用，但不能跳转编辑） */
const SEED: DevelopedAgent[] = [
  {
    key: `${DEMO_TENANT.id}:*:visit-minutes-assistant`,
    tenantId: DEMO_TENANT.id,
    account: "*",
    sourceAgentId: "visit-minutes-assistant",
    sourceProjectId: "workspace",
    name: "客户拜访纪要助手",
    desc: "根据拜访录音要点整理拜访纪要，提取客户诉求与跟进事项。",
    avatar: "/avatar-agent-3.png",
    skills: [{ name: "visit-minutes", displayName: "拜访纪要整理", desc: "整理拜访要点并输出纪要。" }],
    knowledgeRefs: [],
    mcpRefs: [],
    installedAt: "2026-11-05 10:12",
  },
]

export const instanceKey = (tenantId: string, account: string, agentId: string) => `${tenantId}:${account}:${agentId}`

const stamp = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface WorkAgentState {
  developed: DevelopedAgent[]
  /** 演示：已「去修复」过的 Build 智能体，再次安装检测通过 */
  fixed: string[]
  /** 首次安装新建实例；重复安装整份覆盖同一实例 */
  install: (input: Omit<DevelopedAgent, "key" | "installedAt">) => void
  uninstall: (key: string) => void
  markFixed: (agentId: string) => void
}

export const useWorkAgents = create<WorkAgentState>()(
  persist(
    (set) => ({
      developed: SEED,
      fixed: [],
      install: (input) =>
        set((state) => {
          const key = instanceKey(input.tenantId, input.account, input.sourceAgentId)
          const next: DevelopedAgent = { ...input, key, installedAt: stamp() }
          const exists = state.developed.some((x) => x.key === key)
          return { developed: exists ? state.developed.map((x) => (x.key === key ? next : x)) : [next, ...state.developed] }
        }),
      uninstall: (key) => set((state) => ({ developed: state.developed.filter((x) => x.key !== key) })),
      markFixed: (agentId) => set((state) => ({ fixed: state.fixed.includes(agentId) ? state.fixed : [...state.fixed, agentId] })),
    }),
    { name: "proto-work-agents" },
  ),
)

/** 当前账号可见的「我开发的」 */
export const visibleDeveloped = (items: DevelopedAgent[], account?: string) =>
  items.filter((x) => x.tenantId === DEMO_TENANT.id && (x.account === "*" || x.account === account))

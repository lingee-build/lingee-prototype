import { currentDisplayName } from "@/stores/auth"
import { devStore as store } from "@/mock/dev-store"
import type { Agent, AgentChangeRecord, McpApp, Skill } from "@/mock/fixtures/dev"
import { knowledgeDocs, knowledgeTree } from "@/mock/fixtures/knowledge"
import { latency } from "@/mock/latency"

/** 三个开发页的数据服务（mock）。增删改都落在内存里，刷新页面恢复初始数据 */
export const skillService = {
  list: () => latency(store.skills, 350),
  get: (idOrName: string) => latency(store.skills.find((x) => x.id === idOrName || x.name === idOrName), 150),
  remove(ids: string[]) {
    store.skills = store.skills.filter((x) => !ids.includes(x.id))
    return latency(true)
  },
  patch(id: string, patch: Partial<Skill>) {
    store.skills = store.skills.map((x) => (x.id === id ? { ...x, ...patch } : x))
    return latency(true)
  },
}

export const agentService = {
  list: () => latency(store.agents, 350),
  get: (id: string) => latency(store.agents.find((x) => x.id === id), 150),
  remove(id: string) {
    store.agents = store.agents.filter((x) => x.id !== id)
    return latency(true)
  },
  patch(id: string, patch: Partial<Agent>) {
    store.agents = store.agents.map((x) => (x.id === id ? { ...x, ...patch } : x))
    return latency(true)
  },
  /** 保存配置面板的改动：本地标成「已编辑未提交」，并把改动摘要记进待发布列表 */
  save(id: string, patch: Partial<Agent>, changes: string[]) {
    const now = new Date().toISOString()
    const records: AgentChangeRecord[] = changes.map((summary) => ({ createdAt: now, operator: currentDisplayName(), summary }))
    store.agents = store.agents.map((x) =>
      x.id === id
        ? { ...x, ...patch, status: "saved", isChanged: !!x.backendStatus, changelog: { ...x.changelog, pending: [...x.changelog.pending, ...records] } }
        : x,
    )
    return latency(store.agents.find((x) => x.id === id), 300)
  },
  /** 提交审核：待发布的改动归到一个新版本里 */
  submit(id: string) {
    store.agents = store.agents.map((x) => {
      if (x.id !== id) return x
      const last = x.changelog.versions[x.changelog.versions.length - 1]?.version
      const [major = 1, minor = 0, fix = 0] = (last ?? "0.0.0").split(".").map(Number)
      const version = last ? `${major}.${minor}.${fix + 1}` : "1.0.0"
      return {
        ...x,
        status: "submitted",
        backendStatus: "submitted",
        isChanged: false,
        rejectionRemark: undefined,
        changelog: {
          pending: [],
          versions: [...x.changelog.versions, { version, releasedAt: new Date().toISOString(), operator: currentDisplayName(), lines: x.changelog.pending.map((r) => r.summary).filter((s) => s !== "创建智能体") }],
        },
      }
    })
    return latency(true, 900)
  },
  /** 撤回：回到提交前——最后一个版本作废，改动退回待发布 */
  withdraw(id: string) {
    store.agents = store.agents.map((x) => {
      if (x.id !== id) return x
      const last = x.changelog.versions[x.changelog.versions.length - 1]
      const restored: AgentChangeRecord[] = (last?.lines ?? []).map((summary) => ({ createdAt: last.releasedAt, operator: last.operator, summary }))
      return {
        ...x,
        status: "saved",
        backendStatus: undefined,
        isChanged: false,
        changelog: { pending: [...restored, ...x.changelog.pending], versions: x.changelog.versions.slice(0, -1) },
      }
    })
    return latency(true, 700)
  },
}

export const mcpAppService = {
  list: () => latency(store.mcpApps, 350),
  get: (appCode: string) => latency(store.mcpApps.find((x) => x.appCode === appCode), 150),
  remove(appCode: string) {
    store.mcpApps = store.mcpApps.filter((x) => x.appCode !== appCode)
    return latency(true)
  },
  patch(appCode: string, patch: Partial<McpApp>) {
    store.mcpApps = store.mcpApps.map((x) => (x.appCode === appCode ? { ...x, ...patch } : x))
    return latency(store.mcpApps.find((x) => x.appCode === appCode))
  },
  create(app: McpApp) {
    store.mcpApps = [...store.mcpApps.filter((x) => x.appCode !== app.appCode), app]
    return latency(app, 600)
  },
  /** 构建打包：补丁版本号 +1，追加一条产物记录 */
  package(appCode: string, changeDesc: string) {
    const app = store.mcpApps.find((x) => x.appCode === appCode)
    if (!app) return latency(undefined)
    const [major = 1, minor = 0, fix = 0] = app.version.split(".").map(Number)
    const version = app.artifacts.length ? `${major}.${minor}.${fix + 1}` : app.version
    const next: McpApp = {
      ...app,
      version,
      buildStatus: "success",
      artifacts: [...app.artifacts, { version, createdAt: new Date().toISOString(), changeDesc }],
      // 打包只回写版本号；info.json 里缺的必填项不会被自动补上（要靠「修复」让模型补）
      info: app.info ? { ...app.info, version } : app.info,
    }
    store.mcpApps = store.mcpApps.map((x) => (x.appCode === appCode ? next : x))
    return latency(next, 1800)
  },
}

/** 企业知识库（mock）：目录树一次给全，文档按目录或关键字取 */
export const knowledgeService = {
  tree: () => latency(knowledgeTree, 400),
  docs: (categoryIds: string[]) => latency(knowledgeDocs.filter((x) => categoryIds.includes(x.categoryId)), 300),
  search(keyword: string) {
    const q = keyword.trim().toLowerCase()
    return latency(knowledgeDocs.filter((x) => x.name.toLowerCase().includes(q) || (x.creatorName ?? "").toLowerCase().includes(q)), 300)
  },
}

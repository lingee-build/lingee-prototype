import type { Scenario } from "./types"
import { db } from "../db"
import { devStore } from "../dev-store"

/**
 * 技能/智能体本地测试会话中引用业务组件的 mock 场景。
 *
 * 对应 PRD 功能点 2「技能引用组件测试」：
 * - 技能本地测试会话中，模型通过技能调用关联的组件（componentRef）
 * - 组件以内联卡片形式渲染，错误态与组件直测一致
 *
 * 对应 PRD 功能点 3「智能体→技能→组件测试」：
 * - 智能体本地测试会话中，模型通过智能体→技能→组件链路调用组件
 * - 组件渲染效果与技能直测一致，多一步「选择技能」环节
 */

/** 从 session.localTest.objectId 解析类型和 ID */
function parseLocalTest(sessionId: string): { kind: string; id: string } | undefined {
  const session = db.sessions.find((x) => x.id === sessionId)
  if (!session?.localTest?.objectId) return undefined
  const [kind, id] = session.localTest.objectId.split(":")
  if (!kind || !id) return undefined
  return { kind, id }
}

/** 判断组件是否有关联 MCP 工具 */
function hasMcpTools(appCode: string): boolean {
  const app = devStore.mcpApps.find((x) => x.appCode === appCode)
  if (!app?.info) return false
  const connectors = (app.info as Record<string, unknown>).mcpConnector
  return Array.isArray(connectors) && connectors.length > 0
}

/** 获取组件关联的工具名称 */
function toolNamesOf(appCode: string): string[] {
  const app = devStore.mcpApps.find((x) => x.appCode === appCode)
  if (!app?.info) return []
  const connectors = (app.info as Record<string, unknown>).mcpConnector
  if (!Array.isArray(connectors)) return []
  return connectors
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .flatMap((conn) =>
      (Array.isArray(conn.relateTools) ? conn.relateTools : [])
        .map((tool) => (tool && typeof tool === "object" ? (tool as Record<string, unknown>).name : undefined))
        .filter((name): name is string => typeof name === "string" && name.length > 0),
    )
}

/** 从技能本地测试会话中查找引用的组件 */
function componentFromSkill(skillId: string): { appCode: string; skillName: string; skillDisplayName: string } | undefined {
  const skill = devStore.skills.find((s) => s.id === skillId || s.name === skillId)
  if (!skill?.componentRef) return undefined
  return { appCode: skill.componentRef, skillName: skill.name, skillDisplayName: skill.displayName }
}

/** 从智能体本地测试会话中查找引用了组件的技能 */
function componentFromAgent(agentId: string): { appCode: string; skillName: string; skillDisplayName: string; agentName: string } | undefined {
  const agent = devStore.agents.find((a) => a.id === agentId || a.name === agentId)
  if (!agent?.skills) return undefined
  for (const ref of agent.skills) {
    const skill = devStore.skills.find((s) => s.name === ref.skillName || s.name === ref.id)
    if (skill?.componentRef) {
      return { appCode: skill.componentRef, skillName: skill.name, skillDisplayName: skill.displayName, agentName: agent.name }
    }
  }
  return undefined
}

/**
 * 构建技能/智能体引用组件的测试场景。
 * 返回 undefined 表示不匹配（由调用方回退到其他场景）。
 */
export function skillComponentTestScenario(sessionId: string): Scenario | undefined {
  const parsed = parseLocalTest(sessionId)
  if (!parsed) return undefined

  let appCode: string
  let skillName: string
  let skillDisplayName: string
  let agentName: string | undefined

  if (parsed.kind === "skill") {
    const result = componentFromSkill(parsed.id)
    if (!result) return undefined
    appCode = result.appCode
    skillName = result.skillName
    skillDisplayName = result.skillDisplayName
  } else if (parsed.kind === "agent") {
    const result = componentFromAgent(parsed.id)
    if (!result) return undefined
    appCode = result.appCode
    skillName = result.skillName
    skillDisplayName = result.skillDisplayName
    agentName = result.agentName
  } else {
    return undefined
  }

  const app = devStore.mcpApps.find((x) => x.appCode === appCode)

  // 组件不存在（技能引用了已删除的组件）：返回 notFound 场景而非 undefined
  if (!app) {
    const todos = agentName
      ? ["理解用户请求", `选择技能「${skillDisplayName}」`, "调用技能工具", "加载组件", "渲染失败"]
      : ["理解用户请求", "调用技能工具", "加载组件", "渲染失败"]
    const chainPrefix = agentName
      ? `通过智能体「${agentName}」→ 技能「${skillDisplayName}」`
      : `通过技能「${skillDisplayName}」`
    const notFoundToolStep = {
      todo: agentName ? 2 : 1,
      tools: [
        {
          tool: "mcp" as const,
          title: `调用 ${skillName}`,
          detail: agentName ? `智能体调用技能 ${skillName}` : `技能工具 ${skillName}`,
          output: JSON.stringify({ success: true, message: "技能执行完成" }, null, 2),
          state: "completed" as const,
        },
      ],
    }
    return {
      todos,
      steps: [
        { todo: 0, reasoning: `用户请求正在处理…${chainPrefix}调用组件 appCode=${appCode}…` },
        ...(agentName ? [{ todo: 1, reasoning: `匹配到技能「${skillDisplayName}」处理此请求。` }] : []),
        notFoundToolStep,
        {
          todo: agentName ? 3 : 2,
          reasoning: `技能关联了组件 appCode=${appCode}，尝试加载…本地和远端均未找到该组件：notFound`,
          text: `${chainPrefix}关联的组件不存在，请检查技能的组件引用配置。`,
          card: () => ({ kind: "kdapp-local-test", config: { appCode, errorKind: "notFound" } }),
        },
      ],
    }
  }

  const withTools = hasMcpTools(appCode)
  const tools = toolNamesOf(appCode)

  // 错误态映射（与 mcp-app-local-test.ts 保持一致，notFound 由组件不存在时自动触发）
  const errorMap: Record<string, string> = {
    kdcloud_hr_leave_form: "notBuilt",
    kdcloud_err_remote: "remoteOnly",
    kdcloud_err_sandbox: "sandboxUnavailable",
    kdcloud_err_capacity: "capacityFull",
    kdcloud_err_stale: "contentUpdated",
  }
  const errorKind = errorMap[appCode]

  // 智能体→技能→组件：多一步「选择技能」
  const todos = agentName
    ? ["理解用户请求", `选择技能「${skillDisplayName}」`, "调用技能工具", "加载组件", errorKind ? "渲染失败" : "渲染组件"]
    : ["理解用户请求", "调用技能工具", "加载组件", errorKind ? "渲染失败" : "渲染组件"]

  const chainPrefix = agentName
    ? `通过智能体「${agentName}」→ 技能「${skillDisplayName}」`
    : `通过技能「${skillDisplayName}」`

  // 技能工具调用步骤
  const toolStep = {
    todo: agentName ? 2 : 1,
    tools: [
      {
        tool: "mcp" as const,
        title: `调用 ${skillName}`,
        detail: agentName ? `智能体调用技能 ${skillName}` : `技能工具 ${skillName}`,
        output: withTools
          ? JSON.stringify({ success: true, data: { items: [{ id: "demo-001", name: "示例数据" }] } }, null, 2)
          : JSON.stringify({ success: true, message: "技能执行完成" }, null, 2),
        state: "completed" as const,
      },
    ],
  }

  // 错误态场景
  if (errorKind) {
    return {
      todos,
      steps: [
        {
          todo: 0,
          reasoning: `用户请求正在处理…${chainPrefix}调用组件 appCode=${appCode}…`,
        },
        ...(agentName
          ? [{ todo: 1, reasoning: `匹配到技能「${skillDisplayName}」处理此请求。` }]
          : []),
        toolStep,
        {
          todo: agentName ? 3 : 2,
          reasoning: `技能关联了组件「${app.appName}」，尝试加载 appCode=${appCode}…组件加载失败：${errorKind}`,
          text: `${chainPrefix}关联的组件「${app.appName}」加载失败，请根据下方提示处理。`,
          card: () => ({ kind: "kdapp-local-test", config: { appCode, errorKind } }),
        },
      ],
    }
  }

  // 正常场景
  return {
    todos,
    steps: [
      {
        todo: 0,
        reasoning: `用户请求正在处理…${chainPrefix}调用组件 appCode=${appCode}…`,
      },
      ...(agentName
        ? [{ todo: 1, reasoning: `匹配到技能「${skillDisplayName}」处理此请求。` }]
        : []),
      toolStep,
      {
        todo: agentName ? 3 : 2,
        reasoning: `技能关联了组件「${app.appName}」，从本地构建产物加载 appCode=${appCode}，正在渲染…`,
        text: `${chainPrefix}调用完成，组件「${app.appName}」已加载，你可以在下方区域内与组件交互。`,
        card: () => ({ kind: "kdapp-local-test", config: { appCode } }),
      },
    ],
  }
}

/**
 * 判断某个会话是否是技能/智能体本地测试会话且引用了组件。
 * 供 scenarios/index.ts 路由使用。
 */
export function isSkillComponentTest(sessionId: string): boolean {
  const parsed = parseLocalTest(sessionId)
  if (!parsed) return false
  if (parsed.kind === "skill") return !!componentFromSkill(parsed.id)
  if (parsed.kind === "agent") return !!componentFromAgent(parsed.id)
  return false
}

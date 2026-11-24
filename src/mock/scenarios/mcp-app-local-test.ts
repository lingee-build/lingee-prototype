import type { Scenario } from "./types"
import { db } from "../db"
import { devStore } from "../dev-store"
import { uid } from "../latency"

/**
 * 业务组件本地测试会话的 mock 场景。
 *
 * 对应 PRD 功能点 1「组件直测」：
 * - 用户从业务组件卡片/抽屉点「本地测试」后进入测试会话
 * - 输入消息后，模型 mock 回复中以内联卡片形式渲染组件
 * - 纯展示组件：只渲染组件内容
 * - 有关联工具的组件：先展示 MCP 工具调用，再渲染组件
 *
 * 对应 PRD 功能点 5「会话内错误态卡片」：
 * - notBuilt / sandboxUnavailable / capacityFull / contentUpdated 可能出现在直测会话中
 * - notFound 在直测路径不可能发生（不存在的组件没有按钮可点）
 * - remoteOnly 在入口已拦截（已发布但本地无工程），不会进入会话
 */

/** 从 session.localTest.objectId 解析出 appCode */
function appCodeFromSession(sessionId: string): string | undefined {
  const session = db.sessions.find((x) => x.id === sessionId)
  if (!session?.localTest?.objectId) return undefined
  const [kind, code] = session.localTest.objectId.split(":")
  if (kind !== "mcpapp") return undefined
  return code
}

/** 查找组件 */
function findApp(appCode: string) {
  return devStore.mcpApps.find((x) => x.appCode === appCode)
}

/** 判断组件是否有关联 MCP 工具 */
function hasMcpTools(app: ReturnType<typeof findApp>): boolean {
  if (!app?.info) return false
  const connectors = (app.info as Record<string, unknown>).mcpConnector
  return Array.isArray(connectors) && connectors.length > 0
}

/** 获取组件关联的工具名称 */
function toolNamesOf(app: ReturnType<typeof findApp>): string[] {
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

/**
 * 构建本地测试场景。
 * 根据 session.localTest 中的 appCode 找到对应组件，生成 mock 回复。
 */
export function mcpAppLocalTestScenario(sessionId: string, prompt: string): Scenario | undefined {
  const appCode = appCodeFromSession(sessionId)
  if (!appCode) return undefined
  const app = findApp(appCode)
  if (!app) return undefined

  const withTools = hasMcpTools(app)
  const tools = toolNamesOf(app)

  // 会话内错误态触发：notBuilt / sandboxUnavailable / capacityFull / contentUpdated
  // notFound 在直测路径不可能发生（不存在的组件没有按钮可点）
  // remoteOnly 在入口已拦截（已发布但本地无工程），不会进入会话
  const errorMap: Record<string, string> = {
    "kdcloud_hr_leave_form": "notBuilt",
    "kdcloud_err_sandbox": "sandboxUnavailable",
    "kdcloud_err_capacity": "capacityFull",
    "kdcloud_err_stale": "contentUpdated",
  }

  const errorKind = errorMap[appCode]

  // 有关联工具时，mock 回复中先展示工具调用
  const toolSteps = withTools && !errorKind
    ? [
        {
          tool: "mcp" as const,
          title: `调用 ${tools[0] ?? "mcp_tool"}`,
          detail: `appCode=${appCode}`,
          output: JSON.stringify({ success: true, data: { items: [{ id: "demo-001", name: "示例数据" }] } }, null, 2),
          state: "completed" as const,
        },
      ]
    : []

  // 错误态的 mock 回复
  if (errorKind) {
    return {
      todos: ["解析组件请求", "加载组件资源"],
      steps: [
        {
          todo: 0,
          reasoning: `正在解析 appCode=${appCode} 的组件请求…`,
        },
        {
          todo: 1,
          reasoning: `组件加载失败：${errorKind}`,
          text: `组件「${app.appName}」加载失败，请根据下方提示处理。`,
          card: () => ({ kind: "kdapp-local-test", config: { appCode, errorKind } }),
        },
      ],
    }
  }

  // 正常 mock 回复
  return {
    todos: ["解析组件请求", withTools ? "调用关联工具" : "加载组件资源", "渲染组件"].filter(Boolean),
    steps: [
      {
        todo: 0,
        reasoning: `正在解析 appCode=${appCode} 的组件请求…`,
      },
      ...(toolSteps.length > 0
        ? [
            {
              todo: 1,
              tools: toolSteps,
            },
          ]
        : []),
      {
        todo: withTools ? 2 : 1,
        reasoning: `组件 ${appCode} 已从本地构建产物加载，正在渲染…`,
        text: `已打开组件「${app.appName}」，你可以在下方区域内与组件交互。\n\n${withTools ? "组件关联的 MCP 工具已就绪，模型可在需要时调用。" : "这是一个纯展示组件，不关联 MCP 工具。"}`,
        card: () => ({ kind: "kdapp-local-test", config: { appCode } }),
      },
    ],
  }
}

/**
 * 判断某个会话是否是 MCP App 本地测试会话。
 * 供 scenarios/index.ts 路由使用。
 */
export function isMcpAppLocalTest(sessionId: string): boolean {
  const session = db.sessions.find((x) => x.id === sessionId)
  return !!session?.localTest?.objectId?.startsWith("mcpapp:")
}

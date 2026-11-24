import type { Scenario } from "./types"
import { db } from "../db"
import { devStore } from "../dev-store"
import { uid } from "../latency"

/**
 * 普通会话（非本地测试会话）中访问业务组件的 mock 场景。
 *
 * 用户在普通会话中说「打开XX组件」时：
 * - 纯展示组件已上传沙箱 → 正常渲染（沙箱预览，无工具问题）
 * - 有关联工具的组件已上传沙箱 → 渲染组件 + 工具调用失败 + 警告横幅
 * - 未上传沙箱 → 错误提示「组件未上传沙箱」
 *
 * 关键产品逻辑：
 * - 普通会话中 MCP 工具未连接，需主动告知用户使用本地测试
 * - 所有三种情况都自动打开右侧抽屉，展示组件详情和测试入口（方案 A）
 * - 同一会话提到多个组件时，最后一个自动打开；用户可手动点卡片切换
 * - 输入了不存在的组件名 → 渲染 notFound 错误卡片（不自动打开抽屉，因为组件不存在）
 */

/** 从用户消息中匹配组件名 */
function matchApp(prompt: string) {
  const text = prompt.replace(/^\/\S+\s*/, "").trim()
  // 遍历所有组件，找名字或 appCode 出现在消息中的
  return devStore.mcpApps.find((app) => {
    if (app.appName && text.includes(app.appName)) return true
    if (app.appCode && text.includes(app.appCode)) return true
    return false
  })
}

/** 检测用户消息是否像是在请求打开组件（包含组件类名词 + 动作词） */
function looksLikeComponentRequest(prompt: string): boolean {
  const text = prompt.replace(/^\/\S+\s*/, "").trim()
  const hasComponentNoun = /组件|卡片|看板|面板|仪表盘/.test(text)
  const hasActionVerb = /打开|展示|查看|加载|渲染|打开/.test(text)
  return hasComponentNoun && hasActionVerb
}

/** 从用户消息中提取组件名（移除动词和通用名词） */
function extractComponentName(prompt: string): string {
  const text = prompt.replace(/^\/\S+\s*/, "").trim()
  const cleaned = text.replace(/打开|展示|查看|加载|渲染|组件|卡片|看板|面板|仪表盘/g, "").trim()
  return cleaned || text
}

/** 判断组件是否已上传沙箱（提交过审核或已发布都算） */
function isInSandbox(app: ReturnType<typeof matchApp>): boolean {
  if (!app) return false
  return app.tested === true || ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "OFFLINE"].includes(app.mcpStatus ?? "")
}

/** 判断组件是否有关联工具 */
function hasMcpTools(app: ReturnType<typeof matchApp>): boolean {
  if (!app?.info) return false
  const connectors = (app.info as Record<string, unknown>).mcpConnector
  return Array.isArray(connectors) && connectors.length > 0
}

/** 获取工具名称 */
function toolNamesOf(app: ReturnType<typeof matchApp>): string[] {
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
 * 构建普通会话组件访问场景。
 * 返回 undefined 表示不匹配（由调用方回退到其他场景）。
 */
export function mcpAppRegularAccessScenario(sessionId: string, prompt: string): Scenario | undefined {
  // 仅在非本地测试会话中触发
  const session = db.sessions.find((x) => x.id === sessionId)
  if (session?.localTest?.objectId) return undefined

  const app = matchApp(prompt)
  if (!app) {
    // 输入了不存在的组件名：渲染 notFound 错误卡片
    if (looksLikeComponentRequest(prompt)) {
      const componentName = extractComponentName(prompt)
      return {
        todos: ["解析组件请求", "查找组件资源"],
        steps: [
          {
            todo: 0,
            reasoning: `正在解析组件请求…查找「${componentName}」…本地和远端均未找到匹配的组件。`,
          },
          {
            todo: 1,
            reasoning: `组件「${componentName}」不存在：notFound`,
            text: `找不到组件「${componentName}」。请确认组件名称是否正确，或检查组件是否已被删除。`,
            card: () => ({ kind: "kdapp-local-test", config: { appCode: componentName, errorKind: "notFound" } }),
          },
        ],
      }
    }
    return undefined
  }

  const inSandbox = isInSandbox(app)
  const withTools = hasMcpTools(app)
  const tools = toolNamesOf(app)

  // 未上传沙箱：无法渲染
  if (!inSandbox) {
    return {
      todos: ["解析组件请求", "查找组件资源"],
      steps: [
        {
          todo: 0,
          reasoning: `正在解析组件请求…在沙箱中查找 appCode=${app.appCode}…`,
        },
        {
          todo: 1,
          reasoning: `组件未在沙箱中找到。组件「${app.appName}」尚未上传沙箱，无法在普通会话中渲染。`,
          text: `组件「${app.appName}」尚未上传到沙箱，无法在当前会话中渲染。\n\n你可以：\n- 点击「测试 → 云端测试」上传到沙箱\n- 或点击「测试 → 本地测试」直接从本地加载`,
          card: () => ({ kind: "kdapp-artifact", config: { appCode: app.appCode, title: app.appName, desc: "组件未上传沙箱", autoOpenDrawer: "true" } }),
        },
      ],
    }
  }

  // 已上传沙箱 + 有关联工具：渲染组件但工具调不通
  if (withTools && tools.length > 0) {
    return {
      todos: ["解析组件请求", "调用关联工具", "渲染组件"],
      steps: [
        {
          todo: 0,
          reasoning: `正在解析组件请求…从沙箱加载 appCode=${app.appCode}…`,
        },
        {
          todo: 1,
          // 工具调用失败
          tools: [
            {
              tool: "mcp" as const,
              title: `调用 ${tools[0]}`,
              detail: `appCode=${app.appCode}`,
              output: `Error: MCP tool "${tools[0]}" is not connected in this session.\n工具未连接，请在本地测试中验证完整功能。`,
              error: true,
            },
          ],
        },
        {
          todo: 2,
          reasoning: `组件已加载并渲染。但 MCP 工具未连接，用户如需完整功能应使用本地测试。`,
          text: `已加载组件「${app.appName}」。\n\n当前为预览模式，组件关联的 MCP 工具（${tools.join("、")}）未连接，工具调用会失败。如需测试完整功能（包括工具调用），请使用本地测试。`,
          card: () => ({ kind: "kdapp-artifact", config: { appCode: app.appCode, title: app.appName, desc: "预览模式 · 工具未连接", phase: "preview", autoOpenDrawer: "true" } }),
        },
      ],
    }
  }

  // 已上传沙箱 + 纯展示：正常渲染
  return {
    todos: ["解析组件请求", "渲染组件"],
    steps: [
      {
        todo: 0,
        reasoning: `正在解析组件请求…从沙箱加载 appCode=${app.appCode}…`,
      },
      {
        todo: 1,
          reasoning: `组件已加载，正在渲染…`,
          text: `已加载组件「${app.appName}」，你可以在下方区域内与组件交互。`,
        card: () => ({ kind: "kdapp-artifact", config: { appCode: app.appCode, title: app.appName, desc: "已加载组件", phase: "preview", autoOpenDrawer: "true" } }),
      },
    ],
  }
}

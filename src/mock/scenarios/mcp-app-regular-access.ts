import type { Scenario } from "./types"
import { db } from "../db"
import { devStore } from "../dev-store"

/**
 * 普通会话（非本地测试会话）中访问业务组件的 mock 场景。
 *
 * 用户在普通会话中说「打开XX组件」「预览XX组件」「看一下XX组件」等时：
 * - 有本地工程（无论是否关联工具）→ 未构建先触发构建，统一推产物卡片 + 打开抽屉
 * - 已发布但本地无工程（remoteOnly）→ 提醒用户组件在远端，无法本地渲染
 * - 输入了不存在的组件名 → notFound 错误卡片
 *
 * 关键产品逻辑：
 * - 普通会话中 MCP 工具未连接，需主动告知用户使用本地测试
 * - 所有情况都自动打开右侧抽屉，展示组件详情和测试入口
 * - 同一会话提到多个组件时，最后一个自动打开；用户可手动点卡片切换
 */

/** 从用户消息中匹配组件名 */
function matchApp(prompt: string) {
  const text = prompt.replace(/^\/\S+\s*/, "").trim()
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
  const hasActionVerb = /打开|展示|查看|加载|渲染/.test(text)
  return hasComponentNoun && hasActionVerb
}

/** 从用户消息中提取组件名（移除动词和通用名词） */
function extractComponentName(prompt: string): string {
  const text = prompt.replace(/^\/\S+\s*/, "").trim()
  const cleaned = text.replace(/打开|展示|查看|加载|渲染|组件|卡片|看板|面板|仪表盘/g, "").trim()
  return cleaned || text
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

  // 已发布但本地无工程：无法本地渲染，提醒用户组件在远端
  const isRemoteOnly = app.mcpStatus === "PUBLISHED" && !app.buildStatus
  if (isRemoteOnly) {
    return {
      todos: ["解析组件请求", "查找组件资源"],
      steps: [
        { todo: 0, reasoning: `正在解析组件请求…查找「${app.appName}」…组件已发布，但本机没有工程源码。` },
        {
          todo: 1,
          reasoning: `组件「${app.appName}」在远端，无法本地渲染：remoteOnly`,
          text: `组件「${app.appName}」已发布，但本机没有工程源码，暂不支持渲染打开。`,
          card: () => ({ kind: "kdapp-local-test", config: { appCode: app.appCode, errorKind: "remoteOnly" } }),
        },
      ],
    }
  }

  // 有本地工程的组件：统一推产物卡片 + 打开抽屉（不区分有无关联工具）
  const notBuilt = app.buildStatus !== "success"
  const buildStep = notBuilt
    ? [{ todo: 1, reasoning: `组件「${app.appName}」尚未构建，正在触发构建…构建完成，准备加载组件。` }]
    : []
  const renderTodo = notBuilt ? 2 : 1

  return {
    todos: notBuilt ? ["解析组件请求", "构建组件", "渲染组件"] : ["解析组件请求", "渲染组件"],
    steps: [
      { todo: 0, reasoning: `正在解析组件请求…加载组件「${app.appName}」…` },
      ...buildStep,
      {
        todo: renderTodo,
        reasoning: `组件已加载，正在渲染…`,
        text: `已打开${app.appName}。如需测试完整功能（包括工具调用），请使用本地测试。`,
        card: () => ({ kind: "kdapp-artifact", config: { appCode: app.appCode, title: app.appName, desc: app.appDescription, phase: "preview", autoOpenDrawer: "true" } }),
      },
    ],
  }
}

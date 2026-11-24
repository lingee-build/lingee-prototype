import type { Scenario } from "./types"
import { db } from "../db"
import { devStore } from "../dev-store"

/**
 * 普通会话（非本地测试会话）中访问业务组件的 mock 场景。
 *
 * 用户在普通会话中说「打开XX组件」「预览XX组件」「看一下XX组件」等时：
 * - 有本地工程（无论是否关联工具）→ 统一推产物卡片 + 打开抽屉
 * - 已发布但本地无工程（remoteOnly）→ 会话文字提醒，不推卡片
 * - 输入了不存在的组件名 → 会话文字提醒，不推卡片
 *
 * 关键产品逻辑：
 * - 普通会话不关心构建状态，直接推卡片+抽屉
 * - remoteOnly / notFound 只用文字提醒，不渲染错误卡片
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
    // 输入了不存在的组件名：纯文字提醒，不推卡片
    if (looksLikeComponentRequest(prompt)) {
      const componentName = extractComponentName(prompt)
      return {
        todos: ["解析组件请求", "查找组件资源"],
        steps: [
          { todo: 0, reasoning: `正在解析组件请求…查找「${componentName}」…本地和远端均未找到匹配的组件。` },
          {
            todo: 1,
            text: `找不到组件「${componentName}」。请确认组件名称是否正确，或检查组件是否已被删除。`,
          },
        ],
      }
    }
    return undefined
  }

  // 已发布但本地无工程：纯文字提醒，不推卡片
  const isRemoteOnly = app.mcpStatus === "PUBLISHED" && !app.buildStatus
  if (isRemoteOnly) {
    return {
      todos: ["解析组件请求", "查找组件资源"],
      steps: [
        { todo: 0, reasoning: `正在解析组件请求…查找「${app.appName}」…组件已发布，但本机没有工程源码。` },
        {
          todo: 1,
          text: `组件「${app.appName}」已发布，但本机没有工程源码，暂不支持渲染打开。`,
        },
      ],
    }
  }

  // 有本地工程的组件：统一推产物卡片 + 打开抽屉（不区分构建状态、不区分有无关联工具）
  return {
    todos: ["解析组件请求", "渲染组件"],
    steps: [
      { todo: 0, reasoning: `正在解析组件请求…加载组件「${app.appName}」…` },
      {
        todo: 1,
        reasoning: `组件已加载，正在渲染…`,
        text: `已打开${app.appName}。如需测试完整功能（包括工具调用），请使用本地测试。`,
        card: () => ({ kind: "kdapp-artifact", config: { appCode: app.appCode, title: app.appName, desc: app.appDescription, phase: "preview", autoOpenDrawer: "true" } }),
      },
    ],
  }
}

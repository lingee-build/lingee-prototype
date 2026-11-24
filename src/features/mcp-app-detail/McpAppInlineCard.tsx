import { useState, useEffect } from "react"
import { Icon, Tooltip } from "@/ui"
import { useT } from "@/i18n"
import type { McpApp } from "@/mock/fixtures/dev"
import { DynamicSkillIcon } from "@/features/dev-page/DynamicSkillIcon"

/** 内联组件渲染状态 */
type InlineState = "loading" | "ready" | "error"

/**
 * 会话流里的内联业务组件卡片：模拟组件在会话中被打开并渲染的效果。
 *
 * 对应 PRD 功能点 4「平台工具——组件渲染」：
 * - 模型调用 appCode 入口工具后，组件在会话流中以内联卡片形式渲染
 * - 纯展示组件：只渲染组件内容区
 * - 有关联工具的组件：渲染组件内容区 + 底部工具调用指示
 *
 * 原型中用模拟内容区替代真实 iframe 加载（dist/index.html → AppBridge 通道）。
 */
export function McpAppInlineCard(props: {
  app: McpApp
  /** 是否有关联 MCP 工具 */
  hasTools?: boolean
  /** 工具名称列表 */
  toolNames?: string[]
  /** 初始错误态（为 undefined 时走正常加载流程） */
  errorKind?: McpAppErrorKind
  /** 沙箱预览模式：非本地测试会话中渲染组件时为 true，工具未连接 */
  sandboxPreview?: boolean
}) {
  const t = useT()
  const [state, setState] = useState<InlineState>(props.errorKind ? "error" : "loading")

  useEffect(() => {
    if (props.errorKind) return
    const timer = setTimeout(() => setState("ready"), 800)
    return () => clearTimeout(timer)
  }, [props.errorKind])

  if (state === "error" || props.errorKind) {
    return <McpAppErrorCard kind={props.errorKind ?? "notBuilt"} app={props.app} />
  }

  const connectors = props.app.info
    ? (props.app.info as Record<string, unknown>).mcpConnector
    : undefined
  const realTools = props.toolNames ?? (Array.isArray(connectors)
    ? connectors
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .flatMap((conn) =>
          (Array.isArray(conn.relateTools) ? conn.relateTools : [])
            .map((tool) => (tool && typeof tool === "object" ? (tool as Record<string, unknown>).name : undefined))
            .filter((name): name is string => typeof name === "string" && name.length > 0),
        )
    : [])

  const showToolWarning = props.sandboxPreview && props.hasTools && realTools.length > 0

  return (
    <div className="my-2 rounded-[12px] border border-[var(--border-weak-base)] overflow-hidden bg-surface-base">
      {/* 沙箱预览模式警告横幅 */}
      {showToolWarning && state === "ready" && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[color-mix(in_srgb,var(--blue-50)_60%,transparent)] border-b border-[var(--border-weak-base)]">
          <Icon name="warning-circle" size="xs" />
          <span className="text-[11px] leading-[16px] text-[var(--blue-600)]">
            {t("kcode.mcpApp.inline.sandboxPreview")} · {t("kcode.mcpApp.inline.toolsNotConnected")}
          </span>
        </div>
      )}

      {/* 模拟组件渲染区：原型用占位内容代替真实 iframe */}
      <div className="relative" style={{ minHeight: 80 }}>
        {state === "loading" ? (
          <div className="flex items-center justify-center py-8 text-[var(--neutral-400)] text-[13px]">
            <span style={{ width: 16, height: 16, border: "2px solid var(--neutral-300)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", display: "inline-block", marginRight: 8 }} />
            {t("kcode.mcpApp.inline.loading")}
          </div>
        ) : (
          <MockComponentContent app={props.app} />
        )}
      </div>
    </div>
  )
}

/**
 * 模拟组件内容区：根据组件类型展示不同的 mock 内容。
 * 真实环境中这里是一个 iframe 加载 dist/index.html，通过 AppBridge 通信。
 */
function MockComponentContent(props: { app: McpApp }) {
  const appCode = props.app.appCode

  // 费用报销卡片：表单式内容
  if (appCode.includes("expense")) {
    return (
      <div className="p-3 space-y-2">
        <div className="text-[13px] font-[600] text-text-strong">报销单摘要</div>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="flex justify-between rounded-[8px] bg-[var(--surface-base-hover)] px-2 py-1.5">
            <span className="text-[var(--neutral-500)]">费用类型</span>
            <span className="text-text-base">差旅费</span>
          </div>
          <div className="flex justify-between rounded-[8px] bg-[var(--surface-base-hover)] px-2 py-1.5">
            <span className="text-[var(--neutral-500)]">金额</span>
            <span className="text-text-base">¥ 2,340.00</span>
          </div>
          <div className="flex justify-between rounded-[8px] bg-[var(--surface-base-hover)] px-2 py-1.5">
            <span className="text-[var(--neutral-500)]">发生日期</span>
            <span className="text-text-base">2026-11-20</span>
          </div>
          <div className="flex justify-between rounded-[8px] bg-[var(--surface-base-hover)] px-2 py-1.5">
            <span className="text-[var(--neutral-500)]">状态</span>
            <span className="text-[var(--primary-600)]">待提交</span>
          </div>
        </div>
      </div>
    )
  }

  // 库存明细表格：表格式内容
  if (appCode.includes("stock")) {
    return (
      <div className="p-3">
        <div className="text-[13px] font-[600] text-text-strong mb-2">即时库存</div>
        <div className="overflow-hidden rounded-[8px] border border-[var(--border-weak-base)]">
          <table className="w-full text-[12px]">
            <thead className="bg-[var(--surface-base-hover)]">
              <tr>
                <th className="px-2 py-1 text-left font-[500] text-[var(--neutral-500)]">物料</th>
                <th className="px-2 py-1 text-right font-[500] text-[var(--neutral-500)]">可用量</th>
                <th className="px-2 py-1 text-right font-[500] text-[var(--neutral-500)]">仓库</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["物料A-001", "1,200", "北京仓"],
                ["物料B-022", "340", "上海仓"],
                ["物料C-105", "0", "广州仓"],
              ].map(([m, q, w]) => (
                <tr key={m} className="border-t border-[var(--border-weak-base)]">
                  <td className="px-2 py-1.5 text-text-base">{m}</td>
                  <td className="px-2 py-1.5 text-right text-text-base">{q}</td>
                  <td className="px-2 py-1.5 text-right text-text-base">{w}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // 审批流程图：时间线式内容
  if (appCode.includes("approval")) {
    return (
      <div className="p-3">
        <div className="text-[13px] font-[600] text-text-strong mb-2">审批进度</div>
        <div className="space-y-1.5">
          {[
            { node: "发起人", status: "done" },
            { node: "部门主管", status: "done" },
            { node: "财务审核", status: "current" },
            { node: "总经理", status: "pending" },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${step.status === "done" ? "bg-[var(--primary-600)]" : step.status === "current" ? "bg-[var(--blue-500)]" : "bg-[var(--neutral-300)]"}`} />
              <span className={`text-[12px] ${step.status === "current" ? "text-[var(--blue-500)] font-[500]" : "text-text-base"}`}>{step.node}</span>
              {step.status === "current" && <span className="text-[10px] text-[var(--blue-500)] bg-[var(--blue-50)] rounded px-1">当前</span>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 订单摘要卡片：通用卡片式
  if (appCode.includes("order")) {
    return (
      <div className="p-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[13px] font-[600] text-text-strong">销售订单 SO-20261124-001</span>
          <span className="text-[11px] text-[var(--primary-600)] bg-[var(--blue-50)] rounded px-1.5 py-px">已确认</span>
        </div>
        <div className="text-[12px] text-text-base">客户：北京科技有限责任公司</div>
        <div className="flex gap-3 text-[12px]">
          <span><span className="text-[var(--neutral-500)]">订单金额：</span><span className="text-text-base">¥ 56,800.00</span></span>
          <span><span className="text-[var(--neutral-500)]">交货日期：</span><span className="text-text-base">2026-12-05</span></span>
        </div>
      </div>
    )
  }

  // 默认：通用占位
  return (
    <div className="p-4 flex flex-col items-center gap-2 text-center">
      <div className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-[var(--surface-base-hover)]">
        <Icon name="app-grid" size="small" />
      </div>
      <div className="text-[13px] text-text-base">{props.app.appName}</div>
      <div className="text-[11px] text-[var(--neutral-400)]">{props.app.appDescription}</div>
    </div>
  )
}

/** 错误态类型 */
export type McpAppErrorKind = "notFound" | "remoteOnly" | "notBuilt" | "sandboxUnavailable" | "capacityFull" | "contentUpdated"

/** 错误严重级别：决定图标背景色和边框色 */
type ErrorSeverity = "error" | "warning" | "info"

interface ErrorConfig {
  icon: string
  severity: ErrorSeverity
  titleKey: string
  descKey: string
  actionKey?: string
  actionIcon?: string
}

const SEVERITY_STYLE: Record<ErrorSeverity, { bg: string; fg: string }> = {
  error: { bg: "var(--danger-50)", fg: "var(--danger-500)" },
  warning: { bg: "var(--warning-50)", fg: "var(--warning-500)" },
  info: { bg: "var(--blue-50)", fg: "var(--blue-500)" },
}

const ERROR_CONFIG: Record<McpAppErrorKind, ErrorConfig> = {
  // 硬错误：组件不存在 / 沙箱启动失败
  notFound: {
    icon: "circle-x",
    severity: "error",
    titleKey: "kcode.mcpApp.error.notFound.title",
    descKey: "kcode.mcpApp.error.notFound.desc",
  },
  sandboxUnavailable: {
    icon: "warning-circle",
    severity: "error",
    titleKey: "kcode.mcpApp.error.sandboxUnavailable.title",
    descKey: "kcode.mcpApp.error.sandboxUnavailable.desc",
    actionKey: "kcode.mcpApp.error.action.retry",
    actionIcon: "refresh",
  },
  // 软警告：容量上限 / 组件在远端
  capacityFull: {
    icon: "warning-triangle",
    severity: "warning",
    titleKey: "kcode.mcpApp.error.capacityFull.title",
    descKey: "kcode.mcpApp.error.capacityFull.desc",
  },
  remoteOnly: {
    icon: "cloud-test",
    severity: "warning",
    titleKey: "kcode.mcpApp.error.remoteOnly.title",
    descKey: "kcode.mcpApp.error.remoteOnly.desc",
  },
  // 可操作信息：未构建 / 内容已更新
  notBuilt: {
    icon: "empty-box",
    severity: "info",
    titleKey: "kcode.mcpApp.error.notBuilt.title",
    descKey: "kcode.mcpApp.error.notBuilt.desc",
    actionKey: "kcode.mcpApp.error.action.build",
    actionIcon: "archive",
  },
  contentUpdated: {
    icon: "refresh",
    severity: "info",
    titleKey: "kcode.mcpApp.error.contentUpdated.title",
    descKey: "kcode.mcpApp.error.contentUpdated.desc",
    actionKey: "kcode.mcpApp.error.action.refresh",
    actionIcon: "refresh",
  },
}

/**
 * 业务组件错误态卡片：在会话流中渲染组件失败时展示。
 * 对应 PRD 功能点 5「错误态卡片」：6 种错误类型。
 *
 * notFound 时组件对象不存在，用 appCode 替代 app；
 * 其他错误态需要 app 对象（用 appName 生成描述文案）。
 *
 * 颜色语义：
 * - error（红）：硬错误，系统不可用 — notFound, sandboxUnavailable
 * - warning（橙）：软警告，系统限制 — capacityFull, remoteOnly
 * - info（蓝）：可操作信息，用户可执行 — notBuilt, contentUpdated
 */
export function McpAppErrorCard(props: { kind: McpAppErrorKind; app?: McpApp; appCode?: string }) {
  const t = useT()
  const { kind, app, appCode } = props
  const cfg = ERROR_CONFIG[kind]
  const style = SEVERITY_STYLE[cfg.severity]
  const descParams: Record<string, string | number> = kind === "notFound"
    ? { appCode: appCode ?? app?.appCode ?? "" }
    : { appName: app?.appName ?? "", max: 5 }

  return (
    <div
      className="my-2 rounded-[16px] overflow-hidden"
      style={{ background: "color-mix(in srgb, var(--neutral-0) 82%, transparent)", boxShadow: "0 1px 6px 0 var(--neutral-50)" }}
    >
      <div className="flex items-start gap-3 p-3">
        {/* 图标：按严重级别着色 */}
        <div
          className="shrink-0 w-9 h-9 rounded-[8px] flex items-center justify-center"
          style={{ background: style.bg }}
        >
          <Icon name={cfg.icon as never} size="small" style={{ color: style.fg }} />
        </div>
        {/* 标题 + 描述 */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-[600] leading-[20px] text-text-strong">{t(cfg.titleKey)}</div>
          <div className="mt-0.5 text-[12px] leading-[18px] text-text-base">
            {t(cfg.descKey, descParams)}
          </div>
        </div>
        {/* 操作按钮：右侧内联 */}
        {cfg.actionKey && (
          <div className="shrink-0 flex items-center pt-1">
            <button
              className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--border-weak-base)] bg-surface-base px-2.5 py-1 text-[12px] text-text-base cursor-pointer hover:bg-surface-base-hover transition-colors"
              onClick={() => {/* mock: no-op in prototype */}}
            >
              {cfg.actionIcon && <Icon name={cfg.actionIcon as never} size="xs" />}
              {t(cfg.actionKey)}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

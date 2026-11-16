import type { McpApp, McpAppStatus } from "@/mock/fixtures/dev"
import { getMissingRequiredFields } from "@/vendor/kcode-web/src/utils/mcp-app-check"

/** 线上状态 → 文案 key：从未提交 = 暂存；草稿 / 审核中 / 已下架都算「待审核」 */
const STATUS_I18N: Record<McpAppStatus, string> = {
  DRAFT: "kcode.mcpApp.filter.pendingReview",
  PENDING_REVIEW: "kcode.mcpApp.filter.pendingReview",
  PUBLISHED: "kcode.mcpApp.filter.published",
  REJECTED: "kcode.mcpApp.filter.rejected",
  OFFLINE: "kcode.mcpApp.filter.pendingReview",
}

export const statusKey = (status: McpApp["mcpStatus"]) => (status ? STATUS_I18N[status] : "kcode.mcpApp.filter.draft")

export const statusColor = (status: McpApp["mcpStatus"]) =>
  !status ? "text-[var(--neutral-500)]" : status === "REJECTED" ? "text-[var(--danger-600)]" : "text-[var(--primary-600)]"

/** 页签筛选：STAGED 暂存 / PENDING 待审核 / PUBLISHED / REJECTED */
export const matchCategory = (app: McpApp, category: string) => {
  const s = app.mcpStatus
  if (category === "STAGED") return s === ""
  if (category === "PENDING") return s === "DRAFT" || s === "PENDING_REVIEW" || s === "OFFLINE"
  return s === category
}

/** 线上已有版本时，提交会覆盖它，确认文案不同 */
export const submitConfirmKey = (status: McpApp["mcpStatus"]) =>
  status === "DRAFT" || status === "PENDING_REVIEW" || status === "PUBLISHED" ? "kcode.mcpApp.submit.confirmContentOverwrite" : "kcode.mcpApp.submit.confirmContent"

export const missingRequired = (app: McpApp) => getMissingRequiredFields(app.info)

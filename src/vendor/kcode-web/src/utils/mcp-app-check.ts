/**
 * MCP App info.json 字段检查清单（共享模块）
 *
 * 从 kdapp-artifact-preview.tsx 抽取，供卡片页与预览抽屉复用。
 * relateTools 不检查，依赖提交上传接口返回。
 */

export type CheckStatus = "ok" | "empty" | "optional-ok" | "optional-empty"

export interface CheckRow {
  field: string
  required: boolean
  descKey: string
}

/** info.json 字段检查清单 */
export const CHECK_ROWS: CheckRow[] = [
  { field: "cloud", required: true, descKey: "kcode.mcpApp.preview.check.desc.cloud" },
  { field: "domain", required: true, descKey: "kcode.mcpApp.preview.check.desc.domain" },
  { field: "appCode", required: true, descKey: "kcode.mcpApp.preview.check.desc.appCode" },
  { field: "appName", required: true, descKey: "kcode.mcpApp.preview.check.desc.appName" },
  { field: "description", required: false, descKey: "kcode.mcpApp.preview.check.desc.description" },
  { field: "capabilityDescription.support", required: false, descKey: "kcode.mcpApp.preview.check.desc.capabilitySupport" },
  { field: "capabilityDescription.notSupport", required: false, descKey: "kcode.mcpApp.preview.check.desc.capabilityNotSupport" },
  { field: "mcpConnector", required: false, descKey: "kcode.mcpApp.preview.check.desc.mcpConnector" },
  { field: "runMode", required: true, descKey: "kcode.mcpApp.preview.check.desc.runMode" },
  { field: "version", required: true, descKey: "kcode.mcpApp.preview.check.desc.version" },
  { field: "entryTool.virtual.inputSchema", required: false, descKey: "kcode.mcpApp.preview.check.desc.entryInputSchema" },
  { field: "entryTool.virtual.outputSchema", required: false, descKey: "kcode.mcpApp.preview.check.desc.entryOutputSchema" },
  { field: "dependsOnApp", required: false, descKey: "kcode.mcpApp.preview.check.desc.dependsOnApp" },
]

/** 安全读取嵌套对象路径 */
export function getField(obj: Record<string, unknown>, path: string): unknown {
  const segs = path.split(".")
  let cur: unknown = obj
  for (const seg of segs) {
    if (cur == null || typeof cur !== "object") return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

export function isEmptyVal(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === "string") return v.trim() === ""
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === "object") return Object.keys(v).length === 0
  return false
}

export function checkField(infoObj: Record<string, unknown> | null, row: CheckRow): CheckStatus {
  if (!infoObj) return row.required ? "empty" : "optional-empty"
  const v = getField(infoObj, row.field)
  const empty = isEmptyVal(v)
  if (row.required) return empty ? "empty" : "ok"
  return empty ? "optional-empty" : "optional-ok"
}

/** 返回缺失的必填字段名列表 */
export function getMissingRequiredFields(infoObj: Record<string, unknown> | null): string[] {
  return CHECK_ROWS
    .filter((row) => row.required && checkField(infoObj, row) === "empty")
    .map((row) => row.field)
}

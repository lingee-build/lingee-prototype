export type TextSegment = {
  type: "text"
  content: string
}

export type RenderSegment = {
  type: "render"
  kind: string
  config: Record<string, string>
}

export type Segment = TextSegment | RenderSegment

// 结尾冒号数兼容 0/1/2/3 个（大模型可能完全漏输出结尾冒号，仅靠下一个 :::render: 或
// 文本结尾分隔），lookahead 防止紧贴卡片头部被吞
// 匹配 :::render:kind { 开头，后续通过括号计数提取完整 JSON（支持嵌套对象/数组）
const RENDER_START = /:::render:([a-zA-Z0-9_-]+)\s*\{/g
// 匹配 JSON 闭合花括号后的尾部冒号模式
const TRAILING_COLONS = /^\s*:{0,3}?(?=\s|$|:::render:|[^:])/

/** 从 openPos（{ 的位置）开始计数，找到匹配的闭合 } */
function findMatchingBrace(text: string, openPos: number): number {
  let depth = 0
  let inString = false
  for (let i = openPos; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (ch === "\\") {
        i++ // 跳过转义字符
        continue
      }
      if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}
const RENDER_CARD_KINDS = new Set([
  "evaluation-cases",
  "kdform",
  "kwcform",
  "kdskill",
  "kdapp",
  "kdapp-prototype",
  "ai-partner",
  "kdapi",
  "kdapp-artifact",
  "kdexpert",
  "kdstandalone",
  "kd-digital-employee",
  "kd-expert-team",
])

// Governance protocol tokens emitted by skills (e.g. ::SKILL_LOADED{...}:: ,
// ::VALIDATION_TOKEN{...}::) are meant for flow enforcement, not for users.
// Strip them from rendered text while keeping the underlying message intact.
const PROTOCOL_TOKEN_PATTERN = /::[A-Z][A-Z0-9_]*\{[^}]*\}::/g

export function stripProtocolTokens(text: string): string {
  return text.replace(PROTOCOL_TOKEN_PATTERN, "")
}

/**
 * Normalize Windows backslash path separators in a raw JSON string so that
 * JSON.parse does not choke on unescaped backslashes like C:\Users\....
 * Preserves valid JSON escapes (\" and \\) while converting other
 * backslashes to forward slashes.
 */
export function normalizeJsonPaths(raw: string): string {
  return raw.replace(/\\(?!["\\])/g, "/")
}

export function split(text: string): Segment[] {
  text = stripProtocolTokens(text)
  const segments: Segment[] = []
  let cursor = 0

  for (const match of text.matchAll(RENDER_START)) {
    const idx = match.index!
    if (idx > cursor) segments.push({ type: "text", content: text.slice(cursor, idx) })

    const kind = match[1]
    if (!kind) {
      segments.push({ type: "text", content: match[0] })
      cursor = idx + match[0].length
      continue
    }

    // 通过括号计数找到匹配的闭合花括号（match[0] 末尾即为 {）
    const braceStart = idx + match[0].length - 1
    const braceEnd = findMatchingBrace(text, braceStart)
    if (braceEnd === -1) {
      segments.push({ type: "text", content: match[0] })
      cursor = idx + match[0].length
      continue
    }

    // rawConfig 包含 { 和 }，与原行为保持一致
    const rawConfig = text.slice(braceStart, braceEnd + 1)

    // 匹配闭合花括号后的尾部冒号模式
    const afterBrace = text.slice(braceEnd + 1)
    const endMatch = TRAILING_COLONS.exec(afterBrace)
    const trailingLen = endMatch ? endMatch[0].length : 0
    const totalEnd = braceEnd + 1 + trailingLen

    if (!rawConfig) {
      segments.push({ type: "text", content: text.slice(idx, totalEnd) })
      cursor = totalEnd
      continue
    }

    if (kind === "markdown") {
      if (rawConfig.trim()) segments.push({ type: "text", content: rawConfig.trim() })
      cursor = totalEnd
      continue
    }

    if (!RENDER_CARD_KINDS.has(kind)) {
      if (rawConfig.trim()) segments.push({ type: "text", content: rawConfig.trim() })
      cursor = totalEnd
      continue
    }

    let config: Record<string, string> = {}
    try {
      config = JSON.parse(normalizeJsonPaths(rawConfig))
    } catch {
      // malformed JSON – downgrade to plain inner content and hide directive wrapper
      if (rawConfig.trim()) segments.push({ type: "text", content: rawConfig.trim() })
      cursor = totalEnd
      continue
    }

    // Phase-only kdapp blocks are handled by the sidebar effect, not rendered as cards
    if (kind === "kdapp" && config.phase && !config.content && !config.url) {
      cursor = totalEnd
      continue
    }

    segments.push({ type: "render", kind, config })
    cursor = totalEnd
  }

  if (cursor === 0) return [{ type: "text", content: text }]
  if (cursor < text.length) segments.push({ type: "text", content: text.slice(cursor) })

  // Auto-merge trailing text into preceding render block's config.content
  // Only for form/app cards that have no API URLs (metadata/plugins) and no existing content
  const MERGEABLE_KINDS = new Set(["kdform", "kwcform", "kdapp"])
  for (let i = segments.length - 1; i >= 1; i--) {
    const prev = segments[i - 1]
    const cur = segments[i]
    if (
      prev.type === "render" &&
      MERGEABLE_KINDS.has(prev.kind) &&
      cur.type === "text" &&
      !prev.config.content &&
      !prev.config.metadata &&
      !prev.config.plugins
    ) {
      const trimmed = cur.content.trim()
      if (trimmed) {
        prev.config.content = trimmed
        segments.splice(i, 1)
      }
    }
  }

  return segments
}

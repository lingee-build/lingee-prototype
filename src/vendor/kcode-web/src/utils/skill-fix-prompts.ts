/**
 * US-08：「去修复」指令模板库。
 *
 * 按 validate_skill.py 的稳定规则 id（报告 JSON 的 rule.id，即未翻译的英文规则名）索引；
 * 旧版报告没有 id、只有（可能已翻译的）name，因此同时收录 zh 规则名别名兜底命中。
 *
 * 两种拼装方式：
 *   - buildFixPrompt(ruleId, message, ctx)：单项指令（检查 tab 单条「去修复」），一段完整修复指令；
 *   - buildAggregatedFixPrompt(items, ctx)：聚合指令（批量「去修复」），头尾样板只出现一次，
 *     多个失败规则编号列出，级联跳过项（msg 以 ", skipped" 结尾）由调用方过滤、不进列表。
 * 未命中模板时回落到通用模板。
 */

export type FixPromptContext = {
  /** 技能目录名（用于指令中定位文件） */
  skillName?: string
  /** 技能目录绝对路径（可选，供 AI 助手直接读取） */
  skillDir?: string
}

/** 聚合修复指令的单项输入（与 BatchGoFixFix 对齐：severity / ruleName 可选） */
export type FixPromptItem = {
  /** 稳定英文规则 id（或环境类伪 id / 资源条目的工具名） */
  ruleId: string
  /** 失败消息 */
  message: string
  /** 严重度：缺省按 block 计（安全/资源失败与未知条目均阻断提交） */
  severity?: "block" | "warn"
  /** 规则显示名（报告 JSON 的 rule.name，zh 报告为中文）；缺失时回落模板标题 */
  ruleName?: string
}

/** 通用回落模板：未命中具体规则时使用 */
const GENERIC_TEMPLATE = (message: string, ctx: FixPromptContext) =>
  `技能「${ctx.skillName ?? "当前技能"}」的检查未通过，失败原因：${message}\n\n` +
  `请阅读 ${ctx.skillDir ?? "技能目录"} 下的相关文件，定位问题并给出修复方案。修复后重新运行检查确认通过。`

/** 环境类修复指令的规则 ID（非 validate_skill.py 规则名，供检查失败场景索引模板） */
export const ENV_PYTHON_RULE_ID = "__env_python_missing__"
export const SCRIPT_CRASH_RULE_ID = "__check_script_crash__"
export const ENV_AUTH_FAILED_RULE_ID = "__env_auth_failed__"
export const ENV_NO_CREDENTIAL_RULE_ID = "__env_no_credential__"

/** 单条规则修复定义：title 供展示，guidance 为可执行修复建议（不含技能名与失败消息） */
type RuleFixDef = {
  title: string
  guidance: (message: string, ctx: FixPromptContext) => string
}

/** 按稳定英文规则 id 索引的规则修复定义（单项与聚合两种拼装共用同一数据源） */
const RULE_FIXES: Record<string, RuleFixDef> = {
  "SKILL.md file exists": {
    title: "SKILL.md 文件存在",
    guidance: () => `请创建 SKILL.md，包含 frontmatter（name / description / allowed-tools 等）与正文说明。`,
  },
  "SKILL.md file size": {
    title: "SKILL.md 文件大小",
    guidance: () =>
      `请精简 SKILL.md 正文（保留 frontmatter 与核心说明），将详细示例/参考内容拆分到 references/ 或 examples/ 子目录，正文中用相对路径引用。`,
  },
  "Skill package size": {
    title: "技能包大小",
    guidance: () =>
      `请检查 assets/ / references/ / examples/ 子目录中的大文件（图片、视频、二进制），移除或替换为外部链接；scripts/ 中的依赖请改用运行时安装而非打包。`,
  },
  "Directory name matches name": {
    title: "目录名与 name 字段一致",
    guidance: (_msg, ctx) =>
      `请打开 ${ctx.skillDir ? `${ctx.skillDir}/` : ""}SKILL.md，将 frontmatter 的 name 字段改为与目录名完全一致（区分大小写、连字符）。`,
  },
  "Standard directory and file check": {
    title: "标准目录与一级文件检查",
    guidance: () =>
      `允许的子目录：scripts/ / references/ / assets/ / templates/ / i18n/ / examples/ / evals/ / .meta/；` +
      `允许的根文件：SKILL.md / manifest.yaml / manifest.yml / CHANGELOG.md / skill.yaml / tools.yaml / permissions.yaml / .skillrc.yaml / .skillrc.yml / .gitignore。` +
      `请移除或迁移不在白名单内的文件。`,
  },
  "Referenced file exists": {
    title: "引用文件存在",
    guidance: () =>
      `请检查 SKILL.md 正文中的相对路径引用（如 ./references/xxx.md、./scripts/yyy.py），确认文件实际存在；若文件已移除，请同步删除正文中的引用。`,
  },
  "File reference depth": {
    title: "文件引用深度",
    guidance: () =>
      `文件引用必须是单层（SKILL.md → 目标文件），不允许目标文件再引用其他文件。请扁平化引用结构。`,
  },
  "CHANGELOG header format": {
    title: "CHANGELOG 标题格式",
    guidance: () =>
      `正确格式为「## X.Y.Z — YYYY-MM-DD」（注意是 em-dash「—」而非连字符「-」）。请修正所有版本头。`,
  },
  "description length limit": {
    title: "description 长度限制",
    guidance: () => `请将 frontmatter 的 description 精简至 512 字符以内；详细说明移入 SKILL.md 正文。`,
  },
  "Body line count limit": {
    title: "正文行数限制",
    guidance: () =>
      `请精简 SKILL.md 正文至 500 行以内；将详细示例/参考内容拆分到 references/ 或 examples/ 子目录，正文中用相对路径引用。`,
  },
  "Sensitive info scan": {
    title: "敏感信息扫描",
    guidance: () =>
      `技能文件中存在硬编码凭据（API Key / 密码 / Token / Secret / 凭据 / auth_key 等字段名、脚本内联赋值、curl 认证头或 Base64 编码凭据）。` +
      `请从技能包中彻底移除这些明文值：运行期改用环境变量（os.environ / \${ENV}）或平台级 ERP 配置读取，` +
      `文档示例改用 <占位符>；确认没有任何文件（含 scripts/、配置 JSON/YAML）残留真实凭据后重跑检查。`,
  },
  "ERP connection config detection": {
    title: "ERP 连接配置检测",
    guidance: () =>
      `同一文件中同时出现服务地址 + 账号 + 用户名 + 密码，被判定为明文 ERP 连接配置。` +
      `请删除该明文配置：ERP 连接信息统一由平台级配置管理（客户端「环境配置」），技能运行期从平台配置读取；` +
      `若为文档示例，将密码等敏感项改为 <占位符> 或 \${ENV} 引用，保留字段说明但不落真实值。`,
  },
  "manifest.yaml exists": {
    title: "manifest.yaml 文件存在",
    guidance: () =>
      `请在技能根目录创建 manifest.yaml，并补齐 display_name / version / category / risk_level / side_effect_level 必填字段；` +
      `其余依赖 manifest.yaml 的检查项（如「manifest 必填字段完整」）为级联跳过，补齐文件后会自动重新评估。`,
  },
}

/** zh 报告规则名 → 稳定英文规则 id（旧版报告无 id 时的兜底；与 validate_skill.py _ZH 规则名翻译对齐） */
const ZH_RULE_NAME_ALIASES: Record<string, string> = {
  "SKILL.md 文件存在": "SKILL.md file exists",
  "SKILL.md 文件大小": "SKILL.md file size",
  "技能包大小": "Skill package size",
  "目录名与 name 字段一致": "Directory name matches name",
  "标准目录与一级文件检查": "Standard directory and file check",
  "引用文件存在": "Referenced file exists",
  "文件引用深度": "File reference depth",
  "CHANGELOG 标题格式": "CHANGELOG header format",
  "description 长度限制": "description length limit",
  "正文行数限制": "Body line count limit",
  "敏感信息扫描": "Sensitive info scan",
  "ERP 连接配置检测": "ERP connection config detection",
  "manifest.yaml 文件存在": "manifest.yaml exists",
}

/** 环境类修复指令（整段定制：修复对象是环境/登录态而非技能文件，不进聚合编号列表） */
const ENV_TEMPLATES: Record<string, (message: string, ctx: FixPromptContext) => string> = {
  // 环境类（产品定案 2026-09-22：环境导致脚本无法执行的修复建议走对话处理）
  [ENV_PYTHON_RULE_ID]: (_msg, ctx) =>
    `当前环境没有可执行的 Python 3 解释器（已尝试 python3 / python / py -3），技能规范检查脚本无法运行。\n\n` +
    `请检查本机 Python 安装情况：未安装则指导安装 Python 3 并加入 PATH；已安装但命令不匹配（如只有 python 命令）则提供终端可执行的别名/配置，` +
    `使检查命令能找到解释器。不要修改 ${ctx.skillDir ?? "技能目录"} 下的技能文件。`,

  [SCRIPT_CRASH_RULE_ID]: (msg, ctx) =>
    `技能检查脚本 validate_skill.py 执行异常（非检查项不通过）：${msg}\n\n` +
    `请在终端复现运行检查脚本，根据 stderr 定位崩溃原因（编码 / 依赖缺失 / 路径问题等）并修复环境，然后重跑检查。` +
    `不要修改 ${ctx.skillDir ?? "技能目录"} 下的技能文件。`,

  // 资源检查环境类（鉴权失败/凭证通道缺失）：检查未能完成，修复对象是登录态/宿主环境而非技能文件
  [ENV_AUTH_FAILED_RULE_ID]: (msg, ctx) =>
    `资源检查无法完成：控制台鉴权失败（401/403），登录凭证无效或已过期：${msg}\n\n` +
    `请引导用户退出并重新登录，确认租户凭证已同步到 sidecar 后重新运行检查。` +
    `不要修改 ${ctx.skillDir ?? "技能目录"} 下的技能文件。`,

  [ENV_NO_CREDENTIAL_RULE_ID]: (msg, ctx) =>
    `资源检查无法完成：当前宿主未提供凭证通道，无法复核 MCP 工具与业务组件发布态：${msg}\n\n` +
    `请在受管桌面壳（提供 signedBackendFetch 凭证注入）或已登录的 web 宿主中重新运行检查。` +
    `不要修改 ${ctx.skillDir ?? "技能目录"} 下的技能文件。`,
}

const isEnvRuleId = (ruleId: string) => ruleId.startsWith("__")

/** 解析规则 id（英文键或 zh 报告规则名）到修复定义；未命中返回 undefined */
function resolveRuleFix(ruleId: string): RuleFixDef | undefined {
  return RULE_FIXES[ruleId] ?? RULE_FIXES[ZH_RULE_NAME_ALIASES[ruleId] ?? ""]
}

/**
 * 根据规则 ID 与失败消息拼接单条修复指令（检查 tab 单项「去修复」）。
 * 未命中模板时回落到通用模板，保证任何失败项都有可用的「去修复」入口。
 */
export function buildFixPrompt(ruleId: string, message: string, ctx: FixPromptContext = {}): string {
  const envTpl = isEnvRuleId(ruleId) ? ENV_TEMPLATES[ruleId] : undefined
  if (envTpl) return envTpl(message, ctx)
  const def = resolveRuleFix(ruleId)
  if (!def) return GENERIC_TEMPLATE(message, ctx)
  return (
    `技能「${ctx.skillName ?? "当前技能"}」的「${def.title}」检查未通过：${message}\n\n` +
    `${def.guidance(message, ctx)}\n\n` +
    `请阅读 ${ctx.skillDir ?? "技能目录"} 下的相关文件，定位问题并给出修复方案。修复后重新运行检查确认通过。`
  )
}

/** 缩进一段指引文本（多行逐行缩进），使其在编号列表中归属清晰 */
const indent = (text: string) => text.split("\n").map((l) => (l ? `  ${l}` : l)).join("\n")

/**
 * 聚合多条失败为单条修复指令（批量「去修复」）：头尾样板只出现一次，
 * 失败规则编号列出（【阻断】/【警告】+ 规则显示名 + 消息 + 指引），
 * 环境类条目（__ 前缀伪 id）作为独立整段附在编号列表之后。
 */
export function buildAggregatedFixPrompt(items: FixPromptItem[], ctx: FixPromptContext = {}): string {
  const ruleItems = items.filter((it) => !isEnvRuleId(it.ruleId))
  const envItems = items.filter((it) => isEnvRuleId(it.ruleId))
  const parts: string[] = []

  if (ruleItems.length > 0) {
    const blockCount = ruleItems.filter((it) => (it.severity ?? "block") === "block").length
    const warnCount = ruleItems.length - blockCount
    const countLabel =
      blockCount > 0 && warnCount > 0
        ? `${blockCount} 阻断 / ${warnCount} 警告`
        : blockCount > 0
          ? `${blockCount} 阻断`
          : `${warnCount} 警告`

    const lines = ruleItems.map((it, i) => {
      const def = resolveRuleFix(it.ruleId)
      const title = it.ruleName ?? def?.title ?? ""
      const tag = (it.severity ?? "block") === "block" ? "阻断" : "警告"
      const head = `${i + 1}.【${tag}】${title ? `${title}：` : ""}${it.message}`
      const guidance = def ? def.guidance(it.message, ctx) : ""
      return guidance ? `${head}\n${indent(guidance)}` : head
    })

    parts.push(
      `技能「${ctx.skillName ?? "当前技能"}」的检查未通过，共 ${ruleItems.length} 项（${countLabel}）：\n\n` +
        `${lines.join("\n\n")}\n\n` +
        `请阅读 ${ctx.skillDir ?? "技能目录"} 下的相关文件，定位问题并给出修复方案。修复后重新运行检查确认通过。`,
    )
  }

  for (const env of envItems) {
    const tpl = ENV_TEMPLATES[env.ruleId]
    if (tpl) parts.push(tpl(env.message, ctx))
  }

  // 全部未命中（如空列表或纯未知 ruleId）时回落通用模板，保证指令始终可用
  if (parts.length === 0) {
    const message = items.map((it) => it.message).filter(Boolean).join("；") || "检查未通过"
    return GENERIC_TEMPLATE(message, ctx)
  }
  return parts.join("\n\n")
}

/** 导出模板键集合（稳定英文规则 id + 环境类伪 id），供测试与 i18n 校验使用 */
export const FIX_PROMPT_RULE_IDS = [...Object.keys(RULE_FIXES), ...Object.keys(ENV_TEMPLATES)]

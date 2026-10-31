/** 输入框补全用的 mock：@ 可引用的文件（与文件树同源）、/ 可用的技能与指令 */

export { projectFilePaths as projectFiles } from "./files"

export interface SlashCommand {
  id: string
  /** 输入框里显示的触发词，含前导 "/" */
  title: string
  description?: string
  descriptionKey?: string
  kind: "skill" | "command"
  /** 技能来源：内置 / 用户 / 项目，决定右侧徽标 */
  scope?: "builtin" | "user" | "project"
}

export const slashCommands: SlashCommand[] = [
  { id: "evaluation-case-designer", title: "/评测用例设计", description: "根据业务场景设计和完善评测用例", kind: "skill", scope: "builtin" },
  { id: "kingdee-skill-creator", title: "/skill-builder", description: "创建或优化技能", kind: "skill", scope: "builtin" },
  { id: "ai-partner-creator", title: "/agent-builder", description: "创建或配置智能体", kind: "skill", scope: "builtin" },
  { id: "kingdee-design", title: "/prototype-builder", description: "探索应用原型", kind: "skill", scope: "builtin" },
  { id: "standalone-build", title: "/general-app-builder", description: "开发通用应用", kind: "skill", scope: "builtin" },
  { id: "app-build", title: "/cosmic-app-builder", description: "开发苍穹应用", kind: "skill", scope: "builtin" },
  { id: "mcp-apps-builder", title: "/mcp-apps-builder", description: "开发业务组件", kind: "skill", scope: "builtin" },
  { id: "delivery-notice-query", title: "/delivery-notice-query", description: "发货通知单查询", kind: "skill", scope: "project" },
  { id: "leave-request", title: "/leave-request", description: "办理请假申请", kind: "skill", scope: "user" },
  { id: "session.new", title: "/new", descriptionKey: "command.session.new", kind: "command" },
  { id: "session.compact", title: "/compact", descriptionKey: "command.session.compact", kind: "command" },
  { id: "session.undo", title: "/undo", descriptionKey: "command.session.undo", kind: "command" },
  { id: "session.share", title: "/share", descriptionKey: "command.session.share", kind: "command" },
]

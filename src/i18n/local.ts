/**
 * 原型工程自己新增的文案（线上字典里还没有的）。
 * 做新功能原型时把 key 加在这里，中英文都要写；功能合进线上后，换成线上的 key 并从这里删掉。
 */
export const localZh: Record<string, string> = {
  "proto.agentConfig.moreActions": "更多操作",
  "proto.agentConfig.moreChanges": "查看全部 {{count}} 条修改",
  "proto.agentConfig.lessChanges": "收起修改",
  "proto.agentConfig.history": "历史版本（{{count}}）",
  "proto.plan.title": "技能执行方案",
  "proto.plan.parallel": "并行获取参考价格",
  "proto.plan.readonly": "只读查询 · 并行获取参考价格",
  "proto.tool.write": "写入",
  "proto.prompt.enhanceRequirements": "请先梳理业务目标与输入输出，发现可复用的业务对象和工具；对关键业务规则向我确认，再创建技能并完成校验，最后说明使用方式和适用边界。",
  "proto.process.explored": "已探索 {{summary}}",
  "proto.process.toolCall": "调用了",
  "proto.process.skillCalled": "已调用",
  "proto.process.skillRunning": "调用中",
  "proto.login.title": "登录灵基 Build",
  "proto.login.account": "账号",
  "proto.login.accountPlaceholder": "请输入姓名全拼",
  "proto.login.password": "密码",
  "proto.login.passwordPlaceholder": "请输入密码",
  "proto.login.submit": "登录",
  "proto.login.error": "账号或密码不正确",
}

export const localEn: Record<string, string> = {
  "proto.agentConfig.moreActions": "More actions",
  "proto.agentConfig.moreChanges": "View all {{count}} changes",
  "proto.agentConfig.lessChanges": "Show fewer changes",
  "proto.agentConfig.history": "Version history ({{count}})",
  "proto.plan.title": "Skill execution plan",
  "proto.plan.parallel": "Fetch reference prices in parallel",
  "proto.plan.readonly": "Read-only · Fetch reference prices in parallel",
  "proto.tool.write": "Write",
  "proto.prompt.enhanceRequirements": "Clarify the business goal, inputs, and outputs. Discover reusable business entities and tools, confirm key rules with me, then create and validate the skill. Explain how to use it and its limitations.",
  "proto.process.explored": "Explored {{summary}}",
  "proto.process.toolCall": "Called",
  "proto.process.skillCalled": "invoked",
  "proto.process.skillRunning": "invoking",
  "proto.login.title": "Sign in to Lingee Build",
  "proto.login.account": "Account",
  "proto.login.accountPlaceholder": "Full pinyin of your name",
  "proto.login.password": "Password",
  "proto.login.passwordPlaceholder": "Enter password",
  "proto.login.submit": "Sign in",
  "proto.login.error": "Incorrect account or password",
}

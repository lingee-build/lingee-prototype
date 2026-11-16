import * as fixtures from "./fixtures/dev"

/** 三个开发页共用的内存数据。会话回放生成的技能 / 智能体 / 业务组件也写到这里，所以开发页能看到新卡片 */
export const devStore = structuredClone({ skills: fixtures.skills, agents: fixtures.agents, mcpApps: fixtures.mcpApps })

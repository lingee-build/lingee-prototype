import { artifactConfigScenario } from "./artifact-config"
import { evaluationGenerateScenario } from "./evaluation-generate"
import { skillRepairScenario } from "./skill-repair"
import { agentRepairScenario } from "./agent-repair"
import { procurementCreateScenario, procurementTestScenario } from "./procurement-create"
import { procurementArtifacts } from "../procurement-artifacts"
import { agentCreateScenario } from "./agent-create"
import { mcpAppCreateScenario } from "./mcp-app-create"
import { mcpAppLocalTestScenario, isMcpAppLocalTest } from "./mcp-app-local-test"
import { mcpAppRegularAccessScenario } from "./mcp-app-regular-access"
import { skillComponentTestScenario, isSkillComponentTest } from "./skill-component-test"
import { skillCreateScenario } from "./skill-create"
import { workflowCreateScenario } from "./workflow-create"
import { workflowEditScenario } from "./workflow-edit"
import { workflowService } from "@/services/workflow"
import { WORKFLOW_CREATOR } from "../fixtures/workflow-cases"
import type { Scenario, ScenarioContext } from "./types"

export type { Scenario, ScenarioStep } from "./types"
export { mcpAppLocalTestScenario, isMcpAppLocalTest }

/** 按提示词开头的技能（/xxx）挑剧本：智能体开发、业务组件开发各有一套，其余都按技能开发回放 */
export function pickScenario(ctx: ScenarioContext): Scenario {
  const preparation = artifactConfigScenario(ctx)
  if (preparation) return preparation
  if (ctx.repairTarget) return ctx.repairTarget.objectType === "agent" ? agentRepairScenario(ctx) : skillRepairScenario(ctx)
  // MCP App 本地测试会话：根据 session.localTest.objectId 路由到组件直测场景
  if (ctx.sessionId && isMcpAppLocalTest(ctx.sessionId)) {
    const scenario = mcpAppLocalTestScenario(ctx.sessionId, ctx.prompt)
    if (scenario) return scenario
  }
  // 普通会话中访问业务组件：检测组件名并路由到沙箱预览场景
  if (ctx.sessionId) {
    const regularScenario = mcpAppRegularAccessScenario(ctx.sessionId, ctx.prompt)
    if (regularScenario) return regularScenario
  }
  // 技能/智能体本地测试会话中引用了组件：路由到技能→组件场景
  if (ctx.sessionId && isSkillComponentTest(ctx.sessionId)) {
    const scenario = skillComponentTestScenario(ctx.sessionId)
    if (scenario) return scenario
  }
  if (/(生成|新增|补充|设计).*(评测|测试).*用例|\/evaluation-case-designer/.test(ctx.prompt)) return evaluationGenerateScenario(ctx)
  const skill = ctx.prompt.match(/^\/(\S+)/)?.[1]
  if (skill && procurementArtifacts.has(skill)) return procurementTestScenario(skill)
  if (/采购.*价格.*(异常|预警)/.test(ctx.prompt)) return procurementCreateScenario(ctx)
  if (skill === "ai-partner-creator") return agentCreateScenario(ctx)
  if (skill === "mcp-apps-builder") return mcpAppCreateScenario(ctx)
  // 关联了工作流的会话：后续消息都在修改这条工作流的画布
  const linked = ctx.sessionId ? workflowService.bySession(ctx.sessionId) : undefined
  if (linked) return workflowEditScenario(ctx, linked)
  if (skill === WORKFLOW_CREATOR) return workflowCreateScenario(ctx)
  return skillCreateScenario(ctx)
}

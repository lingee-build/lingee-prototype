import type { DrawerTarget } from "@/stores/panel"
import { AgentDrawer } from "./AgentDrawer"
import { McpAppDrawer } from "./McpAppDrawer"
import { SkillDrawer } from "./SkillDrawer"
import { WorkflowDrawer } from "./WorkflowDrawer"

/** 右侧面板里的产物抽屉：按产物类型分发到技能预览 / 智能体配置 / 业务组件详情 / 工作流画布 */
export function DrawerView(props: { target: DrawerTarget; working: boolean }) {
  const { target } = props
  if (target.kind === "kdskill") return <SkillDrawer key={target.id} id={target.id} working={props.working} />
  if (target.kind === "workflow") return <WorkflowDrawer key={target.id} id={target.id} />
  if (target.kind === "agentConfig") return <AgentDrawer key={target.id} id={target.id} working={props.working} />
  return <McpAppDrawer key={target.id} id={target.id} working={props.working} />
}

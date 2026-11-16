import { currentDisplayName } from "@/stores/auth"
import { devStore } from "../dev-store"
import type { Agent } from "../fixtures/dev"
import type { Scenario, ScenarioContext } from "./types"
import { entityName, slugOf } from "./types"

const ASSISTANT_JSON = (agent: Agent) =>
  JSON.stringify({ id: agent.id, name: agent.name, desc: agent.desc, domain: agent.domain, skills: agent.skills.map((x) => x.skillName), knowledge: [] }, null, 2)

/** 提示词里点了某个已有智能体的名字（「编辑【xxx】」）就是修改，否则是新建 */
const findTarget = (prompt: string) => devStore.agents.find((x) => prompt.includes(`【${x.name}】`))

/** 剧本：创建 / 修改一个智能体。结束时给出智能体产物卡片，并把结果写进「智能体开发」页的数据 */
export const agentCreateScenario = ({ prompt, projectId }: ScenarioContext): Scenario => {
  const target = findTarget(prompt)
  const name = target?.name ?? entityName(prompt, "智能体")
  const request = prompt.replace(/^\/\S+\s*/, "").replace(/^编辑【[^】]+】[:：]?/, "").trim()

  const finish = () => {
    const now = new Date().toISOString()
    if (target) {
      const summary = `角色设定调整为「${request.slice(0, 24) || "按对话要求调整"}」`
      devStore.agents = devStore.agents.map((x) =>
        x.id === target.id
          ? {
              ...x,
              status: "saved",
              isChanged: !!x.backendStatus,
              role: `${x.role}\n\n# 补充要求\n- ${request || "按对话要求调整回答方式"}`,
              changelog: { ...x.changelog, pending: [...x.changelog.pending, { createdAt: now, operator: currentDisplayName(), summary }] },
            }
          : x,
      )
      return { kind: "ai-partner", config: { id: target.id, title: target.name } }
    }
    const id = slugOf(name, "agent")
    const skill = devStore.skills.find((x) => x.projectId === projectId) ?? devStore.skills[0]
    const agent: Agent = {
      id,
      projectId,
      name,
      desc: request.slice(0, 80) || `${name}：由对话生成的智能体。`,
      avatar: "",
      status: "saved",
      domain: "general",
      createdAt: now,
      role: `# 角色\n你是「${name}」。${request || "根据用户的问题给出准确、简洁的回答。"}\n\n# 工作方式\n1. 先确认用户的真实诉求，信息不足时主动追问\n2. 需要查数或办理事务时调用已配置的技能\n3. 回答给出依据，涉及制度的引用知识库原文\n\n# 边界\n- 写操作前向用户复述关键信息并得到确认`,
      skills: skill
        ? [{ id: skill.name, name: skill.displayName, skillName: skill.name, desc: skill.desc, source: "local", publishStatus: skill.enterpriseStatus === "published" ? "published" : "unpublished" }]
        : [],
      knowledge: [],
      changelog: { pending: [{ createdAt: now, operator: currentDisplayName(), summary: "创建智能体" }], versions: [] },
    }
    devStore.agents = [...devStore.agents.filter((x) => x.id !== id), agent]
    return { kind: "ai-partner", config: { id, title: name } }
  }

  return {
    todos: target
      ? ["读取现有配置", "按要求调整角色设定", "保存并校验配置"]
      : ["明确智能体定位", "编写角色设定", "挑选技能并写入配置", "校验配置"],
    steps: target
      ? [
          {
            todo: 0,
            reasoning: `用户要修改「${name}」。先读现有的 assistant.json，弄清当前的角色设定、技能和知识范围，再决定改哪里。`,
            tools: [
              { tool: "skill", title: "ai-partner-creator", output: "已加载智能体创建规范" },
              { tool: "read", title: `ai-partners/${target.id}/assistant.json`, output: ASSISTANT_JSON(target) },
            ],
          },
          {
            todo: 1,
            tools: [{ tool: "edit", title: `ai-partners/${target.id}/assistant.json`, detail: "+3 -1", output: `role: 追加「补充要求」一节\n- ${request || "按对话要求调整回答方式"}` }],
          },
          {
            todo: 2,
            text: `已按你的要求更新「${name}」的角色设定。\n\n- 在角色设定末尾补充了一节 **补充要求**\n- 技能与知识范围保持不变\n\n改动已保存到本地，状态为 **已保存**；确认无误后可以在右侧配置面板里「提交」审核。`,
            card: finish,
          },
        ]
      : [
          {
            todo: 0,
            reasoning: "先确定这个智能体服务谁、解决什么问题。没有特别说明受众，按面向全体员工来写：语气亲切，少用专业术语。",
            tools: [{ tool: "skill", title: "ai-partner-creator", output: "已加载智能体创建规范" }],
          },
          {
            todo: 1,
            tools: [{ tool: "read", title: "references/role-template.md", output: "角色设定建议包含：角色、工作方式、边界三节。" }],
          },
          {
            todo: 2,
            tools: [
              { tool: "grep", title: "skills/*/SKILL.md", detail: "找到可用技能", output: devStore.skills.slice(0, 4).map((x) => `${x.name} — ${x.displayName}`).join("\n") },
              { tool: "write", title: `ai-partners/${slugOf(name, "agent")}/assistant.json`, output: `{\n  "name": "${name}",\n  "domain": "general",\n  "skills": ["…"]\n}` },
            ],
          },
          {
            todo: 3,
            text: `「${name}」已经创建好了。\n\n## 配置概览\n\n| 项目 | 内容 |\n| --- | --- |\n| 所属领域 | 通用 |\n| 角色设定 | 角色 / 工作方式 / 边界 三节 |\n| 技能 | 已挂 1 个本项目技能 |\n| 知识 | 暂未关联 |\n\n## 下一步\n\n- 点卡片打开配置面板，补充知识目录或调整角色设定\n- 点 **本地测试** 和它对话一轮，确认回答符合预期\n\n> 这是原型工程的模拟回复，内容由剧本生成。`,
            card: finish,
          },
        ],
  }
}

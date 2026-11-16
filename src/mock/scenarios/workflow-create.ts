import { workflowService } from "@/services/workflow"
import { useWorkflowDocs } from "@/stores/workflow-docs"
import type { WfNodeConfig } from "../fixtures/workflow-graphs"
import { matchWorkflowCase, WORKFLOW_CREATOR, type WorkflowCase } from "../fixtures/workflow-cases"
import type { Scenario, ScenarioContext } from "./types"
import { entityName } from "./types"

const table = (headers: string[], rows: string[][]) =>
  `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n${rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}`

const NODE_TYPES = table(
  ["节点类型", "用途"],
  [
    ["开始 / 结束", "定义流程输入变量与最终输出"],
    ["智能体", "调用已发布的智能体（完整智能体或单次模型）"],
    ["代码", "Python 代码处理数据，超时 30 秒"],
    ["条件", "按表达式分支"],
    ["并行 / 并行汇入", "分支同时执行，全部成功后汇入"],
    ["循环", "按集合（顺序 / 并行）或按条件重复执行"],
    ["人工输入", "指定办理人填写表单后继续"],
  ],
)

const options = (q: WorkflowCase["questions"][number]) => ({
  question: q.question,
  custom: true,
  options: q.options.map(([label, description], i) => ({ label, description, recommended: i === 0 })),
})

/**
 * 剧本：通过 workflow-builder 在对话中设计一个工作流。
 * 过程使用 Build 现有的输出控件（技能调用、工具组、思考、提问、正文、产物卡片），
 * 结束时把工作流写进「工作流开发」，卡片点开后在右侧画布里查看和继续编辑。
 */
export const workflowCreateScenario = ({ prompt, sessionId, projectId }: ScenarioContext): Scenario => {
  const matched = matchWorkflowCase(prompt)
  const request = prompt.replace(/^\/\S+\s*/, "").trim()
  const name = workflowService.uniqueName(matched?.name ?? entityName(prompt, "工作流"))
  let answers: string[] = matched?.questions.map((q) => q.options[0][0]) ?? []

  const finish = () => {
    const desc = matched
      ? `${matched.desc}${answers.length ? `（${matched.questions.map((q, i) => `${q.question}：${answers[i]}`).join("；")}）` : ""}`
      : request.slice(0, 80) || `${name}：由对话生成的工作流。`
    const item = workflowService.createNow({ name, desc, template: matched?.template ?? "blank", sessionId, projectId })
    // 把确认的事项写进节点配置（模板级内容）；具体办理人等运行时信息仍在试运行时指定
    const docs = useWorkflowDocs.getState()
    const graph = docs.docs[item.id]?.graph
    if (graph && matched) {
      const set = (id: string, config: Partial<WfNodeConfig>) => {
        const node = graph.nodes.find((n) => n.id === id)
        if (node) node.config = { ...node.config, ...config }
      }
      if (matched.id === "sales") set("review", { assignee: answers[0] === "发起人本人" ? "initiator" : answers[0] })
      if (matched.id === "expense") {
        // 「全部单据」：所有报销单都走财务确认
        if (answers[0] === "全部单据") set("cond", { branches: [{ id: "over", label: "全部单据", logic: "and", rules: [{ left: "start.报销单号", op: "isNot", right: "" }] }] })
        set("review", { assignee: answers[1] })
      }
      if (matched.id === "batch") set("reviews", { concurrency: answers[0].startsWith("顺序") ? "sequential" : "parallel", onError: answers[1].startsWith("终止") ? "block" : "exclude" })
      docs.setGraph(item.id, structuredClone(graph))
    }
    return { kind: "kd-workflow", config: { id: item.id, title: name, desc: "工作流 · 点击在右侧画布中查看和编辑" } }
  }

  const load = [
    { text: "我来加载工作流创建（workflow-builder）技能，按规范把你的需求设计成可试运行的工作流。" },
    { tools: [{ tool: "skill" as const, title: WORKFLOW_CREATOR, output: "已加载工作流设计规范、节点库、DSL 结构与校验参考文件。" }] },
  ]

  // 没有匹配到案例：只搭出开始 / 结束节点，后续在画布或对话中继续补充
  if (!matched)
    return {
      todos: [],
      pacing: { textUnit: "paragraph", textChunk: 1, textDelayMs: 600, textHoldMs: 900, toolDelayMs: 800, stepPauseMs: 100 },
      steps: [
        ...load,
        {
          tools: [
            { tool: "read", title: "skills/workflow-builder/references/workflow-dsl.md", output: "工作流 DSL：nodes / edges / variables；节点需声明输入、输出与执行配置。" },
            { tool: "mcp", title: "list_node_types", output: NODE_TYPES },
          ],
        },
        {
          reasoningUnit: "sentence",
          reasoningDelayMs: 900,
          reasoning: "需求里还没有足够的信息确定处理步骤和参与的智能体。先创建一个包含开始、结束节点的工作流草稿，让用户在画布上补充，或在对话里继续描述。",
        },
        { tools: [{ tool: "write", title: "workflow.json", detail: `/workflows/${name}/`, output: JSON.stringify({ name, nodes: ["start", "end"], edges: [["start", "end"]] }, null, 2) }] },
        {
          text: `已创建「${name}」的工作流草稿，目前包含开始和结束节点。\n\n点击下方卡片在右侧打开画布，可以从节点库拖入节点；也可以继续告诉我要处理哪些步骤、由哪些智能体完成。`,
          card: finish,
        },
      ],
    }

  return {
    todos: [],
    pacing: { textUnit: "paragraph", textChunk: 1, textDelayMs: 600, textHoldMs: 900, toolDelayMs: 800, stepPauseMs: 100 },
    steps: [
      ...load,
      { text: `技能加载完成。这是一个「${matched.title.zh}」类工作流，我先并行读取设计规范、获取可用节点类型，并检索可复用的智能体和技能。` },
      {
        tools: [
          { tool: "read", title: "skills/workflow-builder/references/workflow-dsl.md", output: "工作流 DSL：nodes / edges / variables；节点需声明输入、输出与执行配置；并行分支须指定汇聚节点与策略。" },
          { tool: "read", title: "skills/workflow-builder/references/human-review.md", output: "人工输入节点需指定办理人、表单字段与可选的下一步；办理结果写入流程变量。" },
          { tool: "mcp", title: "list_node_types", output: NODE_TYPES },
          {
            tool: "mcp",
            title: "search_agents",
            detail: `keyword="${matched.title.zh}"`,
            output: table(["智能体", "状态", "说明"], matched.agents.map((agent) => [agent, "已发布", "可在智能体节点中引用"])),
          },
          { tool: "mcp", title: "search_skills", detail: "scope=当前项目", output: "业务分析 — 读取并分析业务数据\n报告生成 — 按模板输出结构化报告" },
        ],
      },
      {
        reasoningUnit: "sentence",
        reasoningDelayMs: 900,
        reasoningDisplay: "scroll",
        reasoning:
          matched.id === "batch"
            ? "单据数量不固定，适合用循环节点按集合处理。先用代码节点把单据拆成工作项，循环对每一项执行一次内部流程。审核结论需要代码节点做格式校验，最后由智能体汇总。"
            : "需求中有两类可以同时进行的处理，放进并行节点能缩短整体耗时，汇聚后再统一判断。人工确认不是每次都需要，用条件节点按输入决定是否进入人审，避免阻塞常规情况。",
      },
      { text: `可用节点和 ${matched.agents.length} 个已发布智能体已就绪。执行方案如下：\n\n\`\`\`text\n${matched.flow}\n\`\`\`` },
      { text: "生成前还需要确认以下事项，确认后写入节点配置：" },
      {
        question: matched.questions.map(options),
        onAnswer: (reply) => {
          answers = matched.questions.map((q, i) => reply[i]?.[0] || q.options[0][0])
        },
      },
      {
        resolve: () => ({
          text: `已确认：${matched.questions.map((q, i) => `${q.question}为「${answers[i]}」`).join("，")}。现在生成工作流定义并校验。`,
        }),
      },
      {
        resolve: () => ({
          tools: [
            {
              tool: "write",
              title: "workflow.json",
              detail: `/workflows/${name}/`,
              output: JSON.stringify({ name, nodes: matched.nodes.map(([node, type]) => ({ title: node, type })), settings: Object.fromEntries(matched.questions.map((q, i) => [q.question, answers[i]])) }, null, 2),
            },
            { tool: "bash", title: "workflow validate workflow.json", output: ["✓ 节点输入输出引用完整", "✓ 并行 / 循环节点均已配置汇聚策略", "✓ 智能体节点引用的智能体均已发布", "✓ 人工输入节点已指定办理人与表单", "✓ 不存在孤立节点与环路", "校验通过"].join("\n") },
          ],
        }),
      },
      { tools: [{ tool: "mcp", title: "output_check", output: "PASS\n工作流定义完整；业务规则与用户确认一致；可在画布中试运行。" }] },
      {
        resolve: () => ({
          text: `「${name}」已创建并通过校验。\n\n${table(["节点", "类型", "作用"], matched.nodes.map((row) => [...row]))}\n\n点击下方卡片在右侧打开画布，可以调整节点配置，或直接点「试运行」验证流程。`,
          card: finish,
        }),
      },
    ],
  }
}

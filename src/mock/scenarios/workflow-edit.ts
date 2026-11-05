import { workflowService } from "@/services/workflow"
import { useWorkflowDocs } from "@/stores/workflow-docs"
import type { WfGraph, WfNode, WfNodeType } from "../fixtures/workflow-graphs"
import type { Workflow } from "../fixtures/workflows"
import { addNode, diff, NODE_LABEL, patchNode, removeNode } from "@/features/workflow/graph-ops"
import { useWorkflowEditor } from "@/features/workflow/editor-store"
import { openWorkflowCanvas } from "@/features/workflow/open-canvas"
import { uid } from "../latency"
import type { Scenario, ScenarioContext } from "./types"

interface Edit {
  graph: WfGraph
  summary: string
  changed: string[]
}

const TYPE_WORDS: Array<[RegExp, WfNodeType]> = [
  [/人工|审批|确认|审核人|办理/, "human"],
  [/发送|通知|推送|提交|写入|MCP|工具|调用/i, "tool"],
  [/代码|计算|脚本|python/i, "code"],
  [/条件|判断|分支/, "condition"],
  [/循环|逐个|逐张|批量/, "loop"],
  [/并行/, "parallel"],
]

/** 从「增加一个xxx节点」里取节点名 */
const nameFrom = (text: string) =>
  text
    .match(/(?:增加|添加|新增|加一个|加个|插入)(?:一个|个)?「?([^「」，。,.；;\n]{2,16}?)」?(?:节点|步骤|环节)?(?:[，。,.；;\n]|$)/)?.[1]
    ?.replace(/^(一个|个)/, "")
    .trim()

/** 按提示词生成画布修改方案：能识别的指令给出方案，识别不了的给出说明，不乱改 */
function plan(graph: WfGraph, prompt: string): Edit | undefined {
  const text = prompt.replace(/^\/\S+\s*/, "")
  const target = graph.nodes.find((n) => text.includes(`「${n.title}」`)) ?? graph.nodes.find((n) => n.title.length >= 3 && text.includes(n.title))

  if (target && /删除|去掉|移除|不要/.test(text) && target.type !== "start" && target.type !== "end")
    return { graph: removeNode(graph, target.id), summary: `删除「${target.title}」，上下游直接连接`, changed: [] }

  if (target?.type === "agent" && /单次模型|单次调用/.test(text))
    return { graph: patchNode(graph, target.id, { config: { mode: "single" } }), summary: `「${target.title}」改为单次模型执行`, changed: [target.id] }
  if (target?.type === "agent" && /完整智能体/.test(text))
    return { graph: patchNode(graph, target.id, { config: { mode: "agent" } }), summary: `「${target.title}」改为完整智能体执行`, changed: [target.id] }

  const rename = text.match(/(?:改名|重命名|名称改)(?:为|成)?「([^」]{2,20})」/)
  if (target && rename) return { graph: patchNode(graph, target.id, { title: rename[1] }), summary: `「${target.title}」重命名为「${rename[1]}」`, changed: [target.id] }

  const role = text.match(/(?:由|交给|改成|改为)「?([^「」，。,.\s]{2,8}?)」?(?:来)?(?:办理|确认|审批|审核)/)
  const human = target?.type === "human" ? target : graph.nodes.find((n) => n.type === "human")
  if (human && role && !/增加|添加|新增/.test(text))
    return { graph: patchNode(graph, human.id, { config: { assignee: role[1] } }), summary: `「${human.title}」的办理用户改为「${role[1]}」`, changed: [human.id] }

  if (/增加|添加|新增|加一个|加个|插入/.test(text)) {
    const type = TYPE_WORDS.find(([re]) => re.test(text))?.[1] ?? "agent"
    const title = nameFrom(text) ?? NODE_LABEL[type]
    const after = target && target.type !== "end" ? target.id : undefined
    const { graph: next, node } = addNode(graph, type, after, title)
    const write = type === "tool" && /发送|通知|推送|提交|写入/.test(text)
    const extra: Partial<WfNode["config"]> =
      type === "agent"
        ? { agentRef: "报告撰写智能体", instruction: text.slice(0, 60), inputs: after ? [{ name: "上一步结果", source: `${after}.${(graph.nodes.find((n) => n.id === after)?.config.outputs ?? [{ name: "text" }])[0]?.name ?? "text"}` }] : [] }
        : type === "tool"
          ? { mcpServer: write ? "企业消息 MCP" : "", mcpTool: write ? "send_message" : "", write, outputs: [{ name: "发送结果", type: "string" as const, example: "已发送" }], sample: "已发送通知。" }
          : {}
    return {
      graph: { ...next, nodes: next.nodes.map((n) => (n.id === node.id ? { ...n, config: { ...n.config, ...extra } } : n)) },
      summary: `在${after ? `「${target!.title}」之后` : "「结束」之前"}新增${NODE_LABEL[type]}步骤「${title}」${write ? "（标记为写操作）" : ""}`,
      changed: [node.id],
    }
  }
  return undefined
}

const describe = (graph: WfGraph) => graph.nodes.map((n) => `- ${n.title}（${NODE_LABEL[n.type]}）`).join("\n")

/**
 * 剧本：在关联了工作流的会话里继续对话 = 修改画布。
 * 先读取画布（含用户手动修改），再给出修改方案：会话里出现修改卡片，画布进入预览，用户确认后才应用。
 */
export const workflowEditScenario = ({ prompt }: ScenarioContext, workflow: Workflow): Scenario => {
  useWorkflowDocs.getState().ensure(workflow)
  let edit: Edit | undefined
  let pending: string[] = []
  const locked = workflowService.find(workflow.id)?.status === "submitted"
  return {
    todos: [],
    pacing: { textUnit: "paragraph", textChunk: 1, textDelayMs: 500, textHoldMs: 600, toolDelayMs: 700, stepPauseMs: 100 },
    steps: locked
      ? [{ text: `「${workflow.name}」已提交审核，内容只读。需要修改时，先在右侧画布顶部点「撤回提交」，再告诉我要改什么。` }]
      : [
          {
            resolve: () => {
              const doc = useWorkflowDocs.getState().docs[workflow.id]
              pending = doc?.pending ?? []
              useWorkflowDocs.getState().clearPending(workflow.id)
              return {
                tools: [
                  {
                    tool: "read",
                    title: "读取画布",
                    detail: pending.length ? `含 ${pending.length} 处你在画布上的修改` : `${doc?.graph.nodes.length ?? 0} 个节点`,
                    output: `${pending.length ? `画布上的手动修改：\n${pending.map((x) => `- ${x}`).join("\n")}\n\n` : ""}当前节点：\n${describe(doc?.graph ?? { nodes: [], edges: [] })}`,
                  },
                ],
              }
            },
          },
          {
            resolve: () => {
              const graph = useWorkflowDocs.getState().docs[workflow.id]?.graph
              edit = graph ? plan(graph, prompt) : undefined
              if (!edit)
                return {
                  text: `${pending.length ? `已读取你在画布上的 ${pending.length} 处修改。` : ""}这次没有识别出要改画布的哪一部分。\n\n可以这样告诉我：\n- 在「某步骤」之后增加一个人工输入步骤\n- 在「某步骤」之后新增发送通知步骤\n- 把「某步骤」改成单次模型\n- 删除「某步骤」\n\n也可以在右侧画布选中节点，点节点配置底部的「交给助手调整」，我会针对这个节点修改。`,
                }
              const current = edit
              return { tools: [{ tool: "edit", title: "生成画布修改方案", detail: diff(graph, current.graph).join("；") || "1 处修改", output: current.summary }] }
            },
          },
          {
            resolve: () => {
              if (!edit) return {}
              const current = edit
              const base = useWorkflowDocs.getState().docs[workflow.id]?.graph ?? current.graph
              const id = uid("prop")
              useWorkflowEditor.getState().propose({ id, workflowId: workflow.id, graph: current.graph, base, summary: current.summary, changed: current.changed, status: "pending" })
              openWorkflowCanvas(workflow.id, workflow.name)
              return {
                text: `${pending.length ? `已结合你在画布上的 ${pending.length} 处修改。` : ""}修改方案如下，右侧画布已进入预览，改动的步骤用蓝色虚线框标出。确认后点「应用」，不需要就点「放弃」。`,
                card: () => ({ kind: "kd-workflow-change", config: { id, title: workflow.name, summary: current.summary } }),
              }
            },
          },
        ],
  }
}

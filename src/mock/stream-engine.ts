import { completeFromCard } from "@/features/artifact-config/config-state"
import type { Scenario } from "./scenarios/types"
import { conversationRepairScenario } from "./scenarios/evaluation-repair-dialog"
import { evaluationRepairTarget } from "@/services/evaluation-repair"
import { db } from "./db"
import { sleep, uid } from "./latency"
import { pickScenario } from "./scenarios"
import type { Message, Part, PermissionReply, SyncEvent, Todo } from "./types"

type Emit = (event: SyncEvent) => void

interface Run {
  controller: AbortController
  /** 回放停在提问 / 权限申请上时，这里存着让它继续的回调 */
  resume?: (value: unknown) => void
}

const runs = new Map<string, Run>()

/** 中止某个会话正在进行的回放（对应「停止生成」） */
export function abortStream(sessionId: string) {
  const run = runs.get(sessionId)
  run?.controller.abort()
  run?.resume?.(undefined)
}

/** 用户回答了提问（或跳过）/ 对权限申请做了决定：让暂停中的回放继续 */
export function resumeStream(sessionId: string, value: string[][] | PermissionReply) {
  runs.get(sessionId)?.resume?.(value)
}

/**
 * 把剧本回放成一串事件：待办 → 推理 → 工具调用 → 提问 / 权限 → 正文逐字输出 → 产物卡片。
 * 事件形状与真实后端的 SSE 对齐，页面只认事件，不关心来源。
 */
export async function runAssistantStream(sessionId: string, prompt: string, emit: Emit, model?: string, override?: Scenario) {
  const run: Run = { controller: new AbortController() }
  runs.set(sessionId, run)
  const aborted = () => run.controller.signal.aborted
  const session = db.sessions.find(x => x.id === sessionId)
  const bound = evaluationRepairTarget(sessionId)
  const scenario = override ?? (session && !bound && /评测|报告/.test(prompt) && /修复|修改|改进/.test(prompt)
    ? conversationRepairScenario(session, prompt)
    : pickScenario({ prompt, sessionId, repairTarget: bound, projectId: session?.projectId ?? "" }))

  const pause = (ms: number) => sleep(ms, run.controller.signal)
  const pacing = scenario.pacing

  const message: Message = { id: uid("msg"), sessionId, role: "assistant", agent: "build", model, time: { created: Date.now() }, parts: [] }
  db.messages.push(message)
  emit({ type: "session.status", sessionId, status: "running" })
  emit({ type: "message.updated", message: structuredClone(message) })

  const push = (part: Part) => {
    const index = message.parts.findIndex((x) => x.id === part.id)
    if (index === -1) message.parts.push(part)
    else message.parts[index] = part
    emit({ type: "message.part.updated", sessionId, messageId: message.id, part: structuredClone(part) })
  }

  const typewrite = async <T extends Part & { text: string }>(part: T, full: string, chunk: number, delay: number, unit?: "sentence") => {
    if (unit === "sentence" || pacing?.textUnit === "paragraph") {
      const paragraphs = unit === "sentence" ? (full.match(/[^。！？]+[。！？]?/g) ?? []).map((sentence,index) => `${index ? "\n\n" : ""}${sentence}`) : full.match(/[\s\S]+?(?:\n{2,}|$)/g) ?? []
      for (let index = 0; index < paragraphs.length && !aborted(); index++) {
        part.text += paragraphs[index]
        push(part)
        if (index < paragraphs.length - 1) await pause(unit === "sentence" ? delay : pacing?.textDelayMs ?? delay)
      }
      return
    }
    for (let i = 0; i < full.length && !aborted(); i += chunk) {
      part.text = full.slice(0, i + chunk)
      push(part)
      await pause(delay)
    }
  }

  const todos: Todo[] = scenario.todos.map((content, i) => ({ id: `todo_${i}`, content, status: "pending" }))
  const setTodo = (active: number) =>
    emit({
      type: "todo.updated",
      sessionId,
      todos: todos.map((todo, i) => ({ ...todo, status: i < active ? "completed" : i === active ? "in_progress" : "pending" })),
    })

  /** 暂停回放，等界面调用 resumeStream */
  const wait = (status: "clarification") => {
    emit({ type: "session.status", sessionId, status })
    return new Promise<unknown>((resolve) => (run.resume = resolve)).then((value) => {
      run.resume = undefined
      if (!aborted()) emit({ type: "session.status", sessionId, status: "running" })
      return value
    })
  }

  await pause(500)
  for (const template of scenario.steps) {
    if (aborted()) break
    const step = { ...template, ...template.resolve?.() }
    if (step.todo !== undefined) setTodo(step.todo)
    if (step.reasoning) {
      const part: Part = { id: uid("prt"), type: "reasoning", text: "", display: step.reasoningDisplay, time: { start: Date.now() } }
      await typewrite(part, step.reasoning, 3, step.reasoningDelayMs ?? 30, step.reasoningUnit)
      if (step.reasoningDisplay === "scroll") await pause(850)
      part.time.end = Date.now()
      push(part)
    }
    if (step.permission && !aborted()) {
      emit({ type: "permission.asked", request: { id: uid("per"), sessionId, ...step.permission } })
      const reply = (await wait("clarification")) as PermissionReply | undefined
      emit({ type: "permission.replied", sessionId })
      if (reply === "reject") {
        push({ id: uid("prt"), type: "text", text: "已按你的要求取消执行该命令。需要继续时告诉我即可。" })
        break
      }
    }
    for (const tool of step.tools ?? []) {
      if (aborted()) break
      const part: Part = { id: uid("prt"), type: "tool", ...tool, stageGroup: tool.stageGroup || (step.tools?.length ?? 0) > 1, state: "running" }
      push({ ...part, detail: undefined, output: undefined })
      await pause(pacing?.toolDelayMs ?? (600 + Math.random() * 500))
      if (aborted()) break
      push({ ...part, state: "completed" })
    }
    if (step.text && !aborted()) {
      await typewrite({ id: uid("prt"), type: "text", text: "" }, step.text, pacing?.textChunk ?? 4, pacing?.textDelayMs ?? 24)
      if (pacing) await pause(pacing.textHoldMs)
    }
    if (step.question && !aborted()) {
      const tool: Part = { id: uid("prt"), type: "tool", tool: "question", title: step.question[0].question, state: "running" }
      push(tool)
      emit({ type: "question.asked", request: { id: uid("que"), sessionId, questions: step.question } })
      const answers = (await wait("clarification")) as string[][] | undefined
      if (!aborted()) step.onAnswer?.(answers ?? [])
      emit({ type: "question.replied", sessionId })
      const summary = (answers ?? []).map((x) => x.join("、")).filter(Boolean)
      push({ ...tool, state: "completed", detail: summary.join("；") || "已跳过", output: summary.join("\n") || undefined, questionAnswers: step.question.map((question, i) => ({ question: question.question, answers: answers?.[i] ?? [] })) })
    }
    if (step.plan && !aborted()) push({ id: uid("prt"), type: "execution-plan", stages: step.plan })
    if (step.card && !aborted()) {
      // 卡片指令整段一次推出，避免逐字输出时把半截指令当正文显示
      const card = step.card()
      completeFromCard(card.kind, card.config)
      push({ id: uid("prt"), type: "text", text: `:::render:${card.kind} ${JSON.stringify(card.config)}:::` })
    }
    if (pacing && !aborted()) await pause(pacing.stepPauseMs)
  }

  if (!aborted()) emit({ type: "todo.updated", sessionId, todos: todos.map((todo) => ({ ...todo, status: "completed" })) })
  message.time.completed = Date.now()
  runs.delete(sessionId)
  emit({ type: "question.replied", sessionId })
  emit({ type: "permission.replied", sessionId })
  emit({ type: "message.updated", message: structuredClone(message) })
  emit({ type: "session.status", sessionId, status: "idle" })
}

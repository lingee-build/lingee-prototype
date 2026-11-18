import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { Empty, Icon, Markdown } from "@/ui"
import { publicUrl } from "@/lib/public-url"
import { useAuth } from "@/stores/auth"
import { ADDED_AGENTS, useWorkAgents, visibleDeveloped } from "@/stores/work-agents"

interface Message {
  role: "user" | "agent"
  text: string
}

/** 演示回复：销售周报专家按包内三个技能依次处理；其他智能体给通用回复 */
const replyOf = (agentName: string, skills: string[], question: string) =>
  agentName === "销售周报专家"
    ? [
        `已依次调用包内技能：${skills.map((s) => `**${s}**`).join(" → ")}`,
        "",
        "## 销售周报（2026-11-09 ~ 2026-11-15）",
        "",
        "| 指标 | 本周 | 环比 |",
        "| --- | --- | --- |",
        "| 销售额 | ¥ 3,286,400.00 | +12.4% |",
        "| 订单量 | 186 单 | +8.1% |",
        "| 回款额 | ¥ 2,104,900.00 | -3.2% |",
        "",
        "**重点客户**：华东精密制造（新签 ¥ 680,000.00）、远航电子（复购 3 单）。",
        "",
        "**风险与下周计划**：2 笔订单交期延误，建议下周一与生产计划确认排产；跟进 4 家逾期回款客户。",
      ].join("\n")
    : `收到：「${question}」。（原型演示回复）`

/** Work 中使用智能体：极简对话页，只用来演示从「使用」进入后可发起对话 */
export function Component() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const id = params.get("id") ?? ""
  const account = useAuth((s) => s.account)
  const developed = useWorkAgents((s) => visibleDeveloped(s.developed, account).find((x) => x.key === id))
  const added = ADDED_AGENTS.find((x) => x.id === id)
  const agent = developed
    ? { name: developed.name, desc: developed.desc, avatar: developed.avatar, skills: developed.skills.map((s) => s.displayName) }
    : added
      ? { name: added.name, desc: added.desc, avatar: added.avatar, skills: added.skills.map((s) => s.displayName) }
      : undefined
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, thinking])

  const back = () => navigate(developed ? "/work/agent?tab=developed" : "/work/agent")

  if (!agent)
    return (
      <div className="size-full flex flex-col items-center justify-center gap-3 bg-background-page">
        <Empty description="该智能体已卸载或不存在" />
        <button type="button" className="cursor-pointer border-none bg-transparent text-14-regular text-[var(--primary-600)]" onClick={back}>
          返回智能体列表
        </button>
      </div>
    )

  const example = agent.name === "销售周报专家" ? "帮我生成本周华东区的销售周报" : `介绍一下你能做什么`
  const send = (text: string) => {
    const q = text.trim()
    if (!q || thinking) return
    setMessages((m) => [...m, { role: "user", text: q }])
    setInput("")
    setThinking(true)
    window.setTimeout(() => {
      setMessages((m) => [...m, { role: "agent", text: replyOf(agent.name, agent.skills, q) }])
      setThinking(false)
    }, 1200)
  }

  return (
    <div className="size-full flex flex-col bg-background-page">
      <div className="shrink-0 flex items-center gap-2 px-6" style={{ height: 52, paddingLeft: 48 }}>
        <button type="button" aria-label="返回" className="flex size-7 cursor-pointer items-center justify-center rounded-[8px] border-none bg-transparent hover:bg-[var(--icon-bg-hover)]" onClick={back}>
          <Icon name="arrow-left" size="small" />
        </button>
        <img src={publicUrl(agent.avatar)} alt="" className="size-6" />
        <span className="text-14-medium text-text-strong">{agent.name}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-6 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <img src={publicUrl(agent.avatar)} alt="" className="size-14" />
              <span className="text-16-medium text-text-strong">{agent.name}</span>
              <span className="max-w-[480px] text-13-regular text-text-weak">{agent.desc}</span>
              <button
                type="button"
                className="mt-2 cursor-pointer rounded-[16px] border border-[var(--border-weak-base)] bg-transparent px-3 py-1.5 text-13-regular text-text-base hover:bg-[var(--icon-bg-hover)]"
                onClick={() => send(example)}
              >
                {example}
              </button>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="self-end max-w-[80%] rounded-[16px] bg-[var(--neutral-100)] px-4 py-2 text-14-regular text-text-strong">
                {m.text}
              </div>
            ) : (
              <div key={i} className="flex gap-2">
                <img src={publicUrl(agent.avatar)} alt="" className="size-7 shrink-0" />
                <div className="min-w-0 flex-1 text-14-regular">
                  <Markdown text={m.text} />
                </div>
              </div>
            ),
          )}
          {thinking && <span className="text-13-regular text-text-weak">正在思考…</span>}
          <div ref={bottom} />
        </div>
      </div>
      <div className="shrink-0 px-6 pb-6">
        <div className="mx-auto flex w-full max-w-[760px] items-end gap-2 rounded-[20px] border border-[var(--border-weak-base)] bg-[var(--surface-raised-stronger-non-alpha)] px-4 py-3">
          <textarea
            rows={2}
            value={input}
            placeholder={`给「${agent.name}」发消息`}
            className="flex-1 resize-none border-none bg-transparent text-14-regular text-text-strong outline-none"
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send(input)
              }
            }}
          />
          <button
            type="button"
            aria-label="发送"
            disabled={!input.trim() || thinking}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-[var(--brand-button-primary-base)] [color:#fff] disabled:cursor-default disabled:opacity-40"
            onClick={() => send(input)}
          >
            <Icon name="arrow-up" size="small" />
          </button>
        </div>
      </div>
    </div>
  )
}

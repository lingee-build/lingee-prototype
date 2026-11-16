import { useEffect, useMemo, useState } from "react"
import { BrandButton, Dialog, FileIcon, Icon, IconButton, Input, Markdown, SegmentedControl, Tooltip, useDialog } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { accounts } from "@/mock/fixtures/accounts"
import { trialResult, type TrialFile, type WfGraph, type WfNode } from "@/mock/fixtures/workflow-graphs"
import { useWorkflowDocs } from "@/stores/workflow-docs"
import { currentDisplayName } from "@/stores/auth"
import { currentRun, useWorkflowEditor, type RunRecord, type RunStep } from "./editor-store"
import { humanSteps, NODE_LABEL, toolName, validate, writeSteps, type Issue } from "./graph-ops"
import { Select } from "./fields"
import { assigneeLabel, HumanForm, missingFields } from "./node-config"
import { formatTokens, handleHumanTask, retryFailed, runTokens, startRun, stopRun } from "./trial-run"

/** 试运行时需要实例化的项：MCP 工具账号、引用智能体的版本、人工输入的实际办理人。都不进模板 */
interface Binding {
  key: string
  group: "tool" | "agent" | "handler"
  label: string
  desc: string
  options: Array<{ value: string; label: string; desc?: string }>
  recommended: string
}

const TOOL_ACCOUNTS = [
  { value: "sandbox", label: "沙箱账套（读写）", desc: "沙箱租户数据，写入不影响生产" },
  { value: "readonly", label: "华东区账套（只读）", desc: "只能读取，写操作会失败" },
]
const AGENT_VERSIONS = [
  { value: "online", label: "线上版本", desc: "已发布的稳定版本" },
  { value: "draft", label: "最新草稿", desc: "包含尚未发布的修改" },
]

function bindingsOf(graph: WfGraph): Binding[] {
  const list: Binding[] = []
  for (const node of graph.nodes)
    if (node.type === "tool" && node.config.mcpServer)
      list.push({ key: `mcp:${node.id}`, group: "tool", label: toolName(node), desc: `${node.config.write ? "写操作 · " : ""}用于「${node.title}」`, options: TOOL_ACCOUNTS, recommended: "sandbox" })
  const agents = new Set<string>()
  for (const n of graph.nodes) {
    if (n.type === "agent" && n.config.mode !== "single" && n.config.agentRef) agents.add(n.config.agentRef)
    for (const b of n.config.body ?? []) if (b.type === "agent" && b.ref) agents.add(b.ref)
  }
  for (const agent of agents) list.push({ key: `agent:${agent}`, group: "agent", label: agent, desc: "智能体版本", options: AGENT_VERSIONS, recommended: "online" })
  // 办理人：定义里是「发起人」时推荐当前用户；定义里是成员时推荐该成员；岗位由试运行时指定一位成员
  for (const node of humanSteps(graph)) {
    const options = accounts.slice(0, 6).map((a) => ({ value: a.displayName, label: a.displayName }))
    const defined = node.config.assignee
    const recommended = defined && options.some((o) => o.value === defined) ? defined : currentDisplayName() || accounts[0].displayName
    list.push({ key: `handler:${node.id}`, group: "handler", label: node.title, desc: `办理人 · ${assigneeLabel(defined)}`, options, recommended })
  }
  return list
}

const EMPTY: Record<string, string> = {}
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} 秒`
const timeOf = (ms: number) => new Date(ms).toTimeString().slice(0, 5)

/**
 * 右栏：试运行。「运行配置 → 输入 → 运行」在同一个面板里完成；运行中节点状态直接显示在画布上。
 * 运行在沙箱：写操作对沙箱真实写入，运行前汇总写操作与人工确认步骤数（方案 6.3）。
 */
export function TrialPanel(props: { workflowId: string; graph: WfGraph; onClose: () => void; onLocate: (issue: Issue | { nodeId: string }) => void; onFinished: (summary: string) => void }) {
  const t = useT()
  const dialog = useDialog()
  const runtime = useWorkflowDocs((s) => s.docs[props.workflowId]?.runtime ?? EMPTY)
  const setRuntime = useWorkflowDocs((s) => s.setRuntime)
  const runs = useWorkflowEditor((s) => s.runs)
  const run = useWorkflowEditor(currentRun)
  const bindings = useMemo(() => bindingsOf(props.graph), [props.graph])
  const missing = bindings.filter((b) => !runtime[b.key])
  const [configOpen, setConfigOpen] = useState(missing.length > 0)
  const start = props.graph.nodes.find((n) => n.type === "start")
  const params = start?.config.params ?? []
  const [inputs, setInputs] = useState<Record<string, string>>(() => Object.fromEntries(params.map((p) => [p.name, p.example])))
  const [tab, setTab] = useState("steps")
  const [form, setForm] = useState<Record<string, string>>({})
  const failedBinding = useMemo(() => bindingsOf(props.graph), [props.graph])
  const issues = validate(props.graph, "full")
  const missingInputs = params.filter((p) => p.required && !inputs[p.name]?.trim())
  const canStart = !issues.length && !missing.length && !missingInputs.length
  const live = run?.status === "running" || run?.status === "waiting" || run?.status === "failed"
  const waitingNode = run?.waitingNode ? props.graph.nodes.find((n) => n.id === run.waitingNode) : undefined
  const failedStep = run?.failedNode ? run.steps.find((s) => s.nodeId === run.failedNode) : undefined
  const handlerOf = (node: WfNode) => runtime[`handler:${node.id}`] || currentDisplayName()
  const result = trialResult(props.graph)
  const writes = writeSteps(props.graph).length
  const humans = humanSteps(props.graph).length

  useEffect(() => {
    if (run?.waitingNode) {
      setTab("todo")
      setForm({})
    }
  }, [run?.waitingNode])
  useEffect(() => {
    if (run?.status === "done") setTab("result")
  }, [run?.status])

  const begin = () => {
    setTab("steps")
    startRun({
      graph: props.graph,
      inputs,
      runtime: () => useWorkflowDocs.getState().docs[props.workflowId]?.runtime ?? {},
      handlerOf,
      onFinish: (finished) => {
        const ran = finished.steps.filter((s) => s.status === "done").length
        props.onFinished(`**试运行完成** · 沙箱环境 · 用时 ${seconds((finished.endedAt ?? Date.now()) - finished.startedAt)} · 执行 ${ran} 个步骤 · 消耗 ${formatTokens(runTokens(finished))} Token\n\n${result.summary}${result.files.length ? `\n\n运行产物：${result.files.map((f) => `\`${f.name}\``).join("、")}` : ""}`)
      },
    })
  }

  const group = (name: Binding["group"]) => bindings.filter((b) => b.group === name)
  const openFile = (file: TrialFile) => dialog.show(() => <FileDialog file={file} producer={props.graph.nodes.find((n) => n.id === file.producer)} onLocate={() => props.onLocate({ nodeId: file.producer })} />)

  return (
    <section className="workflow-side" aria-label={t("proto.wf.trial")}>
      <header className="workflow-side-head">
        <Icon name="test-flask" size="small" className="shrink-0 text-text-base" />
        <span className="min-w-0 flex-1 truncate text-[14px] font-[500] leading-[22px] text-text-strong">{t("proto.wf.trial")}</span>
        {runs.length > 0 && (
          <div className="w-[150px] shrink-0">
          <Select
            size="small"
            value={run?.id ?? "__new"}
            options={[{ value: "__new", label: t("proto.wf.trial.newRun") }, ...runs.map((r, i) => ({ value: r.id, label: `#${runs.length - i} · ${timeOf(r.startedAt)}`, desc: t(`proto.wf.trial.status.${r.status}`) }))]}
            onChange={(v) => useWorkflowEditor.getState().viewRun(v === "__new" ? undefined : v)}
          />
          </div>
        )}
        <Tooltip value={t("common.close")} placement="bottom" gutter={4}>
          <IconButton icon="close-small" variant="ghost" aria-label={t("common.close")} onClick={props.onClose} />
        </Tooltip>
      </header>

      <div className="workflow-side-body">
        {!run ? (
          <>
            {/* 1. 运行配置：首次需要逐项实例化，可一键使用推荐配置；全部配好后折叠成一行 */}
            <section className="workflow-section">
              <button type="button" className="workflow-section-head" aria-expanded={configOpen} onClick={() => setConfigOpen((x) => !x)}>
                <span className={cx("workflow-step-index", !missing.length && "is-done")}>{missing.length ? 1 : <Icon name="check-small" size="small" />}</span>
                <span className="flex-1 text-left text-[14px] font-[500] text-text-strong">{t("proto.wf.trial.config")}</span>
                <span className="text-[12px] text-[var(--text-weaker)]">{missing.length ? t("proto.wf.trial.configMissing", { count: missing.length }) : t("proto.wf.trial.configDone", { count: bindings.length })}</span>
                <Icon name="chevron-down-16" size="small" className={cx("text-text-weak transition-transform", configOpen && "rotate-180")} />
              </button>
              {configOpen && (
                <div className="flex flex-col gap-4 pt-1">
                  <div className="workflow-note">
                    <Icon name="info" size="small" />
                    {t("proto.wf.trial.configNote")}
                  </div>
                  {missing.length > 0 && (
                    <BrandButton variant="ghost" size="small" icon="lightning-charge" className="self-start" onClick={() => missing.forEach((b) => setRuntime(props.workflowId, b.key, b.recommended))}>
                      {t("proto.wf.trial.fillDefaults")}
                    </BrandButton>
                  )}
                  {(["tool", "agent", "handler"] as const).map(
                    (name) =>
                      group(name).length > 0 && (
                        <div key={name} className="flex flex-col gap-3">
                          <span className="text-[12px] leading-[18px] text-[var(--text-weaker)]">{t(`proto.wf.trial.group.${name}`)}</span>
                          {group(name).map((b) => (
                            <div key={b.key} className="flex flex-col gap-1.5">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="truncate text-[14px] leading-5 text-text-strong">{b.label}</span>
                                <span className="truncate text-[12px] text-[var(--text-weaker)]">{b.desc}</span>
                              </div>
                              <Select value={runtime[b.key] ?? ""} placeholder={t("proto.wf.trial.choose")} options={b.options} onChange={(v) => setRuntime(props.workflowId, b.key, v)} />
                            </div>
                          ))}
                        </div>
                      ),
                  )}
                  {!bindings.length && <span className="text-[13px] text-[var(--text-weaker)]">{t("proto.wf.trial.configNone")}</span>}
                </div>
              )}
            </section>

            {/* 2. 输入：按流程入参生成，必填为空不能开始 */}
            <section className="workflow-section">
              <div className="workflow-section-head is-static">
                <span className="workflow-step-index">2</span>
                <span className="flex-1 text-[14px] font-[500] text-text-strong">{t("proto.wf.trial.inputs")}</span>
              </div>
              <div className="flex flex-col gap-3 pt-1">
                {params.map((p) => (
                  <div key={p.name} className="flex flex-col gap-1">
                    <Input label={p.name} required={p.required} value={inputs[p.name] ?? ""} onChange={(x) => setInputs((s) => ({ ...s, [p.name]: x }))} error={p.required && !inputs[p.name]?.trim() ? t("proto.wf.trial.inputRequired", { name: p.name }) : undefined} />
                    {p.desc && <span className="text-[12px] leading-[18px] text-[var(--text-weaker)]">{p.desc}</span>}
                  </div>
                ))}
                {!params.length && <span className="text-[13px] text-[var(--text-weaker)]">{t("proto.wf.trial.noParams")}</span>}
              </div>
            </section>

            {/* 运行前确认：写操作与人工确认 */}
            <div className="workflow-note">
              <Icon name="shield-check" size="small" />
              {t("proto.wf.trial.sandbox", { writes, humans })}
            </div>

            {issues.length > 0 && (
              <section className="workflow-issues" role="alert">
                <span className="text-[13px] font-[500] text-[var(--danger-600,#e53535)]">{t("proto.wf.trial.issues", { count: issues.length })}</span>
                {issues.map((issue) => (
                  <button key={issue.message} type="button" className="workflow-issue" onClick={() => props.onLocate(issue)}>
                    <span className="truncate">{issue.message}</span>
                    {(issue.nodeId || issue.edgeId) && <span className="shrink-0 text-[var(--primary-600)]">{t("proto.wf.trial.locate")}</span>}
                  </button>
                ))}
              </section>
            )}
          </>
        ) : (
          <RunView
            run={run}
            failedBinding={failedStep ? failedBinding.find((b) => b.key === `mcp:${failedStep.nodeId}`) : undefined}
            runtime={runtime}
            onBind={(key, value) => setRuntime(props.workflowId, key, value)}
            graph={props.graph}
            tab={tab}
            setTab={setTab}
            waitingNode={waitingNode}
            failedStep={failedStep}
            handlerOf={handlerOf}
            form={form}
            setForm={setForm}
            result={result}
            onLocate={(nodeId) => props.onLocate({ nodeId })}
            onOpenFile={openFile}
          />
        )}
      </div>

      <footer className="workflow-side-foot">
        {live ? (
          <BrandButton variant="auxiliary" size="normal" onClick={stopRun}>
            {t("proto.wf.trial.stop")}
          </BrandButton>
        ) : run ? (
          <>
            <BrandButton variant="auxiliary" size="normal" onClick={() => useWorkflowEditor.getState().viewRun(undefined)}>
              {t("proto.wf.trial.edit")}
            </BrandButton>
            <BrandButton variant="primary" size="normal" icon="refresh" disabled={!canStart} onClick={begin}>
              {t("proto.wf.trial.again")}
            </BrandButton>
          </>
        ) : (
          <Tooltip value={missing.length ? t("proto.wf.trial.configMissing", { count: missing.length }) : missingInputs.length ? t("proto.wf.trial.inputsMissing") : issues.length ? t("proto.wf.trial.issues", { count: issues.length }) : ""} inactive={canStart} placement="top">
            <BrandButton variant="primary" size="normal" icon="play-triangle" disabled={!canStart} onClick={begin}>
              {t("proto.wf.trial.start")}
            </BrandButton>
          </Tooltip>
        )}
      </footer>
    </section>
  )
}

function RunView(props: {
  run: RunRecord
  failedBinding?: Binding
  runtime: Record<string, string>
  onBind: (key: string, value: string) => void
  graph: WfGraph
  tab: string
  setTab: (tab: string) => void
  waitingNode?: WfNode
  failedStep?: RunStep
  handlerOf: (node: WfNode) => string
  form: Record<string, string>
  setForm: (form: Record<string, string>) => void
  result: ReturnType<typeof trialResult>
  onLocate: (nodeId: string) => void
  onOpenFile: (file: TrialFile) => void
}) {
  const t = useT()
  const { run } = props
  const [open, setOpen] = useState<string>()
  const total = props.graph.nodes.length
  const done = run.steps.filter((s) => s.status === "done").length
  const missing = props.waitingNode ? missingFields(props.waitingNode, props.form) : []
  return (
    <>
      {/* 四格汇总（方案 6.4） */}
      <div className="workflow-stats">
        <span>
          <em>{t(`proto.wf.trial.status.${run.status}`)}</em>
          {t("proto.wf.trial.stat.status")}
        </span>
        <span>
          <em>{seconds((run.endedAt ?? Date.now()) - run.startedAt)}</em>
          {t("proto.wf.trial.stat.time")}
        </span>
        <span>
          <em>{formatTokens(runTokens(run))}</em>
          Token
        </span>
        <span>
          <em>
            {done}/{total}
          </em>
          {t("proto.wf.trial.stat.steps")}
        </span>
      </div>
      <p className="text-[12px] leading-[18px] text-[var(--text-weaker)]">{t("proto.wf.trial.sandboxTag")}</p>

      {props.failedStep && (
        <div className="workflow-issues" role="alert">
          <span className="text-[13px] font-[500] text-[var(--danger-600,#e53535)]">{t("proto.wf.trial.failedAt", { name: props.failedStep.title })}</span>
          <span className="text-[13px] text-text-base">{props.failedStep.output}</span>
          {props.failedStep.write && <span className="text-[12px] text-text-weak">{t("proto.wf.trial.idempotent")}</span>}
          {props.failedBinding && (
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-[12px] leading-[18px] text-text-weak">{t("proto.wf.trial.rebind", { name: props.failedBinding.label })}</span>
              <Select value={props.runtime[props.failedBinding.key] ?? ""} options={props.failedBinding.options} onChange={(v) => props.onBind(props.failedBinding!.key, v)} />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <BrandButton variant="primary" size="small" icon="refresh"
              onClick={() => {
                props.setTab("steps")
                retryFailed()
              }}
            >
              {t("proto.wf.trial.retry")}
            </BrandButton>
            <BrandButton variant="auxiliary" size="small" onClick={() => props.onLocate(props.failedStep!.nodeId)}>
              {t("proto.wf.trial.locate")}
            </BrandButton>
          </div>
          {props.failedStep.write && <span className="text-[12px] text-text-weak">{t("proto.wf.trial.retryHint")}</span>}
        </div>
      )}

      <SegmentedControl
        size="small"
        value={props.tab}
        onChange={props.setTab}
        items={[
          { value: "steps", label: t("proto.wf.trial.tab.steps") },
          { value: "result", label: t("proto.wf.trial.tab.result") },
          { value: "todo", label: props.waitingNode ? `${t("proto.wf.trial.tab.todo")} 1` : t("proto.wf.trial.tab.todo") },
        ]}
      />

      {props.tab === "steps" && (
        <ol className="workflow-run-steps">
          {run.steps.map((step) => {
            const node = props.graph.nodes.find((n) => n.id === step.nodeId)
            const expanded = open === step.nodeId
            return (
              <li key={step.nodeId} className={`is-${step.status}`}>
                <button type="button" onClick={() => setOpen(expanded ? undefined : step.nodeId)} aria-expanded={expanded}>
                  <span className="workflow-run-dot" />
                  <span className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] leading-5 text-text-strong">{step.title}</span>
                      <span className="shrink-0 text-[12px] text-[var(--text-weaker)]">{node ? NODE_LABEL[node.type] : ""}</span>
                      {step.write && <span className="workflow-node-badge is-write">{t("proto.wf.tool.writeShort")}</span>}
                      {(step.attempts ?? 1) > 1 && <span className="text-[12px] text-[var(--text-weaker)]">{t("proto.wf.trial.attempt", { count: step.attempts ?? 1 })}</span>}
                    </span>
                    {!expanded && step.output && <span className="truncate text-[12px] leading-[18px] text-text-weak">{step.output}</span>}
                  </span>
                  <span className="flex shrink-0 flex-col items-end text-[12px] leading-[18px] text-[var(--text-weaker)]">
                    <span>{step.status === "skipped" ? t("proto.wf.trial.skipped") : step.endedAt ? seconds(step.endedAt - step.startedAt) : ""}</span>
                    {!!step.tokens && <span>{formatTokens(step.tokens)} Token</span>}
                  </span>
                </button>
                {expanded && (
                  <div className="workflow-run-detail">
                    {!!step.input?.length && (
                      <>
                        <span className="workflow-run-detail-label">{t("proto.wf.trial.input")}</span>
                        {step.input.map(([k, v]) => (
                          <div key={k} className="flex gap-2 text-[12px] leading-[18px]">
                            <span className="shrink-0 text-text-weak">{k}</span>
                            <span className="min-w-0 break-all text-text-strong">{v || "—"}</span>
                          </div>
                        ))}
                      </>
                    )}
                    <span className="workflow-run-detail-label">{t("proto.wf.trial.output")}</span>
                    <span className="whitespace-pre-wrap break-all text-[12px] leading-[18px] text-text-strong">{step.output || "—"}</span>
                    {step.rounds && (
                      <>
                        <span className="workflow-run-detail-label">{t("proto.wf.trial.rounds", { count: step.rounds.length })}</span>
                        {step.rounds.map((r) => (
                          <div key={r.label} className="flex gap-2 text-[12px] leading-[18px]">
                            <span className={cx("shrink-0", r.status === "error" ? "text-[var(--danger-600,#e53535)]" : "text-text-weak")}>{r.label}</span>
                            <span className="min-w-0 text-text-strong">{r.output}</span>
                          </div>
                        ))}
                      </>
                    )}
                    <button type="button" className="workflow-link self-start" onClick={() => props.onLocate(step.nodeId)}>
                      {t("proto.wf.trial.locate")}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {props.tab === "result" &&
        (run.status === "done" ? (
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-2">
              <span className="text-[13px] font-[500] text-text-strong">{t("proto.wfn.result.business")}</span>
              <p className="text-[14px] leading-[22px] text-text-strong">{props.result.summary}</p>
              {!!run.result?.length && (
                <ul className="workflow-var-list">
                  {run.result.map(([k, v]) => (
                    <li key={k} className="!items-start">
                      <span className="!flex-none w-[88px] shrink-0 text-text-weak">{k}</span>
                      <span className="min-w-0 flex-1 break-all text-text-strong">{v}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="workflow-hint">{t("proto.wfn.result.businessHint")}</p>
            </section>
            <section className="flex flex-col gap-2">
              <span className="text-[13px] font-[500] text-text-strong">{t("proto.wfn.result.artifacts", { count: props.result.files.length })}</span>
              {props.result.files.map((file) => (
                <button key={file.name} type="button" className="workflow-file" onClick={() => props.onOpenFile(file)}>
                  <FileIcon node={{ path: file.name, type: "file" }} className="size-5 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="truncate text-[14px] leading-5 text-text-strong">{file.name}</span>
                    <span className="text-[12px] text-[var(--text-weaker)]">
                      {file.desc} · {t("proto.wf.trial.producer", { name: props.graph.nodes.find((n) => n.id === file.producer)?.title ?? "" })}
                    </span>
                  </span>
                  <Icon name="chevron-right-16" size="small" className="text-text-weak" />
                </button>
              ))}
              {!props.result.files.length && <p className="workflow-hint">{t("proto.wfn.files.none")}</p>}
            </section>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--text-weaker)]">{t("proto.wf.trial.resultPending")}</p>
        ))}

      {props.tab === "todo" &&
        (props.waitingNode ? (
          <div className="workflow-todo">
            <span className="text-[14px] font-[500] text-text-strong">{props.waitingNode.title}</span>
            <span className="text-[12px] text-[var(--text-weaker)]">{t("proto.wf.trial.handler", { name: props.handlerOf(props.waitingNode) })}</span>
            {props.waitingNode.config.guide && <p className="workflow-note">{props.waitingNode.config.guide}</p>}
            <HumanForm node={props.waitingNode} values={props.form} onChange={props.setForm} />
            <div className="flex flex-wrap justify-end gap-2">
              {(props.waitingNode.config.actions ?? []).map((action, i) => (
                <BrandButton key={action.id} variant={i === 0 ? "primary" : "auxiliary"} size="small" disabled={i === 0 && missing.length > 0} onClick={() => handleHumanTask({ ...props.form, __action: action.id })}>
                  {t("proto.wf.trial.simulate", { action: action.name })}
                </BrandButton>
              ))}
            </div>
            <span className="text-[12px] text-[var(--text-weaker)]">{t("proto.wf.trial.simulateHint")}</span>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--text-weaker)]">{t("proto.wf.trial.noTodo")}</p>
        ))}
    </>
  )
}

export function FileDialog(props: { file: TrialFile; producer?: WfNode; onLocate: () => void }) {
  const t = useT()
  const dialog = useDialog()
  const download = () => {
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([props.file.content], { type: "text/plain" }))
    a.download = props.file.name
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <Dialog fit title={props.file.name} className="w-[600px] max-w-[calc(100vw-32px)] !rounded-[24px] overflow-hidden">
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="max-h-[50vh] overflow-auto rounded-[16px] border border-[var(--border-weak-base)] p-4">
          <Markdown text={props.file.content} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-[var(--text-weaker)]">{props.producer ? t("proto.wf.trial.producer", { name: props.producer.title }) : ""}</span>
          <div className="flex gap-2">
            {props.producer && (
              <BrandButton
                variant="auxiliary"
                size="normal"
                onClick={() => {
                  dialog.close()
                  props.onLocate()
                }}
              >
                {t("proto.wf.trial.locateProducer")}
              </BrandButton>
            )}
            <BrandButton variant="primary" size="normal" icon="download" onClick={download}>
              {t("proto.wf.trial.download")}
            </BrandButton>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

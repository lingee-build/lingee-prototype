import { useState } from "react"
import { BrandButton, Dialog, Icon, IconButton, Input, Switch, useDialog } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { accounts } from "@/mock/fixtures/accounts"
import { devStore } from "@/mock/dev-store"
import { DEFAULT_BRANCH, LOOP_CMPS, newId, RULE_OPS, type WfFieldType, type WfFormField, type WfGraph, type WfLoopStep, type WfLoopVar, type WfNode, type WfNodeConfig, type WfParam, type WfRule } from "@/mock/fixtures/workflow-graphs"
import { addParallelBranch, appendToBranch, branchPath, joinOf, nextOptions, outletsOf, parallelOf, patchEdge, patchNode, refOptions, removeOutlet, removeParallelBranch, setNext } from "./graph-ops"
import { AddButton, Check, CodeField, FieldLabel, InlineText, ReadonlyField, RemoveButton, Section, Select, TextField, type SelectOption } from "./fields"

/* ---------- 可选能力（原型内置） ---------- */

const BASE_AGENTS = ["资料整理智能体", "经营分析智能体", "数据分析智能体", "报告撰写智能体", "风险分析智能体", "票据识别智能体", "费用审核智能体"]
const BASE_SKILLS = ["业务分析", "文档整理", "费用审核规范"]

/** MCP 服务与它提供的工具；write 表示调用会改变业务数据 */
export const MCP_SERVERS: Array<{ name: string; tools: Array<{ name: string; desc: string; write: boolean }> }> = [
  { name: "企业消息 MCP", tools: [{ name: "send_message", desc: "向成员或群组发送消息", write: true }, { name: "list_contacts", desc: "查询通讯录成员", write: false }] },
  { name: "ERP 费用报销 MCP", tools: [{ name: "submit_expense", desc: "提交报销单进入付款流程", write: true }, { name: "query_expense", desc: "查询报销单详情与状态", write: false }] },
  { name: "发票验真 MCP", tools: [{ name: "verify_invoice", desc: "校验发票真伪与重复报销", write: false }] },
  { name: "销售数据 MCP", tools: [{ name: "query_sales", desc: "按区域和周期查询销售明细", write: false }, { name: "export_report", desc: "导出报表到共享盘", write: true }] },
  { name: "邮件 MCP", tools: [{ name: "send_mail", desc: "发送邮件", write: true }] },
]

/**
 * 智能体候选：按编排层级约束排除已配置子智能体的智能体（方案 3.8：一次运行链路最多两个编排者）。
 * 返回值同时给出被排除的名称，供界面提示。
 */
export function agentOptions() {
  const local = devStore.agents.filter((a) => !a.subs?.length).map((a) => a.name)
  const excluded = devStore.agents.filter((a) => a.subs?.length).map((a) => a.name)
  return { options: [...new Set([...BASE_AGENTS, ...local])].map((x) => ({ value: x, label: x, desc: "已发布智能体" })), excluded }
}

const skillOptions = (): SelectOption[] => [...new Set([...BASE_SKILLS, ...devStore.skills.map((s) => s.displayName)])].map((x) => ({ value: x, label: x }))

/** 办理用户：发起人（默认）+ 成员；模板里存岗位名的也列出来 */
export function assigneeOptions(current?: string): SelectOption[] {
  const list: SelectOption[] = [{ value: "initiator", label: "发起人（默认）" }, ...accounts.slice(0, 6).map((a) => ({ value: a.displayName, label: a.displayName }))]
  if (current && !list.some((x) => x.value === current)) list.push({ value: current, label: current, desc: "岗位" })
  return list
}
export const assigneeLabel = (value?: string) => (!value || value === "initiator" ? "发起人" : value)

/** 节点是否在某条并行分支内（分支内的连接由并行节点维护） */
export function inParallelBranch(graph: WfGraph, nodeId: string) {
  return graph.nodes.some((p) => p.type === "parallel" && graph.edges.some((e) => e.source === p.id && branchPath(graph, e).nodes.some((n) => n.id === nodeId)))
}

export interface ConfigProps {
  graph: WfGraph
  node: WfNode
  /** 提交新的画布内容；what 是修改了什么，记入「画布有 N 处修改」 */
  commit: (graph: WfGraph, what: string, focus?: string) => void
}

const useConfig = (props: ConfigProps) => {
  const setConfig = (config: WfNodeConfig, what: string) => props.commit(patchNode(props.graph, props.node.id, { config }), what)
  return { c: props.node.config, setConfig }
}

/** 出口目标选择：未连接 + 可连接的节点 */
function TargetSelect(props: ConfigProps & { branch?: string; label?: string; size?: "small" | "normal"; invalid?: boolean }) {
  const t = useT()
  const current = props.graph.edges.find((e) => e.source === props.node.id && (props.branch === undefined ? !e.branch : e.branch === props.branch))
  const options = [{ value: "", label: t("proto.wfn.unconnected") }, ...nextOptions(props.graph, props.node.id).map((n) => ({ value: n.id, label: n.title }))]
  return (
    <Select
      label={props.label}
      size={props.size}
      value={current?.target ?? ""}
      options={options}
      invalid={props.invalid && !current}
      onChange={(target) => props.commit(setNext(props.graph, props.node.id, props.branch, target), props.label ?? t("proto.wfn.next"))}
    />
  )
}

/** 节点配置顶部的「后续节点」：每个出口一个目标下拉 */
export function NextSection(props: ConfigProps) {
  const t = useT()
  if (props.node.type === "end") return null
  if (props.node.type === "parallel" || inParallelBranch(props.graph, props.node.id)) return <p className="workflow-note">{t("proto.wfn.parallelManaged")}</p>
  const outlets = outletsOf(props.graph, props.node)
  if (!outlets.length) return null
  return (
    <Section title={t("proto.wfn.nextNodes")}>
      {outlets.map((o) => (
        <div key={o.id ?? "next"} className="workflow-outlet">
          <span className="truncate text-[13px] text-text-weak">{o.label}</span>
          <div className="min-w-0 flex-1">
            <TargetSelect {...props} branch={o.id} size="small" invalid />
          </div>
        </div>
      ))}
    </Section>
  )
}

/* ---------- 开始 ---------- */

const PARAM_TYPES: WfParam["type"][] = ["string", "number", "boolean", "object", "file"]

export function StartConfig(props: ConfigProps) {
  const t = useT()
  const { c, setConfig } = useConfig(props)
  const params = c.params ?? []
  const set = (i: number, patch: Partial<WfParam>) => setConfig({ params: params.map((p, j) => (j === i ? { ...p, ...patch } : p)) }, t("proto.wfn.start.params"))
  const launch = c.launch ?? "form"
  return (
    <>
      <div className="flex flex-col gap-2">
        <FieldLabel>{t("proto.wfn.start.launch")}</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          {(["form", "agent"] as const).map((x) => (
            <button key={x} type="button" className={cx("workflow-choice", launch === x && "is-active")} onClick={() => setConfig({ launch: x }, t("proto.wfn.start.launch"))}>
              <span className="text-[14px] font-[500] text-text-strong">{t(`proto.wfn.start.launch.${x}`)}</span>
              <span className="text-[12px] leading-[18px] text-text-weak">{t(`proto.wfn.start.launch.${x}Desc`)}</span>
            </button>
          ))}
        </div>
        <p className="workflow-hint">{t("proto.wfn.start.launchHint")}</p>
      </div>
      <Section title={t("proto.wfn.start.params")}>
        <div className="workflow-table">
          <div className="workflow-table-row is-head">
            <span>{t("proto.wfn.start.col.name")}</span>
            <span>{t("proto.wfn.start.col.type")}</span>
            <span>{t("proto.wfn.start.col.default")}</span>
            <span className="text-center">{t("proto.wfn.start.col.required")}</span>
            <span />
          </div>
          {params.map((p, i) => (
            <div key={i} className="workflow-table-group">
              <div className="workflow-table-row">
                <InlineText value={p.name} ariaLabel={t("proto.wfn.start.col.name")} onCommit={(name) => name.trim() && set(i, { name: name.trim() })} />
                <Select size="small" value={p.type} options={PARAM_TYPES.map((x) => ({ value: x, label: x }))} onChange={(type) => set(i, { type: type as WfParam["type"] })} />
                <InlineText value={p.example} ariaLabel={t("proto.wfn.start.col.default")} onCommit={(example) => set(i, { example })} />
                <span className="flex justify-center">
                  <input type="checkbox" className="accent-[var(--primary-600)]" aria-label={`${p.name}${t("proto.wfn.start.col.required")}`} checked={p.required} onChange={(e) => set(i, { required: e.currentTarget.checked })} />
                </span>
                <RemoveButton label={t("proto.wf.remove")} onClick={() => setConfig({ params: params.filter((_, j) => j !== i) }, t("proto.wfn.start.params"))} />
              </div>
              <InlineText value={p.desc} placeholder={t("proto.wfn.start.descPlaceholder")} className={p.required && !p.desc ? "is-invalid" : undefined} onCommit={(desc) => set(i, { desc })} />
            </div>
          ))}
        </div>
        <AddButton label={t("proto.wfn.start.addParam")} onClick={() => setConfig({ params: [...params, { name: `字段${params.length + 1}`, type: "string", example: "", required: false, desc: "" }] }, t("proto.wfn.start.params"))} />
        <p className="workflow-hint">{t("proto.wfn.start.paramsHint")}</p>
      </Section>
    </>
  )
}

/* ---------- 智能体 ---------- */

export function AgentConfig(props: ConfigProps) {
  const t = useT()
  const { c, setConfig } = useConfig(props)
  const agents = agentOptions()
  const single = c.mode === "single"
  const candidates = c.candidates ?? []

  // 打开「依据处理意图选择下一步」：原来的下一步变成第一个候选出口；关闭时保留第一个候选的连线
  const toggleIntent = (on: boolean) => {
    const { graph, node } = props
    if (on) {
      const id = newId("cand")
      const edges = graph.edges.map((e) => (e.source === node.id && !e.branch ? { ...e, branch: id } : e))
      props.commit(patchNode({ ...graph, edges }, node.id, { config: { intent: true, candidates: [{ id, guide: "" }] } }), t("proto.wfn.agent.intent"))
    } else {
      const keep = graph.edges.find((e) => e.source === node.id && e.branch === candidates[0]?.id)
      const edges = graph.edges.filter((e) => e.source !== node.id || e === keep).map((e) => (e === keep ? { ...e, branch: undefined } : e))
      props.commit(patchNode({ ...graph, edges }, node.id, { config: { intent: false, candidates: [] } }), t("proto.wfn.agent.intent"))
    }
  }

  return (
    <>
      <Select
        label={t("proto.wfn.agent.mode")}
        value={c.mode ?? "agent"}
        options={[
          { value: "agent", label: t("proto.wf.mode.agent") },
          { value: "single", label: t("proto.wf.mode.single") },
        ]}
        onChange={(mode) => setConfig({ mode: mode as "agent" | "single" }, t("proto.wfn.agent.mode"))}
      />
      <p className="workflow-hint -mt-2">{t("proto.wfn.agent.singleHint")}</p>
      {single ? (
        <p className="workflow-note">{t("proto.wfn.agent.singleNote")}</p>
      ) : (
        <>
          <Select label={t("proto.wfn.agent.agent")} required value={c.agentRef ?? ""} placeholder={t("proto.wfn.agent.agentPlaceholder")} options={agents.options} onChange={(agentRef) => setConfig({ agentRef }, t("proto.wfn.agent.agent"))} invalid={!c.agentRef} />
          {agents.excluded.length > 0 && <p className="workflow-hint -mt-2">{t("proto.wf.field.agentExcluded", { names: agents.excluded.join("、") })}</p>}
          <Select label={t("proto.wfn.agent.skill")} value={c.skillRef ?? ""} options={[{ value: "", label: t("proto.wfn.agent.noSkill") }, ...skillOptions()]} onChange={(skillRef) => setConfig({ skillRef }, t("proto.wfn.agent.skill"))} />
        </>
      )}
      <TextField label={t("proto.wfn.agent.instruction")} multiline value={c.instruction ?? ""} onCommit={(instruction) => setConfig({ instruction }, t("proto.wfn.agent.instruction"))} />
      <Check label={t("proto.wfn.agent.intent")} checked={!!c.intent} onChange={toggleIntent} />
      {c.intent && (
        <div className="flex flex-col gap-2">
          {candidates.map((x, i) => (
            <div key={x.id} className="workflow-card">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-text-weak">{t("proto.wfn.agent.target")}</span>
                <div className="min-w-0 flex-1">
                  <TargetSelect {...props} branch={x.id} size="small" invalid />
                </div>
                <RemoveButton label={t("proto.wf.remove")} disabled={candidates.length <= 1} onClick={() => props.commit(removeOutlet(props.graph, props.node.id, x.id, { candidates: candidates.filter((_, j) => j !== i) }), t("proto.wfn.agent.intent"))} />
              </div>
              <InlineText value={x.guide} placeholder={t("proto.wfn.agent.guide")} onCommit={(guide) => setConfig({ candidates: candidates.map((y, j) => (j === i ? { ...y, guide } : y)) }, t("proto.wfn.agent.guide"))} />
            </div>
          ))}
          <AddButton label={t("proto.wfn.agent.addCandidate")} onClick={() => setConfig({ candidates: [...candidates, { id: newId("cand"), guide: "" }] }, t("proto.wfn.agent.intent"))} />
        </div>
      )}
    </>
  )
}

/* ---------- MCP 工具 ---------- */

export function ToolConfig(props: ConfigProps) {
  const t = useT()
  const { c, setConfig } = useConfig(props)
  const server = MCP_SERVERS.find((s) => s.name === c.mcpServer)
  const tool = server?.tools.find((x) => x.name === c.mcpTool)
  return (
    <>
      <Select
        label={t("proto.wfn.tool.server")}
        required
        value={c.mcpServer ?? ""}
        placeholder={t("proto.wfn.tool.serverPlaceholder")}
        options={MCP_SERVERS.map((s) => ({ value: s.name, label: s.name, desc: t("proto.wfn.tool.toolCount", { count: s.tools.length }) }))}
        onChange={(mcpServer) => setConfig({ mcpServer, mcpTool: "" }, t("proto.wfn.tool.server"))}
        invalid={!c.mcpServer}
      />
      <Select
        label={t("proto.wfn.tool.tool")}
        required
        value={c.mcpTool ?? ""}
        placeholder={server ? t("proto.wfn.tool.toolPlaceholder") : t("proto.wfn.tool.chooseServerFirst")}
        options={(server?.tools ?? []).map((x) => ({ value: x.name, label: x.name, desc: x.desc }))}
        disabled={!server}
        onChange={(mcpTool) => setConfig({ mcpTool, write: server?.tools.find((x) => x.name === mcpTool)?.write ?? false }, t("proto.wfn.tool.tool"))}
        invalid={!!server && !c.mcpTool}
      />
      {tool && <p className="workflow-hint -mt-2">{tool.desc}</p>}
      <div className="workflow-switch-row">
        <span className="flex min-w-0 flex-col">
          <span className="text-[14px] leading-5 text-text-strong">{t("proto.wf.tool.write")}</span>
          <span className="text-[12px] leading-[18px] text-[var(--text-weaker)]">{t("proto.wf.tool.writeHint")}</span>
        </span>
        <Switch checked={!!c.write} onChange={(write) => setConfig({ write }, t("proto.wf.tool.write"))} hideLabel>
          {t("proto.wf.tool.write")}
        </Switch>
      </div>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>{t("proto.wfn.code.timeout")}</FieldLabel>
        <InlineText className="is-short" type="number" value={c.timeout ?? "30"} onCommit={(v) => setConfig({ timeout: v.replace(/\D/g, "") || "30" }, t("proto.wfn.code.timeout"))} />
      </div>
      <p className="workflow-hint">{t("proto.wfn.tool.paramsHint")}</p>
    </>
  )
}

/* ---------- 代码 ---------- */

export function CodeConfig(props: ConfigProps) {
  const t = useT()
  const { c, setConfig } = useConfig(props)
  return (
    <>
      <ReadonlyField label={t("proto.wfn.code.language")} value={c.language ?? "Python"} />
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>{t("proto.wfn.code.timeout")}</FieldLabel>
        <InlineText className="is-short" type="number" value={c.timeout ?? "30"} onCommit={(v) => setConfig({ timeout: v.replace(/\D/g, "") || "30" }, t("proto.wfn.code.timeout"))} />
      </div>
      <TextField label={t("proto.wfn.code.desc")} multiline value={c.codeDesc ?? ""} onCommit={(codeDesc) => setConfig({ codeDesc }, t("proto.wfn.code.desc"))} />
      <CodeField label={t("proto.wfn.code.code")} value={c.code ?? ""} onCommit={(code) => setConfig({ code }, t("proto.wfn.code.code"))} hint={t("proto.wfn.code.codeHint")} />
      <div className="flex flex-col gap-2">
        <FieldLabel>{t("proto.wfn.code.outputs")}</FieldLabel>
        <ul className="workflow-var-list">
          <li className="is-head">
            <span>{t("proto.wfn.io.outputName")}</span>
            <span>{t("proto.wfn.start.col.type")}</span>
          </li>
          {(c.outputs ?? []).map((o) => (
            <li key={o.name}>
              <span className="truncate font-mono text-text-strong">{o.name}</span>
              <span className="text-[var(--text-weaker)]">{o.type}</span>
            </li>
          ))}
        </ul>
        <p className="workflow-hint">{t("proto.wfn.code.outputsHint")}</p>
      </div>
    </>
  )
}

/* ---------- 条件 ---------- */

export function ConditionConfig(props: ConfigProps) {
  const t = useT()
  const { c, setConfig } = useConfig(props)
  const branches = c.branches ?? []
  const refs = refOptions(props.graph, props.node.id)
  const what = t("proto.wfn.cond.branches")
  const setBranch = (i: number, patch: Partial<(typeof branches)[number]>) => setConfig({ branches: branches.map((b, j) => (j === i ? { ...b, ...patch } : b)) }, what)
  const move = (i: number) => {
    const next = [...branches]
    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
    setConfig({ branches: next }, what)
  }
  return (
    <>
      <Section title={t("proto.wfn.cond.branches")}>
        {branches.map((b, i) => (
          <div key={b.id} className="workflow-card is-branch">
            <div className="flex items-center gap-1">
              <span className="flex-1 text-[13px] font-[500] text-text-strong">{t("proto.wfn.cond.if", { index: i + 1 })}</span>
              <IconButton icon="chevron-up" variant="ghost" size="small" aria-label={t("proto.wf.moveUp")} disabled={i === 0} onClick={() => move(i)} />
              <RemoveButton label={t("proto.wf.remove")} onClick={() => props.commit(removeOutlet(props.graph, props.node.id, b.id, { branches: branches.filter((_, j) => j !== i) }), what)} />
            </div>
            <div className="workflow-field-row">
              <span>{t("proto.wfn.cond.name")}</span>
              <InlineText value={b.label} onCommit={(label) => label.trim() && setBranch(i, { label: label.trim() })} />
            </div>
            <div className="workflow-field-row">
              <span>{t("proto.wfn.cond.logic")}</span>
              <Select
                size="small"
                value={b.logic}
                options={[
                  { value: "and", label: t("proto.wfn.cond.all") },
                  { value: "or", label: t("proto.wfn.cond.any") },
                ]}
                onChange={(logic) => setBranch(i, { logic: logic as "and" | "or" })}
              />
            </div>
            {b.rules.map((r, k) => (
              <RuleRow
                key={k}
                refs={refs}
                rule={r}
                onChange={(rule) => setBranch(i, { rules: b.rules.map((x, j) => (j === k ? rule : x)) })}
                onRemove={b.rules.length > 1 ? () => setBranch(i, { rules: b.rules.filter((_, j) => j !== k) }) : undefined}
              />
            ))}
            <AddButton label={t("proto.wfn.cond.addRule")} onClick={() => setBranch(i, { rules: [...b.rules, { left: "", op: "is", right: "" }] })} />
            <div className="workflow-field-row">
              <span>{t("proto.wfn.cond.goto")}</span>
              <TargetSelect {...props} branch={b.id} size="small" invalid />
            </div>
          </div>
        ))}
        <AddButton label={t("proto.wfn.cond.addBranch")} onClick={() => setConfig({ branches: [...branches, { id: newId("br"), label: `分支 ${branches.length + 1}`, logic: "and", rules: [{ left: "", op: "is", right: "" }] }] }, what)} />
      </Section>
      <Section title={t("proto.wfn.cond.default")}>
        <TargetSelect {...props} branch={DEFAULT_BRANCH} invalid />
        <p className="workflow-hint">{t("proto.wfn.cond.defaultHint")}</p>
      </Section>
    </>
  )
}

/** 一条条件：取值来源 + 比较方式 + 比较值 */
export function RuleRow(props: { refs: SelectOption[]; rule: WfRule; onChange: (rule: WfRule) => void; onRemove?: () => void }) {
  const t = useT()
  return (
    <div className="workflow-rule">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Select size="small" value={props.rule.left} placeholder={t("proto.wfn.cond.source")} options={props.refs} onChange={(left) => props.onChange({ ...props.rule, left })} invalid={!props.rule.left} />
        </div>
        {props.onRemove && <RemoveButton label={t("proto.wfn.cond.removeRule")} onClick={props.onRemove} />}
      </div>
      <div className="flex items-center gap-2">
        <div className="w-[84px] shrink-0">
          <Select size="small" value={props.rule.op} options={RULE_OPS.map((x) => ({ value: x.value, label: x.label }))} onChange={(op) => props.onChange({ ...props.rule, op: op as WfRule["op"] })} />
        </div>
        <InlineText className="flex-1" value={props.rule.right} placeholder={t("proto.wfn.cond.value")} onCommit={(right) => props.onChange({ ...props.rule, right })} />
      </div>
    </div>
  )
}

/* ---------- 并行 / 并行汇入 ---------- */

export function ParallelConfig(props: ConfigProps) {
  const t = useT()
  const branches = props.graph.edges.filter((e) => e.source === props.node.id)
  const join = joinOf(props.graph, props.node.id)
  const what = t("proto.wfn.par.branches")
  const add = (edgeId: string, type: "agent" | "code") => {
    const r = appendToBranch(props.graph, edgeId, type)
    if (r) props.commit(r.graph, what, r.node.id)
  }
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>{t("proto.wfn.par.count", { count: branches.length })}</FieldLabel>
        <div className="flex items-center gap-1">
          <AddButton
            icon="dash"
            label={t("proto.wfn.par.less")}
            disabled={branches.length <= 2}
            onClick={() => {
              const next = removeParallelBranch(props.graph, props.node.id)
              if (next) props.commit(next, what)
            }}
          />
          <AddButton
            label={t("proto.wfn.par.more")}
            disabled={!join}
            onClick={() => {
              const r = addParallelBranch(props.graph, props.node.id)
              if (r) props.commit(r.graph, what, r.node.id)
            }}
          />
        </div>
      </div>
      {branches.map((e) => {
        const path = branchPath(props.graph, e)
        return (
          <div key={e.id} className="workflow-card">
            <InlineText className="font-[500]" value={e.label ?? ""} ariaLabel={t("proto.wfn.par.branchName")} onCommit={(label) => label.trim() && props.commit(patchEdge(props.graph, e.id, { label: label.trim() }), what)} />
            <div className="flex flex-wrap gap-1.5">
              {path.nodes.map((n) => (
                <span key={n.id} className="workflow-chip">
                  {n.title}
                </span>
              ))}
              {!path.nodes.length && <span className="workflow-hint">{t("proto.wfn.par.emptyBranch")}</span>}
            </div>
            <div className="flex gap-1">
              <AddButton label={t("proto.wfn.par.addAgent")} disabled={!path.join} onClick={() => add(e.id, "agent")} />
              <AddButton label={t("proto.wfn.par.addCode")} disabled={!path.join} onClick={() => add(e.id, "code")} />
            </div>
          </div>
        )
      })}
      <Section title={t("proto.wfn.par.closing")}>
        {branches.map((e, i) => (
          <div key={e.id} className="workflow-field-row">
            <span>{t("proto.wfn.par.branchN", { index: i + 1 })}</span>
            <div className="workflow-readonly">{branchPath(props.graph, e).nodes[0]?.title ?? "—"}</div>
          </div>
        ))}
        <ReadonlyField label={t("proto.wfn.par.join")} value={join?.title ?? t("proto.wfn.par.noJoin")} />
        <ReadonlyField label={t("proto.wfn.par.policy")} value={t("proto.wfn.par.policyAll")} />
        <p className="workflow-hint">{t("proto.wfn.par.hint")}</p>
      </Section>
    </>
  )
}

export function JoinConfig(props: ConfigProps) {
  const t = useT()
  const parallel = parallelOf(props.graph, props.node.id)
  const branches = parallel ? props.graph.edges.filter((e) => e.source === parallel.id) : []
  return (
    <>
      <ReadonlyField label={t("proto.wfn.join.owner")} value={parallel?.title ?? t("proto.wfn.join.noOwner")} />
      <div className="flex flex-col gap-2">
        <FieldLabel>{t("proto.wfn.join.waits")}</FieldLabel>
        <ul className="workflow-var-list">
          <li className="is-head">
            <span>{t("proto.wfn.join.branch")}</span>
            <span>{t("proto.wfn.join.require")}</span>
          </li>
          {branches.map((e) => (
            <li key={e.id}>
              <span className="truncate text-text-strong">{e.label}</span>
              <span className="text-[var(--text-weaker)]">{t("proto.wfn.join.mustSucceed")}</span>
            </li>
          ))}
        </ul>
        <p className="workflow-hint">{t("proto.wfn.join.hint")}</p>
      </div>
    </>
  )
}

/* ---------- 人工输入 ---------- */

const FIELD_TYPES: WfFieldType[] = ["text", "textarea", "number", "checkbox", "radio", "multi", "group", "table"]

export function HumanConfig(props: ConfigProps) {
  const t = useT()
  const dialog = useDialog()
  const { c, setConfig } = useConfig(props)
  const fields = c.fields ?? []
  const actions = c.actions ?? []
  const html = c.render === "html"
  const setFields = (next: WfFormField[]) => setConfig({ fields: next }, t("proto.wfn.human.form"))
  const what = t("proto.wfn.human.actions")
  return (
    <>
      <Check label={t("proto.wfn.human.multi")} checked={!!c.multi} onChange={(multi) => setConfig({ multi, handleMode: multi ? (c.handleMode === "single" ? "parallel" : c.handleMode) : "single" }, t("proto.wfn.human.multi"))} />
      <Select
        label={t("proto.wfn.human.mode")}
        value={c.handleMode ?? "single"}
        disabled={!c.multi}
        options={(["single", "parallel", "sequential"] as const).map((x) => ({ value: x, label: t(`proto.wfn.human.mode.${x}`) }))}
        onChange={(handleMode) => setConfig({ handleMode: handleMode as "single" | "parallel" | "sequential" }, t("proto.wfn.human.mode"))}
      />
      <p className="workflow-hint -mt-2">{t("proto.wfn.human.modeHint")}</p>
      <Select label={t("proto.wfn.human.assignee")} value={c.assignee ?? "initiator"} options={assigneeOptions(c.assignee)} onChange={(assignee) => setConfig({ assignee }, t("proto.wfn.human.assignee"))} />
      <p className="workflow-hint -mt-2">{t("proto.wfn.human.assigneeHint")}</p>
      <TextField label={t("proto.wfn.human.guide")} multiline value={c.guide ?? ""} onCommit={(guide) => setConfig({ guide }, t("proto.wfn.human.guide"))} />

      <Section title={t("proto.wfn.human.render")}>
        <Select
          label={t("proto.wfn.human.renderMode")}
          value={c.render ?? "form"}
          options={[
            { value: "form", label: t("proto.wfn.human.render.form") },
            { value: "html", label: t("proto.wfn.human.render.html") },
          ]}
          onChange={(render) => setConfig({ render: render as "form" | "html" }, t("proto.wfn.human.render"))}
        />
        {html ? (
          <div className="flex flex-col gap-2">
            <div className="workflow-field-row">
              <span>HTML</span>
              <div className="flex min-w-0 flex-col">
                <InlineText value={c.htmlFile ?? ""} onCommit={(htmlFile) => setConfig({ htmlFile }, "HTML")} />
                <span className="workflow-hint">{t("proto.wfn.human.htmlDesc")}</span>
              </div>
            </div>
            <div className="workflow-field-row">
              <span>CSS</span>
              <div className="flex min-w-0 flex-col">
                <InlineText value={c.cssFile ?? ""} onCommit={(cssFile) => setConfig({ cssFile }, "CSS")} />
                <span className="workflow-hint">{t("proto.wfn.human.cssDesc")}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BrandButton variant="auxiliary" size="small" icon="eye" onClick={() => dialog.show(() => <FormPreview node={props.node} />)}>
                {t("proto.wfn.human.editPreview")}
              </BrandButton>
              <span className="workflow-chip is-success">{t("proto.wfn.human.bound")}</span>
            </div>
            <p className="workflow-hint">{t("proto.wfn.human.htmlHint")}</p>
          </div>
        ) : (
          <p className="workflow-hint">{t("proto.wfn.human.formHint")}</p>
        )}
      </Section>

      <Section title={t("proto.wfn.human.form")}>
        {fields.map((f, i) => (
          <FieldCard key={i} field={f} onChange={(next) => setFields(fields.map((x, j) => (j === i ? next : x)))} onRemove={() => setFields(fields.filter((_, j) => j !== i))} />
        ))}
        <div className="flex items-center gap-1">
          <AddButton label={t("proto.wfn.human.addField")} onClick={() => setFields([...fields, { key: `field_${fields.length + 1}`, label: `字段 ${fields.length + 1}`, type: "text", editable: true, required: false }])} />
          <button type="button" className="workflow-add" onClick={() => dialog.show(() => <FormPreview node={props.node} />)}>
            <Icon name="eye" size="small" />
            {t("proto.wfn.human.preview")}
          </button>
        </div>
        <p className="workflow-hint">{t("proto.wfn.human.formContract")}</p>
      </Section>

      <Section title={t("proto.wfn.human.actions")}>
        {actions.map((a, i) => (
          <div key={a.id} className="workflow-card">
            <div className="workflow-field-row">
              <span>{t("proto.wfn.human.actionName")}</span>
              <div className="flex items-center gap-1">
                <InlineText value={a.name} onCommit={(name) => name.trim() && setConfig({ actions: actions.map((x, j) => (j === i ? { ...x, name: name.trim() } : x)) }, what)} />
                <RemoveButton label={t("proto.wf.remove")} disabled={actions.length <= 1} onClick={() => props.commit(removeOutlet(props.graph, props.node.id, a.id, { actions: actions.filter((_, j) => j !== i) }), what)} />
              </div>
            </div>
            <div className="workflow-field-row">
              <span>{t("proto.wfn.human.goto")}</span>
              <TargetSelect {...props} branch={a.id} size="small" invalid />
            </div>
          </div>
        ))}
        <AddButton label={t("proto.wfn.human.addAction")} onClick={() => setConfig({ actions: [...actions, { id: newId("act"), name: `动作 ${actions.length + 1}` }] }, what)} />
      </Section>

      <Section title={t("proto.wfn.human.deadline")}>
        <div className="flex items-center gap-2">
          <InlineText className="is-short" type="number" value={c.deadline ?? "0"} ariaLabel={t("proto.wfn.human.deadline")} onCommit={(v) => setConfig({ deadline: v.replace(/\D/g, "") || "0" }, t("proto.wfn.human.deadline"))} />
          <div className="w-[96px]">
            <Select size="small" value={c.deadlineUnit ?? "h"} options={(["s", "m", "h", "d"] as const).map((x) => ({ value: x, label: t(`proto.wfn.human.unit.${x}`) }))} onChange={(deadlineUnit) => setConfig({ deadlineUnit: deadlineUnit as "s" | "m" | "h" | "d" }, t("proto.wfn.human.deadline"))} />
          </div>
        </div>
        <p className="workflow-hint">{t("proto.wfn.human.deadlineHint")}</p>
      </Section>
    </>
  )
}

/** 一个表单字段；对象分组 / 明细表可以再加一层子字段（明细表内不再嵌明细表） */
function FieldCard(props: { field: WfFormField; onChange: (field: WfFormField) => void; onRemove: () => void; nested?: "group" | "table" }) {
  const t = useT()
  const f = props.field
  const set = (patch: Partial<WfFormField>) => props.onChange({ ...f, ...patch })
  const types = FIELD_TYPES.filter((x) => (props.nested ? x !== "table" && x !== "group" : true))
  const children = f.children ?? []
  return (
    <div className={cx("workflow-card", props.nested && "is-nested")}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-[500] text-text-strong">{f.label}</span>
        <span className="text-[12px] text-[var(--text-weaker)]">{t(`proto.wfn.fieldType.${f.type}`)}</span>
        <RemoveButton label={t("proto.wf.remove")} onClick={props.onRemove} />
      </div>
      <div className="workflow-field-row">
        <span>{t("proto.wfn.field.key")}</span>
        <InlineText className="font-mono" value={f.key} onCommit={(key) => key.trim() && set({ key: key.trim() })} />
      </div>
      <div className="workflow-field-row">
        <span>{t("proto.wfn.field.label")}</span>
        <InlineText value={f.label} onCommit={(label) => label.trim() && set({ label: label.trim() })} />
      </div>
      <div className="workflow-field-row">
        <span>{t("proto.wfn.field.type")}</span>
        <Select size="small" value={f.type} options={types.map((x) => ({ value: x, label: t(`proto.wfn.fieldType.${x}`) }))} onChange={(type) => set({ type: type as WfFieldType, options: type === "radio" || type === "multi" ? (f.options ?? ["选项1", "选项2"]) : undefined, children: type === "group" || type === "table" ? (f.children ?? []) : undefined })} />
      </div>
      <div className="workflow-field-row">
        <span>{t("proto.wfn.field.edit")}</span>
        <Select
          size="small"
          value={f.editable ? "edit" : "read"}
          options={[
            { value: "edit", label: t("proto.wfn.field.editable") },
            { value: "read", label: t("proto.wfn.field.readonly") },
          ]}
          onChange={(v) => set({ editable: v === "edit" })}
        />
      </div>
      {(f.type === "radio" || f.type === "multi") && (
        <div className="workflow-field-row">
          <span>{t("proto.wfn.field.options")}</span>
          <InlineText value={(f.options ?? []).join("，")} onCommit={(v) => set({ options: v.split(/[,，]/).map((x) => x.trim()).filter(Boolean) })} />
        </div>
      )}
      <div className="flex items-center gap-4 pl-[84px]">
        <Check label={t("proto.wf.field.required")} checked={f.required} onChange={(required) => set({ required })} />
        {f.type === "checkbox" && <Check label={t("proto.wfn.field.mustCheck")} checked={!!f.mustCheck} onChange={(mustCheck) => set({ mustCheck })} />}
      </div>
      <div className="workflow-field-row">
        <span>{t("proto.wfn.field.hint")}</span>
        <InlineText value={f.hint ?? ""} onCommit={(hint) => set({ hint })} />
      </div>
      {(f.type === "group" || f.type === "table") && (
        <div className="flex flex-col gap-2 pl-2">
          <FieldLabel>{f.type === "group" ? t("proto.wfn.field.groupChildren") : t("proto.wfn.field.tableChildren")}</FieldLabel>
          {children.map((child, i) => (
            <FieldCard key={i} nested={f.type === "group" ? "group" : "table"} field={child} onChange={(next) => set({ children: children.map((x, j) => (j === i ? next : x)) })} onRemove={() => set({ children: children.filter((_, j) => j !== i) })} />
          ))}
          <AddButton label={t("proto.wfn.field.addChild")} onClick={() => set({ children: [...children, { key: `item_${children.length + 1}`, label: `子字段 ${children.length + 1}`, type: "text", editable: true, required: false }] })} />
        </div>
      )}
    </div>
  )
}

/** 表单预览：办理人在待办里看到的样子 */
export function FormPreview(props: { node: WfNode }) {
  const t = useT()
  const [values, setValues] = useState<Record<string, string>>({})
  return (
    <Dialog fit title={t("proto.wf.field.previewTitle", { name: props.node.title })} className="w-[520px] max-w-[calc(100vw-32px)] !rounded-[24px] overflow-hidden">
      <div className="flex max-h-[72vh] flex-col gap-4 overflow-y-auto px-6 pb-6">
        {props.node.config.guide && <p className="workflow-note">{props.node.config.guide}</p>}
        <HumanForm node={props.node} values={values} onChange={setValues} />
        <div className="flex justify-end gap-2">
          {(props.node.config.actions ?? []).map((a, i) => (
            <BrandButton key={a.id} variant={i === 0 ? "primary" : "auxiliary"} size="normal" disabled>
              {a.name}
            </BrandButton>
          ))}
        </div>
      </div>
    </Dialog>
  )
}

/** 表单里还没填的必填项（只算可填写的字段） */
export function missingFields(node: WfNode, values: Record<string, string>) {
  return (node.config.fields ?? []).filter((f) => f.editable && ((f.required && !values[f.key]?.trim()) || (f.type === "checkbox" && f.mustCheck && values[f.key] !== "是")))
}

/** 人工输入表单：预览与试运行待办共用 */
export function HumanForm(props: { node: WfNode; values: Record<string, string>; onChange: (values: Record<string, string>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {(props.node.config.fields ?? []).map((f) => (
        <FormFieldInput key={f.key} field={f} value={props.values[f.key] ?? ""} onChange={(v) => props.onChange({ ...props.values, [f.key]: v })} />
      ))}
    </div>
  )
}

function FormFieldInput(props: { field: WfFormField; value: string; onChange: (value: string) => void }) {
  const f = props.field
  const label = (
    <FieldLabel required={f.required && f.editable} hint={f.editable ? undefined : "只读"}>
      {f.label}
    </FieldLabel>
  )
  const hint = f.hint ? <p className="workflow-hint">{f.hint}</p> : null
  if (!f.editable && f.type !== "group" && f.type !== "table")
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <div className="workflow-readonly">{props.value || "来自上游"}</div>
        {hint}
      </div>
    )
  if (f.type === "checkbox")
    return (
      <div className="flex flex-col gap-1">
        <Check label={f.label} checked={props.value === "是"} onChange={(x) => props.onChange(x ? "是" : "")} />
        {hint}
      </div>
    )
  if (f.type === "radio")
    return (
      <div className="flex flex-col gap-1.5">
        <Select label={f.label} required={f.required} value={props.value} placeholder="请选择" options={(f.options ?? []).map((o) => ({ value: o, label: o }))} onChange={props.onChange} />
        {hint}
      </div>
    )
  if (f.type === "multi") {
    const picked = props.value ? props.value.split("、") : []
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <div className="flex flex-wrap gap-3">
          {(f.options ?? []).map((o) => (
            <Check key={o} label={o} checked={picked.includes(o)} onChange={(x) => props.onChange((x ? [...picked, o] : picked.filter((p) => p !== o)).join("、"))} />
          ))}
        </div>
        {hint}
      </div>
    )
  }
  if (f.type === "group")
    return (
      <fieldset className="workflow-form-group">
        <legend>{f.label}</legend>
        {(f.children ?? []).map((child) => (
          <FormFieldInput key={child.key} field={child} value="" onChange={() => {}} />
        ))}
      </fieldset>
    )
  if (f.type === "table")
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <div className="workflow-table">
          <div className="workflow-table-row is-head" style={{ gridTemplateColumns: `repeat(${Math.max(1, f.children?.length ?? 1)}, 1fr)` }}>
            {(f.children ?? []).map((child) => (
              <span key={child.key}>{child.label}</span>
            ))}
          </div>
          <p className="workflow-hint px-2 py-1">{f.editable ? "办理时可增删明细行" : "明细来自上游，只读展示"}</p>
        </div>
      </div>
    )
  return (
    <div className="flex flex-col gap-1.5">
      <Input label={f.label} required={f.required} multiline={f.type === "textarea"} className={f.type === "textarea" ? "min-h-[64px]" : undefined} value={props.value} onChange={(v) => props.onChange(f.type === "number" ? v.replace(/[^\d.]/g, "") : v)} />
      {hint}
    </div>
  )
}

/* ---------- 循环 ---------- */

/** 循环里可选的取值来源：当前集合项、当前循环轮次、本循环变量 + 上游输出 */
function loopRefs(graph: WfGraph, node: WfNode, t: (k: string) => string): SelectOption[] {
  return [
    { value: "", label: t("proto.wfn.loop.none") },
    { value: "$item", label: t("proto.wfn.loop.item") },
    { value: "$round", label: t("proto.wfn.loop.round") },
    ...(node.config.vars ?? []).map((v) => ({ value: `$var.${v.name}`, label: `${t("proto.wfn.loop.varRef")} · ${v.name}` })),
    ...refOptions(graph, node.id),
  ]
}

export function LoopConfig(props: ConfigProps) {
  const t = useT()
  const { c, setConfig } = useConfig(props)
  const refs = loopRefs(props.graph, props.node, t)
  const vars = c.vars ?? []
  const body = c.body ?? []
  const setVar = (i: number, patch: Partial<WfLoopVar>) => setConfig({ vars: vars.map((v, j) => (j === i ? { ...v, ...patch } : v)) }, t("proto.wfn.loop.vars"))
  const setStep = (i: number, patch: Partial<WfLoopStep>) => setConfig({ body: body.map((s, j) => (j === i ? { ...s, ...patch } : s)) }, t("proto.wfn.loop.body"))
  const tools = MCP_SERVERS.flatMap((s) => s.tools.map((x) => ({ value: `${s.name} · ${x.name}`, label: `${s.name} · ${x.name}`, desc: x.desc })))
  const condition = c.loopMode === "condition"
  return (
    <>
      <Select
        label={t("proto.wfn.loop.mode")}
        value={c.loopMode ?? "collection"}
        options={[
          { value: "collection", label: t("proto.wfn.loop.byCollection") },
          { value: "condition", label: t("proto.wfn.loop.byCondition") },
        ]}
        onChange={(loopMode) => setConfig({ loopMode: loopMode as "collection" | "condition" }, t("proto.wfn.loop.mode"))}
      />
      <p className="workflow-hint -mt-2">{t("proto.wfn.loop.modeHint")}</p>
      {!condition ? (
        <>
          <Select label={t("proto.wfn.loop.collection")} required value={c.collection ?? ""} options={refs} onChange={(collection) => setConfig({ collection }, t("proto.wfn.loop.collection"))} invalid={!c.collection} />
          <p className="workflow-hint -mt-2">{t("proto.wfn.loop.collectionHint")}</p>
          <TextField label={t("proto.wfn.loop.memberKey")} value={c.memberKey ?? ""} onCommit={(memberKey) => setConfig({ memberKey }, t("proto.wfn.loop.memberKey"))} hint={t("proto.wfn.loop.memberKeyHint")} />
          <Select
            label={t("proto.wfn.loop.concurrency")}
            value={c.concurrency ?? "sequential"}
            options={[
              { value: "sequential", label: t("proto.wfn.loop.sequential") },
              { value: "parallel", label: t("proto.wfn.loop.parallel") },
            ]}
            onChange={(concurrency) => setConfig({ concurrency: concurrency as "sequential" | "parallel" }, t("proto.wfn.loop.concurrency"))}
          />
          <Select label={t("proto.wfn.loop.itemResult")} value={c.itemResult ?? ""} options={refs} onChange={(itemResult) => setConfig({ itemResult }, t("proto.wfn.loop.itemResult"))} />
          <p className="workflow-hint -mt-2">{t("proto.wfn.loop.itemResultHint")}</p>
          <Select
            label={t("proto.wfn.loop.onError")}
            value={c.onError ?? "block"}
            options={(["block", "null", "exclude"] as const).map((x) => ({ value: x, label: t(`proto.wfn.loop.onError.${x}`) }))}
            onChange={(onError) => setConfig({ onError: onError as "block" | "null" | "exclude" }, t("proto.wfn.loop.onError"))}
          />
          <Check label={t("proto.wfn.loop.flatten")} checked={!!c.flatten} onChange={(flatten) => setConfig({ flatten }, t("proto.wfn.loop.flatten"))} />
        </>
      ) : (
        <>
          <Section title={t("proto.wfn.loop.vars")}>
            <p className="workflow-hint">{t("proto.wfn.loop.varsHint")}</p>
            {vars.map((v, i) => (
              <div key={i} className="workflow-card">
                <div className="flex items-center gap-2">
                  <InlineText className="flex-1 font-mono" value={v.name} ariaLabel={t("proto.wfn.loop.varName")} onCommit={(name) => name.trim() && setVar(i, { name: name.trim() })} />
                  <div className="w-[96px]">
                    <Select size="small" value={v.type} options={(["string", "number", "boolean", "object", "array"] as const).map((x) => ({ value: x, label: x }))} onChange={(type) => setVar(i, { type: type as WfLoopVar["type"] })} />
                  </div>
                  <RemoveButton label={t("proto.wf.remove")} onClick={() => setConfig({ vars: vars.filter((_, j) => j !== i) }, t("proto.wfn.loop.vars"))} />
                </div>
                <div className="workflow-field-row">
                  <span>{t("proto.wfn.loop.init")}</span>
                  <Select size="small" value={v.init ?? ""} options={refs} onChange={(init) => setVar(i, { init })} />
                </div>
                <div className="workflow-field-row">
                  <span>{t("proto.wfn.loop.initValue")}</span>
                  <InlineText value={v.initValue ?? ""} onCommit={(initValue) => setVar(i, { initValue })} />
                </div>
                <div className="workflow-field-row">
                  <span>{t("proto.wfn.loop.update")}</span>
                  <Select size="small" value={v.update ?? ""} options={refs} onChange={(update) => setVar(i, { update })} />
                </div>
              </div>
            ))}
            <AddButton label={t("proto.wfn.loop.addVar")} onClick={() => setConfig({ vars: [...vars, { name: `var${vars.length + 1}`, type: "string" }] }, t("proto.wfn.loop.vars"))} />
          </Section>
          <Section title={t("proto.wfn.loop.exit")}>
            <Select label={t("proto.wfn.loop.exitLeft")} required value={c.exitLeft ?? ""} options={refs} onChange={(exitLeft) => setConfig({ exitLeft }, t("proto.wfn.loop.exit"))} invalid={!c.exitLeft} />
            <div className="flex items-center gap-2">
              <div className="w-[84px] shrink-0">
                <Select size="small" value={c.exitOp ?? ">="} options={LOOP_CMPS.map((x) => ({ value: x, label: x }))} onChange={(exitOp) => setConfig({ exitOp: exitOp as WfNodeConfig["exitOp"] }, t("proto.wfn.loop.exit"))} />
              </div>
              <InlineText className="flex-1" value={c.exitRight ?? ""} placeholder={t("proto.wfn.loop.exitRight")} onCommit={(exitRight) => setConfig({ exitRight }, t("proto.wfn.loop.exit"))} />
            </div>
            <div className="flex items-center gap-2">
              <FieldLabel>{t("proto.wfn.loop.maxRounds")}</FieldLabel>
              <InlineText className="is-short" type="number" value={c.maxRounds ?? "5"} onCommit={(v) => setConfig({ maxRounds: v.replace(/\D/g, "") || "5" }, t("proto.wfn.loop.maxRounds"))} />
              <div className="min-w-0 flex-1">
                <Select size="small" value={c.maxRoundsRef ?? ""} options={[{ value: "", label: t("proto.wfn.loop.orRef") }, ...refs.slice(1)]} onChange={(maxRoundsRef) => setConfig({ maxRoundsRef }, t("proto.wfn.loop.maxRounds"))} />
              </div>
            </div>
            <p className="workflow-hint">{t("proto.wfn.loop.exitHint")}</p>
          </Section>
        </>
      )}
      <Section title={t("proto.wfn.loop.body")} action={<AddButton label={t("proto.wf.add")} onClick={() => setConfig({ body: [...body, { id: newId("b"), title: `步骤 ${body.length + 1}`, type: "agent", ref: "" }] }, t("proto.wfn.loop.body"))} />}>
        {body.map((step, i) => (
          <div key={step.id} className="workflow-card">
            <div className="flex items-center gap-1">
              <span className="workflow-step-index">{i + 1}</span>
              <InlineText className="flex-1 font-[500]" value={step.title} onCommit={(title) => title.trim() && setStep(i, { title: title.trim() })} />
              <RemoveButton label={t("proto.wf.remove")} onClick={() => setConfig({ body: body.filter((_, j) => j !== i) }, t("proto.wfn.loop.body"))} />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-[104px] shrink-0">
                <Select
                  size="small"
                  value={step.type}
                  options={[
                    { value: "agent", label: "智能体" },
                    { value: "tool", label: "MCP 工具" },
                    { value: "code", label: "代码" },
                  ]}
                  onChange={(type) => setStep(i, { type: type as WfLoopStep["type"], ref: type === "code" ? "Python" : "" })}
                />
              </div>
              {step.type !== "code" && (
                <div className="min-w-0 flex-1">
                  <Select size="small" value={step.ref} placeholder={t("proto.wf.field.chooseCapability")} options={step.type === "agent" ? agentOptions().options : tools} onChange={(ref) => setStep(i, { ref })} invalid={!step.ref} />
                </div>
              )}
            </div>
          </div>
        ))}
        {!body.length && <p className="workflow-hint is-error">{t("proto.wf.field.bodyEmpty")}</p>}
      </Section>
    </>
  )
}

/* ---------- 结束 ---------- */

export function EndConfig(props: ConfigProps) {
  const t = useT()
  const { c, setConfig } = useConfig(props)
  const results = c.results ?? []
  const refs = refOptions(props.graph, props.node.id)
  const what = t("proto.wfn.end.results")
  return (
    <Section title={t("proto.wfn.end.results")}>
      <div className="workflow-table">
        <div className="workflow-table-row is-head is-two">
          <span>{t("proto.wfn.io.outputName")}</span>
          <span>{t("proto.wfn.end.source")}</span>
          <span />
        </div>
        {results.map((r, i) => (
          <div key={i} className="workflow-table-row is-two">
            <InlineText value={r.name} ariaLabel={t("proto.wfn.io.outputName")} onCommit={(name) => name.trim() && setConfig({ results: results.map((x, j) => (j === i ? { ...x, name: name.trim() } : x)) }, what)} />
            <Select size="small" value={r.source ?? ""} placeholder={t("proto.wfn.cond.source")} options={refs} invalid={!r.source} onChange={(source) => setConfig({ results: results.map((x, j) => (j === i ? { ...x, source } : x)) }, what)} />
            <RemoveButton label={t("proto.wf.remove")} onClick={() => setConfig({ results: results.filter((_, j) => j !== i) }, what)} />
          </div>
        ))}
      </div>
      <AddButton label={t("proto.wfn.end.add")} onClick={() => setConfig({ results: [...results, { name: `output${results.length + 1}` }] }, what)} />
      <p className="workflow-hint">{t("proto.wfn.end.hint")}</p>
    </Section>
  )
}

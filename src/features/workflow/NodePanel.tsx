import { useState } from "react"
import { BrandButton, FileIcon, Icon, IconButton, SegmentedControl, Tooltip } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { trialResult, type TrialFile, type WfGraph, type WfInput, type WfNode, type WfOutput, type WfValueType } from "@/mock/fixtures/workflow-graphs"
import { NODE_ICON } from "./Canvas"
import type { RunRecord } from "./editor-store"
import { NODE_LABEL, patchNode, refLabel, refOptions, removeNode } from "./graph-ops"
import { AgentConfig, CodeConfig, ConditionConfig, EndConfig, HumanConfig, JoinConfig, LoopConfig, NextSection, ParallelConfig, StartConfig, ToolConfig, type ConfigProps } from "./node-config"
import { AddButton, CodeField, InlineText, RemoveButton, Section, Select, TextField } from "./fields"
import { formatTokens } from "./trial-run"

export { agentOptions } from "./node-config"

type Tab = "config" | "io" | "records" | "files"
const FIXED = "__fixed"
const VALUE_TYPES: WfValueType[] = ["string", "number", "boolean", "object", "array"]
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} 秒`

/**
 * 右栏：选中节点。与原设计器一致分四页：节点配置 / 输入输出 / 执行记录 / 文件。
 * 修改即时写入画布（可撤销），不需要单独点保存；运行时才确定的内容（MCP 账号、智能体版本、实际办理人）在试运行里配置。
 */
export function NodePanel(props: {
  graph: WfGraph
  node: WfNode
  readOnly: boolean
  run?: RunRecord
  onCommit: (graph: WfGraph, change?: string, focus?: string) => void
  onClose: () => void
  onAsk: (node: WfNode) => void
  onOpenFile: (file: TrialFile) => void
}) {
  const t = useT()
  const [tab, setTab] = useState<Tab>("config")
  const { node, graph } = props
  const commit: ConfigProps["commit"] = (next, what, focus) => props.onCommit(next, `修改「${node.title}」的${what}`, focus)
  const config: ConfigProps = { graph, node, commit }
  const removable = node.type !== "start" && node.type !== "end"

  return (
    <section className="workflow-side" aria-label={t("proto.wf.nodeConfig")}>
      <header className="workflow-side-head">
        <span className="workflow-node-icon" data-tone={node.type}>
          <Icon name={NODE_ICON[node.type]} size="small" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-[500] leading-5 text-text-strong">{node.title}</span>
          <span className="truncate text-[12px] leading-4 text-[var(--text-weaker)]">{t("proto.wfn.headSub", { type: NODE_LABEL[node.type] })}</span>
        </span>
        <Tooltip value={t("common.close")} placement="bottom" gutter={4}>
          <IconButton icon="close-small" variant="ghost" aria-label={t("common.close")} onClick={props.onClose} />
        </Tooltip>
      </header>
      <div className="workflow-side-tabs">
        <SegmentedControl
          size="small"
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          items={(["config", "io", "records", "files"] as const).map((x) => ({ value: x, label: t(`proto.wfn.tab.${x}`) }))}
        />
      </div>

      <fieldset className="workflow-side-body" disabled={props.readOnly}>
        {tab === "config" && (
          <>
            <NextSection {...config} />
            <TextField label={t("proto.wfn.name")} required value={node.title} readOnly={props.readOnly} onCommit={(title) => props.onCommit(patchNode(graph, node.id, { title }), `修改「${node.title}」的名称`)} />
            {node.type === "start" && <StartConfig {...config} />}
            {node.type === "agent" && <AgentConfig {...config} />}
            {node.type === "tool" && <ToolConfig {...config} />}
            {node.type === "code" && <CodeConfig {...config} />}
            {node.type === "condition" && <ConditionConfig {...config} />}
            {node.type === "parallel" && <ParallelConfig {...config} />}
            {node.type === "join" && <JoinConfig {...config} />}
            {node.type === "human" && <HumanConfig {...config} />}
            {node.type === "loop" && <LoopConfig {...config} />}
            {node.type === "end" && <EndConfig {...config} />}
          </>
        )}
        {tab === "io" && <IoTab {...config} />}
        {tab === "records" && <RecordsTab node={node} run={props.run} />}
        {tab === "files" && <FilesTab graph={graph} node={node} run={props.run} onOpenFile={props.onOpenFile} />}
      </fieldset>

      {!props.readOnly && (
        <footer className="workflow-side-foot">
          <BrandButton variant="auxiliary" size="small" icon="bubble-5" onClick={() => props.onAsk(node)}>
            {t("proto.wfn.ask")}
          </BrandButton>
          {removable && (
            <BrandButton variant="auxiliary" size="small" icon="trash-16" onClick={() => props.onCommit(removeNode(graph, node.id), `删除节点「${node.title}」`)}>
              {t("proto.wf.removeNode")}
            </BrandButton>
          )}
        </footer>
      )}
    </section>
  )
}

/* ---------- 输入输出 ---------- */

function IoTab(props: ConfigProps) {
  const t = useT()
  const { node, graph } = props
  const c = node.config
  const setConfig = (config: Partial<WfNode["config"]>, what: string) => props.commit(patchNode(graph, node.id, { config }), what)

  // 人工输入：输入与输出都由表单生成，只读展示
  if (node.type === "human")
    return (
      <div className="flex flex-col gap-3">
        <div className="workflow-table">
          <div className="workflow-table-row is-head is-five">
            <span>{t("proto.wfn.field.key")}</span>
            <span>{t("proto.wfn.field.label")}</span>
            <span>{t("proto.wfn.field.type")}</span>
            <span>{t("proto.wfn.field.edit")}</span>
            <span>{t("proto.wfn.io.require")}</span>
          </div>
          {(c.fields ?? []).map((f) => (
            <div key={f.key} className="workflow-table-row is-five is-text">
              <span className="truncate font-mono">{f.key}</span>
              <span className="truncate">{f.label}</span>
              <span>{t(`proto.wfn.fieldType.${f.type}`)}</span>
              <span>{f.editable ? t("proto.wfn.field.editable") : t("proto.wfn.field.readonly")}</span>
              <span>{f.required ? t("proto.wf.field.required") : t("proto.wfn.io.optional")}</span>
            </div>
          ))}
        </div>
        <p className="workflow-hint">{t("proto.wfn.io.humanHint")}</p>
      </div>
    )

  // 开始：业务输入就是本节点的输出
  if (node.type === "start")
    return (
      <Section title={t("proto.wfn.io.outputs")}>
        <OutputList outputs={(c.params ?? []).map((p) => ({ name: p.name, type: p.type === "file" ? "string" : p.type }))} readOnly />
        <p className="workflow-hint">{t("proto.wfn.io.startHint")}</p>
      </Section>
    )

  const hasOutputs = ["agent", "tool", "code", "loop"].includes(node.type)
  const outputs = c.outputs ?? []
  return (
    <>
      {node.type === "end" ? (
        <Section title={t("proto.wfn.io.inputs")}>
          <ul className="workflow-var-list">
            {(c.results ?? []).map((r) => (
              <li key={r.name}>
                <span className="truncate text-text-strong">{r.name}</span>
                <span className="truncate text-[var(--text-weaker)]">{refLabel(graph, r.source) || "—"}</span>
              </li>
            ))}
          </ul>
          <p className="workflow-hint">{t("proto.wfn.io.endHint")}</p>
        </Section>
      ) : (
        <InputMapping graph={graph} node={node} items={c.inputs ?? []} onChange={(inputs) => setConfig({ inputs }, t("proto.wfn.io.inputs"))} />
      )}
      {hasOutputs && (
        <Section title={t("proto.wfn.io.outputs")}>
          <OutputList outputs={outputs} onChange={(next) => setConfig({ outputs: next }, t("proto.wfn.io.outputs"))} />
          <AddButton label={t("proto.wfn.io.addOutput")} onClick={() => setConfig({ outputs: [...outputs, { name: `output${outputs.length + 1}`, type: "string" }] }, t("proto.wfn.io.outputs"))} />
        </Section>
      )}
      {node.type === "code" && <CodeField label={t("proto.wfn.io.sample")} value={c.sampleInput ?? ""} minHeight={96} onCommit={(sampleInput) => setConfig({ sampleInput }, t("proto.wfn.io.sample"))} />}
    </>
  )
}

/** 输入映射：输入名称 + 取值方式（上游引用 / 固定值）+ 取值来源 */
function InputMapping(props: { graph: WfGraph; node: WfNode; items: WfInput[]; onChange: (items: WfInput[]) => void }) {
  const t = useT()
  const refs = refOptions(props.graph, props.node.id)
  const set = (i: number, patch: Partial<WfInput>) => props.onChange(props.items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <Section title={t("proto.wfn.io.inputs")}>
      {props.items.map((item, i) => {
        const fixed = !item.source && item.value !== undefined
        const valid = !item.source || refs.some((r) => r.value === item.source)
        return (
          <div key={i} className="workflow-card">
            <div className="flex items-center gap-2">
              <InlineText className="flex-1 font-[500]" value={item.name} ariaLabel={t("proto.wfn.io.inputName")} onCommit={(name) => name.trim() && set(i, { name: name.trim() })} />
              <RemoveButton label={t("proto.wfn.io.removeInput")} onClick={() => props.onChange(props.items.filter((_, j) => j !== i))} />
            </div>
            <div className="workflow-field-row">
              <span>{t("proto.wfn.io.mode")}</span>
              <Select
                size="small"
                value={fixed ? FIXED : "ref"}
                options={[
                  { value: "ref", label: t("proto.wfn.io.ref") },
                  { value: FIXED, label: t("proto.wfn.io.fixed") },
                ]}
                onChange={(v) => set(i, v === FIXED ? { source: undefined, value: item.value ?? "" } : { value: undefined })}
              />
            </div>
            <div className="workflow-field-row">
              <span>{fixed ? t("proto.wfn.io.fixedValue") : t("proto.wfn.cond.source")}</span>
              {fixed ? (
                <InlineText value={item.value ?? ""} onCommit={(value) => set(i, { value })} />
              ) : (
                <Select size="small" value={item.source ?? ""} placeholder={t("proto.wf.field.chooseSource")} options={refs} invalid={!valid || !item.source} onChange={(source) => set(i, { source, value: undefined })} />
              )}
            </div>
            {!valid && <span className="text-[12px] text-[var(--danger-600,#e53535)]">{t("proto.wf.field.refInvalid", { ref: refLabel(props.graph, item.source) })}</span>}
          </div>
        )
      })}
      {!props.items.length && <p className="workflow-hint">{t("proto.wf.field.inputsEmpty")}</p>}
      <AddButton label={t("proto.wfn.io.addInput")} onClick={() => props.onChange([...props.items, { name: `输入${props.items.length + 1}` }])} />
    </Section>
  )
}

/** 输出契约：输出名称 + 数据类型；object 可以写结构定义 */
function OutputList(props: { outputs: WfOutput[]; onChange?: (outputs: WfOutput[]) => void; readOnly?: boolean }) {
  const t = useT()
  const set = (i: number, patch: Partial<WfOutput>) => props.onChange?.(props.outputs.map((o, j) => (j === i ? { ...o, ...patch } : o)))
  if (props.readOnly)
    return (
      <ul className="workflow-var-list">
        {props.outputs.map((o) => (
          <li key={o.name}>
            <span className="truncate text-text-strong">{o.name}</span>
            <span className="text-[var(--text-weaker)]">{o.type}</span>
          </li>
        ))}
      </ul>
    )
  return (
    <div className="flex flex-col gap-2">
      {props.outputs.map((o, i) => (
        <div key={i} className="workflow-card">
          <div className="flex items-center gap-2">
            <InlineText className="flex-1 font-mono" value={o.name} ariaLabel={t("proto.wfn.io.outputName")} onCommit={(name) => name.trim() && set(i, { name: name.trim() })} />
            <div className="w-[104px] shrink-0">
              <Select size="small" value={o.type} options={VALUE_TYPES.map((x) => ({ value: x, label: x }))} onChange={(type) => set(i, { type: type as WfValueType })} />
            </div>
            <RemoveButton label={t("proto.wfn.io.removeOutput")} onClick={() => props.onChange?.(props.outputs.filter((_, j) => j !== i))} />
          </div>
          {o.type === "object" && <CodeField label={t("proto.wfn.io.schema")} value={o.schema ?? ""} minHeight={72} onCommit={(schema) => set(i, { schema })} hint={t("proto.wfn.io.schemaHint")} />}
        </div>
      ))}
    </div>
  )
}

/* ---------- 执行记录 / 文件 ---------- */

function RecordsTab(props: { node: WfNode; run?: RunRecord }) {
  const t = useT()
  const step = props.run?.steps.find((s) => s.nodeId === props.node.id)
  return (
    <div className="flex flex-col gap-3">
      <p className="workflow-hint">{t("proto.wfn.records.hint")}</p>
      <div className="workflow-card">
        <span className="text-[13px] font-[500] text-text-strong">{props.run ? t("proto.wfn.records.current") : t("proto.wfn.records.none")}</span>
        {!step ? (
          <p className="workflow-hint">{t("proto.wfn.records.notRun")}</p>
        ) : (
          <div className="flex flex-col gap-2 text-[12px] leading-[18px]">
            <div className="workflow-record-meta">
              <span className={cx("workflow-record-status", `is-${step.status}`)}>{t(`proto.wfn.records.status.${step.status}`)}</span>
              <span>{t("proto.wf.trial.attempt", { count: step.attempts ?? 1 })}</span>
              {step.endedAt && <span>{seconds(step.endedAt - step.startedAt)}</span>}
              {!!step.tokens && <span>{formatTokens(step.tokens)} Token</span>}
            </div>
            {!!step.input?.length && (
              <>
                <span className="workflow-run-detail-label">{t("proto.wf.trial.input")}</span>
                {step.input.map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="shrink-0 text-text-weak">{k}</span>
                    <span className="min-w-0 break-all text-text-strong">{v || "—"}</span>
                  </div>
                ))}
              </>
            )}
            <span className="workflow-run-detail-label">{t("proto.wf.trial.output")}</span>
            <span className="whitespace-pre-wrap break-all text-text-strong">{step.output || "—"}</span>
            {step.rounds?.map((r) => (
              <div key={r.label} className="flex gap-2">
                <span className={cx("shrink-0", r.status === "error" ? "text-[var(--danger-600,#e53535)]" : "text-text-weak")}>{r.label}</span>
                <span className="min-w-0 text-text-strong">{r.output}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {props.node.type === "agent" && props.node.config.mode === "single" && <p className="workflow-hint">{t("proto.wfn.records.singleHint")}</p>}
    </div>
  )
}

function FilesTab(props: { graph: WfGraph; node: WfNode; run?: RunRecord; onOpenFile: (file: TrialFile) => void }) {
  const t = useT()
  const done = props.run?.steps.some((s) => s.nodeId === props.node.id && s.status === "done")
  const files = done ? trialResult(props.graph).files.filter((f) => f.producer === props.node.id) : []
  return (
    <>
      <Section title={t("proto.wfn.files.produced")}>
        {files.length ? (
          files.map((file) => (
            <button key={file.name} type="button" className="workflow-file" onClick={() => props.onOpenFile(file)}>
              <FileIcon node={{ path: file.name, type: "file" }} className="size-5 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col text-left">
                <span className="truncate text-[14px] leading-5 text-text-strong">{file.name}</span>
                <span className="text-[12px] text-[var(--text-weaker)]">{file.desc}</span>
              </span>
              <Icon name="chevron-right-16" size="small" className="text-text-weak" />
            </button>
          ))
        ) : (
          <p className="workflow-hint">{t("proto.wfn.files.none")}</p>
        )}
      </Section>
      <Section title={t("proto.wfn.files.inputs")}>
        <p className="workflow-hint">{t("proto.wfn.files.noInputs")}</p>
      </Section>
    </>
  )
}

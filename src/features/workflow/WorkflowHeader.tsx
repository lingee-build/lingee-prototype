import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { BrandButton, ConfirmDialog, Dialog, DropdownMenu, Empty, Icon, Markdown, Tag, Tooltip, showToast, useDialog, type IconName } from "@/ui"
import { useT } from "@/i18n"
import type { WfGraph } from "@/mock/fixtures/workflow-graphs"
import { devStore } from "@/mock/dev-store"
import { nextVersion, workflowService } from "@/services/workflow"
import { isDirty, useWorkflowDocs } from "@/stores/workflow-docs"
import { WorkflowFormDialog } from "@/pages/dev/workflow/WorkflowFormDialog"
import { locate, pendingProposal, useWorkflowEditor, type RunRecord } from "./editor-store"
import { validate, type Issue } from "./graph-ops"
import { IssuesDialog, SubmitDialog } from "./SubmitDialog"
import { NodeSearch } from "./NodeSearch"
import { toDsl } from "./dsl"
import { formatTokens, runTokens } from "./trial-run"

const formatTime = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const TAG_TYPE = { saved: "normal", submitted: "primary", published: "success", rejected: "error" } as const

/**
 * 画布头部（放在会话右侧面板的标题行）：名称 + 状态，右侧「保存」「试运行」「提交」「···」，层级与智能体编辑面板一致。
 * 已提交时只读，「提交」换成「撤回提交」。低频功能（试运行记录、设计历史、查看定义、导出定义、编辑信息、使用说明）；导入在工作流开发列表里收进「···」。
 */
export function WorkflowHeader(props: { id: string }) {
  const t = useT()
  const dialog = useDialog()
  const client = useQueryClient()
  const meta = useQuery({ queryKey: ["workflow", props.id], queryFn: () => workflowService.get(props.id) })
  const doc = useWorkflowDocs((s) => s.docs[props.id])
  const panel = useWorkflowEditor((s) => s.panel)
  const running = useWorkflowEditor((s) => s.runs.some((r) => r.status === "running" || r.status === "waiting"))
  const proposal = useWorkflowEditor((s) => pendingProposal(s, props.id))
  const previewing = !!proposal
  const [busy, setBusy] = useState<"save" | "submit" | "withdraw">()
  const workflow = meta.data
  const dirty = isDirty(doc)
  const submitted = workflow?.status === "submitted"
  const locked = submitted || running || previewing

  const refresh = async () => {
    await meta.refetch()
    void client.invalidateQueries({ queryKey: ["workflows"] })
  }

  /** 保存：轻校验（方案 5.3），不通过时列出问题 */
  const save = async (silent?: boolean) => {
    if (!doc) return false
    const issues = validate(doc.graph, "light")
    if (issues.length) {
      dialog.show(() => <IssuesDialog title={t("proto.wf.saveBlocked")} issues={issues} onLocate={locate} />)
      return false
    }
    setBusy("save")
    await workflowService.save(props.id)
    setBusy(undefined)
    await refresh()
    if (!silent) showToast({ variant: "success", title: t("proto.wf.saved") })
    return true
  }

  /** 提交：先保存 → 全量校验 → 依赖顺序校验 → 提交清单（方案 7.2 / 7.3） */
  const submit = async () => {
    if (!doc || !workflow) return
    if (dirty && !(await save(true))) return
    const graph = useWorkflowDocs.getState().docs[props.id]?.graph ?? doc.graph
    const issues: Issue[] = validate(graph, "full")
    if (issues.length) return dialog.show(() => <IssuesDialog title={t("proto.wf.submitBlocked")} issues={issues} onLocate={locate} />)
    const skill = graph.nodes.map((n) => (n.type === "agent" && n.config.mode !== "single" && n.config.skillRef ? devStore.skills.find((s) => s.displayName === n.config.skillRef) : undefined)).find((s) => s && s.enterpriseStatus !== "published")
    if (skill) return showToast({ variant: "error", title: t("proto.wf.submitDepBlocked", { name: skill.displayName }) })
    const version = nextVersion(workflow)
    dialog.show(() => (
      <SubmitDialog
        workflow={workflow}
        graph={graph}
        submitted={useWorkflowDocs.getState().docs[props.id]?.submitted}
        version={version}
        onSubmit={async () => {
          setBusy("submit")
          await workflowService.submit(props.id, version)
          setBusy(undefined)
          await refresh()
          useWorkflowEditor.getState().setPanel(undefined)
          showToast({ variant: "success", title: t("proto.wf.submitted") })
        }}
      />
    ))
  }

  const withdraw = () =>
    dialog.show(() => (
      <ConfirmDialog
        tone="info"
        title={t("proto.wf.withdrawTitle")}
        description={t("proto.wf.withdrawDesc")}
        cancelText={t("common.cancel")}
        confirmText={t("proto.wf.withdraw")}
        onConfirm={async () => {
          setBusy("withdraw")
          await workflowService.withdraw(props.id)
          setBusy(undefined)
          await refresh()
          showToast({ variant: "success", title: t("proto.wf.withdrawn") })
        }}
      />
    ))

  const exportJson = () => {
    if (!doc) return
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([JSON.stringify(toDsl({ name: workflow?.name ?? "", desc: workflow?.desc, graph: doc.graph }), null, 2)], { type: "application/json" }))
    a.download = `${workflow?.name || "workflow"}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const item = (icon: IconName, label: string, onSelect: () => void, disabled?: boolean) => (
    <DropdownMenu.Item className="flex items-center gap-1 cursor-pointer" disabled={disabled} onSelect={onSelect}>
      <Icon name={icon} size="small" />
      <DropdownMenu.ItemLabel>{label}</DropdownMenu.ItemLabel>
    </DropdownMenu.Item>
  )

  if (!workflow) return <div className="flex-1" />
  const statusLabel =
    workflow.status === "published" ? t("proto.wf.status.published", { version: workflow.publishedVersion ?? "" }) : workflow.status === "submitted" ? t("proto.wf.status.submitted", { version: workflow.pendingVersion ?? "" }) : t(`ui.tile.status.${workflow.status}`)

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
      <span className="min-w-0 truncate text-[14px] font-medium leading-[22px] text-text-strong" title={workflow.name}>
        {workflow.name}
      </span>
      <Tooltip value={workflow.status === "rejected" && workflow.rejectReason ? t("proto.wf.rejectReason", { reason: workflow.rejectReason }) : workflow.status === "published" && dirty ? t("proto.wf.publishedDirty") : ""} inactive={!(workflow.status === "rejected" || (workflow.status === "published" && dirty))} placement="bottom" gutter={4}>
        <Tag type={TAG_TYPE[workflow.status]} className="shrink-0">
          {workflow.status === "rejected" && <Icon name="info" size="xs" className="mr-0.5 inline-block" />}
          {statusLabel}
        </Tag>
      </Tooltip>
      {dirty && !submitted && <span className="shrink-0 text-[12px] text-[var(--text-weaker)]">{t("proto.wf.unsaved")}</span>}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {doc && <NodeSearch graph={proposal?.graph ?? doc.graph} onPick={(node) => useWorkflowEditor.getState().requestFocus(node.id)} />}
        <BrandButton variant="secondary" size="normal" icon={busy === "save" ? undefined : "save-doc"} disabled={!!busy || !dirty || locked} onClick={() => void save()}>
          {busy === "save" && <span className="workflow-spinner" aria-hidden="true" />}
          {t("proto.wf.save")}
        </BrandButton>
        <BrandButton variant="secondary" size="normal" icon="test-flask" disabled={previewing} data-active={panel === "trial" ? "true" : undefined} onClick={() => useWorkflowEditor.getState().setPanel(panel === "trial" ? undefined : "trial")}>
          {t("proto.wf.trial")}
        </BrandButton>
        {submitted ? (
          <BrandButton variant="secondary" size="normal" icon={busy === "withdraw" ? undefined : "undo"} disabled={!!busy} onClick={withdraw}>
            {busy === "withdraw" && <span className="workflow-spinner" aria-hidden="true" />}
            {t("proto.wf.withdraw")}
          </BrandButton>
        ) : (
          <BrandButton variant="primary" size="normal" icon={busy === "submit" ? undefined : "submit-upload"} disabled={!!busy || locked || (workflow.status === "published" && !dirty)} onClick={() => void submit()}>
            {busy === "submit" && <span className="workflow-spinner" aria-hidden="true" />}
            {t("proto.wf.submit")}
          </BrandButton>
        )}
        <DropdownMenu placement="bottom-end" gutter={4}>
          <DropdownMenu.Trigger className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-text-strong hover:bg-surface-base-hover" aria-label={t("proto.agentConfig.moreActions")}>
            <Icon name="dot-grid" size="small" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="test-dropdown-menu" style={{ minWidth: 160 }}>
              {item("test-flask", t("proto.wf.menu.runs"), () => dialog.show(() => <RunsDialog />))}
              {item("git-history", t("proto.wf.menu.history"), () => dialog.show(() => <HistoryDialog id={props.id} locked={locked} />))}
              {item("code-slash-16", t("proto.wf.menu.definition"), () => dialog.show(() => <DefinitionDialog graph={doc?.graph} />))}
              <DropdownMenu.Separator />
              {item("spec-download", t("proto.wf.menu.export"), exportJson)}
              <DropdownMenu.Separator />
              {item("edit-doc-16", t("proto.wf.menu.edit"), () =>
                dialog.show(() => (
                  <WorkflowFormDialog
                    workflow={workflow}
                    existingNames={workflowService.names()}
                    onSubmit={async (input) => {
                      await workflowService.update(props.id, input)
                      await refresh()
                    }}
                  />
                )),
              locked)}
              {item("book-open", t("proto.wf.menu.help"), () => dialog.show(() => <HelpDialog />))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu>
      </div>
    </div>
  )
}

/** 设计历史：每次保存一条，可恢复（恢复后需再保存才生效；发布版本的回滚本期不做） */
const timeOf = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 试运行记录：本次打开画布后的每次运行，点「查看」在右栏试运行面板里打开该次记录 */
function RunsDialog() {
  const t = useT()
  const dialog = useDialog()
  const runs = useWorkflowEditor((s) => s.runs)
  const open = (run?: RunRecord) => {
    const editor = useWorkflowEditor.getState()
    editor.setPanel("trial")
    editor.viewRun(run?.id)
    dialog.close()
  }
  return (
    <Dialog fit title={t("proto.wf.runs.title")} className="w-[600px] max-w-[calc(100vw-32px)] !rounded-[24px] overflow-hidden">
      <div className="flex flex-col gap-3 px-6 pb-6">
        <p className="text-[12px] text-[var(--text-weaker)]">{t("proto.wf.runs.hint")}</p>
        {runs.length ? (
          <div className="workflow-table">
            <div className="workflow-table-row is-head is-runs">
              <span>{t("proto.wf.runs.col.run")}</span>
              <span>{t("proto.wf.runs.col.status")}</span>
              <span>{t("proto.wf.runs.col.time")}</span>
              <span>Token</span>
              <span>{t("proto.wf.runs.col.steps")}</span>
              <span />
            </div>
            {runs.map((run, i) => (
              <div key={run.id} className="workflow-table-row is-runs is-text">
                <span className="truncate">
                  #{runs.length - i} · {timeOf(run.startedAt)}
                </span>
                <span className={`workflow-record-status is-${run.status}`}>{t(`proto.wf.trial.status.${run.status}`)}</span>
                <span>{(((run.endedAt ?? Date.now()) - run.startedAt) / 1000).toFixed(1)} 秒</span>
                <span>{formatTokens(runTokens(run))}</span>
                <span>{run.steps.filter((s) => s.status === "done").length}</span>
                <button type="button" className="workflow-link" onClick={() => open(run)}>
                  {t("proto.wf.runs.view")}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6">
            <Empty description={t("proto.wf.runs.empty")} />
            <BrandButton variant="primary" size="small" icon="test-flask" onClick={() => open()}>
              {t("proto.wf.runs.start")}
            </BrandButton>
          </div>
        )}
      </div>
    </Dialog>
  )
}

function HistoryDialog(props: { id: string; locked: boolean }) {
  const t = useT()
  const dialog = useDialog()
  const doc = useWorkflowDocs((s) => s.docs[props.id])
  const saves = [...(doc?.saves ?? [])].reverse()
  return (
    <Dialog fit title={t("proto.wf.menu.history")} className="w-[480px] max-w-[calc(100vw-32px)] !rounded-[24px] overflow-hidden">
      <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto px-6 pb-6 pt-1">
        <p className="text-[12px] text-[var(--text-weaker)]">{t("proto.wf.history.hint")}</p>
        {saves.map((v, i) => (
          <div key={v.seq} className="workflow-version">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[14px] font-[500] text-text-strong">
                {t("proto.wf.history.item", { seq: v.seq })}
                {i === 0 && <span className="ml-2 text-[12px] font-normal text-[var(--text-weaker)]">{t("proto.wf.history.latest")}</span>}
              </span>
              <span className="text-[12px] text-[var(--text-weaker)]">
                {formatTime(v.savedAt)} · {v.operator} · {t("proto.wf.history.nodes", { count: v.graph.nodes.length })}
              </span>
            </span>
            {i > 0 && !props.locked && (
              <BrandButton
                variant="auxiliary"
                size="small"
                onClick={() =>
                  dialog.show(() => (
                    <ConfirmDialog
                      tone="info"
                      title={t("proto.wf.history.restoreTitle", { seq: v.seq })}
                      description={t("proto.wf.history.restoreDesc")}
                      cancelText={t("common.cancel")}
                      confirmText={t("proto.wf.history.restore")}
                      onConfirm={() => {
                        useWorkflowEditor.getState().commit(structuredClone(v.graph), `恢复为第 ${v.seq} 次保存`)
                        showToast({ variant: "success", title: t("proto.wf.history.restored") })
                      }}
                    />
                  ))
                }
              >
                {t("proto.wf.history.restore")}
              </BrandButton>
            )}
          </div>
        ))}
      </div>
    </Dialog>
  )
}

function DefinitionDialog(props: { graph?: WfGraph }) {
  const t = useT()
  const text = JSON.stringify({ nodes: props.graph?.nodes.map(({ x: _x, y: _y, ...n }) => n), edges: props.graph?.edges }, null, 2)
  return (
    <Dialog fit title={t("proto.wf.menu.definition")} className="w-[640px] max-w-[calc(100vw-32px)] !rounded-[24px] overflow-hidden">
      <div className="max-h-[60vh] overflow-auto px-6 pb-6">
        <Markdown text={`\`\`\`json\n${text}\n\`\`\``} />
      </div>
    </Dialog>
  )
}

function HelpDialog() {
  const t = useT()
  return (
    <Dialog fit title={t("proto.wf.menu.help")} className="w-[480px] max-w-[calc(100vw-32px)] !rounded-[24px] overflow-hidden">
      <div className="px-6 pb-6">
        <Markdown text={t("proto.wf.helpText")} />
      </div>
    </Dialog>
  )
}

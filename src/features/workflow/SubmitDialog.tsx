import { useState } from "react"
import { BrandButton, Dialog, Icon, Input, useDialog } from "@/ui"
import { useT } from "@/i18n"
import type { WfGraph } from "@/mock/fixtures/workflow-graphs"
import type { Workflow } from "@/mock/fixtures/workflows"
import { dependencies, diff, humanSteps, paramsChanged, toolName, writeSteps, type Issue } from "./graph-ops"
import { Select } from "./fields"

/**
 * 提交清单（方案 7.3）：版本号、发布范围、写操作步骤、人工确认步骤数、依赖对象（标明不重复审核）、变更说明（必填，按差异生成初稿）。
 * 变更差异以「已提交基线」计算，不用已保存基线（方案 10.2）。
 */
export function SubmitDialog(props: { workflow: Workflow; graph: WfGraph; submitted?: WfGraph; version: string; onSubmit: (note: string, scope: string) => Promise<void> }) {
  const t = useT()
  const dialog = useDialog()
  const changes = diff(props.submitted, props.graph)
  const [note, setNote] = useState(changes.length ? changes.join("；") : t("proto.wf.submit.noChange"))
  const [scope, setScope] = useState("self")
  const [busy, setBusy] = useState(false)
  const writes = writeSteps(props.graph)
  const humans = humanSteps(props.graph)
  const deps = dependencies(props.graph)
  const contractChanged = paramsChanged(props.submitted, props.graph)

  return (
    <Dialog fit title={t("proto.wf.submit.title")} className="w-[560px] max-w-[calc(100vw-32px)] !rounded-[24px] overflow-hidden">
      <div className="flex max-h-[72vh] flex-col gap-5 overflow-y-auto px-6 pb-6">
        {props.workflow.status === "rejected" && props.workflow.rejectReason && (
          <div className="workflow-issues" role="note">
            <span className="text-[13px] leading-5 text-text-base">{t("proto.wf.rejectReason", { reason: props.workflow.rejectReason })}</span>
          </div>
        )}
        <div className="workflow-kv">
          <span>{t("proto.wf.submit.name")}</span>
          <strong>{props.workflow.name}</strong>
          <span>{t("proto.wf.submit.version")}</span>
          <strong>v{props.version}</strong>
        </div>
        <Select
          label={t("proto.wf.submit.scope")}
          value={scope}
          options={[
            { value: "self", label: t("proto.wf.submit.scope.self"), desc: t("proto.wf.submit.scope.selfDesc") },
            { value: "dept", label: t("proto.wf.submit.scope.dept"), desc: t("proto.wf.submit.scope.deptDesc") },
            { value: "all", label: t("proto.wf.submit.scope.all"), desc: t("proto.wf.submit.scope.allDesc") },
          ]}
          onChange={setScope}
        />
        <div className="flex flex-col gap-2">
          <span className="text-[14px] leading-5 text-text-weak">{t("proto.wf.submit.writes", { count: writes.length })}</span>
          {writes.length ? (
            <ul className="workflow-var-list">
              {writes.map((n) => (
                <li key={n.id}>
                  <span className="truncate text-text-strong">{n.title}</span>
                  <span className="truncate text-[var(--text-weaker)]">{toolName(n)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-[13px] text-[var(--text-weaker)]">{t("proto.wf.submit.noWrites")}</span>
          )}
        </div>
        <div className="workflow-kv">
          <span>{t("proto.wf.submit.humans")}</span>
          <strong>{t("proto.wf.submit.humansCount", { count: humans.length })}</strong>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[14px] leading-5 text-text-weak">
            {t("proto.wf.submit.deps")}
            <span className="ml-2 text-[12px] text-[var(--text-weaker)]">{t("proto.wf.submit.depNoReview")}</span>
          </span>
          <ul className="workflow-var-list">
            {deps.map((d) => (
              <li key={d.name}>
                <span className="truncate text-text-strong">{d.name}</span>
                <span className="truncate text-[var(--text-weaker)]">{d.kind}</span>
              </li>
            ))}
          </ul>
        </div>
        {contractChanged && (
          <div className="workflow-note">
            <Icon name="info" size="small" />
            {t("proto.wf.submit.contractChanged")}
          </div>
        )}
        <Input label={t("proto.wf.submit.note")} required multiline className="min-h-[72px]" value={note} onChange={setNote} error={!note.trim() ? t("proto.wf.submit.noteRequired") : undefined} />
        <div className="flex items-center justify-end gap-3">
          <button type="button" className="h-[34px] cursor-pointer rounded-[8px] border-none bg-transparent px-4 text-[14px] text-[var(--neutral-600)] transition-colors hover:bg-[var(--surface-base-hover)]" disabled={busy} onClick={dialog.close}>
            {t("common.cancel")}
          </button>
          <BrandButton
            variant="primary"
            size="normal"
            disabled={busy || !note.trim()}
            onClick={async () => {
              setBusy(true)
              await props.onSubmit(note.trim(), scope)
              setBusy(false)
              dialog.close()
            }}
          >
            {t("proto.wf.submit.confirm")}
          </BrandButton>
        </div>
      </div>
    </Dialog>
  )
}

/** 校验未通过：列出问题，点「定位」关闭弹窗并在画布上选中对应步骤 */
export function IssuesDialog(props: { title: string; issues: Issue[]; onLocate: (issue: Issue) => void }) {
  const t = useT()
  const dialog = useDialog()
  return (
    <Dialog fit title={props.title} className="w-[480px] max-w-[calc(100vw-32px)] !rounded-[24px] overflow-hidden">
      <div className="flex flex-col gap-2 px-6 pb-6">
        {props.issues.map((issue) => (
          <div key={issue.message} className="workflow-version">
            <Icon name="warning-circle" size="small" className="shrink-0 text-[var(--danger-600,#e53535)]" />
            <span className="min-w-0 flex-1 text-[14px] leading-5 text-text-strong">{issue.message}</span>
            {(issue.nodeId || issue.edgeId) && (
              <BrandButton
                variant="auxiliary"
                size="small"
                onClick={() => {
                  dialog.close()
                  props.onLocate(issue)
                }}
              >
                {t("proto.wf.trial.locate")}
              </BrandButton>
            )}
          </div>
        ))}
      </div>
    </Dialog>
  )
}

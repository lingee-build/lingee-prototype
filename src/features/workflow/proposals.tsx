import workflowIcon from "@/ui/render-card/workflow-card-icon.svg"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { workflowService } from "@/services/workflow"
import { useWorkflowDocs } from "@/stores/workflow-docs"
import { useWorkflowEditor } from "./editor-store"
import { openWorkflowCanvas } from "./open-canvas"

/**
 * 助手提出的画布修改：会话里出现一张修改卡片，画布进入预览（只读、标出改动）；
 * 用户在卡片或画布顶部确认「应用」后才写入画布，可撤销；「放弃」则画布不变。
 */
export function applyProposal(id: string) {
  const editor = useWorkflowEditor.getState()
  const proposal = editor.proposals[id]
  if (!proposal || proposal.status !== "pending") return
  const doc = useWorkflowDocs.getState().docs[proposal.workflowId]
  if (!doc) return
  if (editor.workflowId === proposal.workflowId) editor.commit(proposal.graph)
  else useWorkflowDocs.getState().setGraph(proposal.workflowId, proposal.graph)
  workflowService.touch(proposal.workflowId)
  editor.resolveProposal(id, "applied")
  if (proposal.changed.length) {
    editor.flash(proposal.changed)
    if (editor.workflowId === proposal.workflowId) editor.select(proposal.changed[0])
  }
}

export function discardProposal(id: string) {
  useWorkflowEditor.getState().resolveProposal(id, "discarded")
}

/** 会话里的修改卡片：样式沿用 Build 产物卡片，点卡片在画布中预览 */
export function WorkflowChangeCard(props: { config: Record<string, string> }) {
  const t = useT()
  const proposal = useWorkflowEditor((s) => s.proposals[props.config.id ?? ""])
  const status = proposal?.status ?? "expired"
  const pending = status === "pending"
  return (
    <div
      data-component="render-card"
      className={cx("workflow-change-card", !pending && "is-done")}
      onClick={() => proposal && openWorkflowCanvas(proposal.workflowId, props.config.title ?? "")}
    >
      <div data-slot="render-card-icon">
        <img src={workflowIcon} alt="" draggable={false} />
      </div>
      <div data-slot="render-card-body">
        <span data-slot="render-card-title">{t("proto.wf.proposal.cardTitle", { name: props.config.title ?? "" })}</span>
        <span data-slot="render-card-desc">{props.config.summary}</span>
      </div>
      {pending ? (
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="workflow-card-btn" onClick={() => discardProposal(proposal!.id)}>
            {t("proto.wf.proposal.discard")}
          </button>
          <button type="button" className="workflow-card-btn is-primary" onClick={() => applyProposal(proposal!.id)}>
            {t("proto.wf.proposal.apply")}
          </button>
        </div>
      ) : (
        <span className="shrink-0 text-[13px] text-[var(--text-weaker)]">{t(`proto.wf.proposal.status.${status}`)}</span>
      )}
    </div>
  )
}

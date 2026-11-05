import { useEffect, useMemo, type CSSProperties } from "react"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router"
import { BrandButton, Empty, Icon, useDialog } from "@/ui"
import { useT } from "@/i18n"
import { WORKFLOW_CREATOR } from "@/mock/fixtures/workflow-cases"
import type { TrialFile, WfGraph } from "@/mock/fixtures/workflow-graphs"
import { workflowService } from "@/services/workflow"
import { usePrompt } from "@/stores/prompt"
import { useSync } from "@/stores/sync"
import { useWorkflowDocs } from "@/stores/workflow-docs"
import { Canvas } from "@/features/workflow/Canvas"
import { currentRun, locate, pendingProposal, useWorkflowEditor } from "@/features/workflow/editor-store"
import { validate } from "@/features/workflow/graph-ops"
import { NodePanel } from "@/features/workflow/NodePanel"
import { useCollapseSidebar } from "@/features/workflow/open-canvas"
import { clamp, startResize, useWorkflowLayout } from "@/features/workflow/layout-store"
import { applyProposal, discardProposal } from "@/features/workflow/proposals"
import { FileDialog, TrialPanel } from "@/features/workflow/TrialPanel"
import "@/features/workflow/workflow.css"

/**
 * 会话右侧面板里的工作流画布。对话在左侧 Build 会话里进行，画布与对话双向同步：
 * - 对话修改画布：助手先给出修改方案，画布进入预览（只读、标出改动），确认后才应用
 * - 画布手动修改：记成「画布有 N 处修改」挂在输入框上方，下次发消息时告诉助手
 * 右栏只在选中节点或试运行时出现，其余时间画布占满。
 */
export function WorkflowDrawer(props: { id: string }) {
  const t = useT()
  const { sessionId } = useParams()
  useCollapseSidebar()
  const meta = useQuery({ queryKey: ["workflow", props.id], queryFn: () => workflowService.get(props.id) })
  const doc = useWorkflowDocs((s) => s.docs[props.id])
  const editor = useWorkflowEditor()
  const run = currentRun(editor)
  const proposal = pendingProposal(editor, props.id)
  const dialog = useDialog()
  const side = useWorkflowLayout((s) => s.side)

  useEffect(() => {
    if (meta.data) useWorkflowDocs.getState().ensure(meta.data)
  }, [meta.data])
  useEffect(() => {
    useWorkflowEditor.getState().open(props.id)
  }, [props.id])

  const status = useMemo(() => Object.fromEntries((run?.steps ?? []).map((s) => [s.nodeId, s.status])), [run])
  const issues = useMemo(() => new Set(doc ? validate(doc.graph, "full").flatMap((i) => (i.nodeId ? [i.nodeId] : [])) : []), [doc])
  if (meta.isPending) return <div className="size-full" />
  if (!meta.data || !doc)
    return (
      <div className="size-full flex items-center justify-center">
        <Empty description={t("proto.workflow.notFound")} />
      </div>
    )

  const running = run?.status === "running" || run?.status === "waiting" || run?.status === "failed"
  const submitted = meta.data.status === "submitted"
  const readOnly = running || submitted || !!proposal
  const graph = proposal?.graph ?? doc.graph
  const selectedNode = editor.panel === "node" ? graph.nodes.find((n) => n.id === editor.selected) : undefined
  const openFile = (file: TrialFile) =>
    dialog.show(() => <FileDialog file={file} producer={graph.nodes.find((n) => n.id === file.producer)} onLocate={() => locate({ nodeId: file.producer })} />)
  const commit = (next: WfGraph, change?: string, focus?: string) => {
    if (readOnly) return
    editor.commit(next, change)
    workflowService.touch(props.id)
    if (focus) {
      editor.select(focus)
      editor.flash([focus])
    }
    if (editor.selected && !next.nodes.some((n) => n.id === editor.selected)) editor.select(undefined)
  }

  return (
    <div className="workflow-editor relative size-full flex bg-[var(--main-bg)]" style={{ "--wf-side": `${side * 100}%` } as CSSProperties}>
      {/* 画布与右栏之间的分隔线：左右拖动调整右栏宽度（右栏最窄 300px，画布最窄 280px），双击恢复 */}
      {(selectedNode || editor.panel === "trial") && (
        <div
          data-component="resize-handle"
          data-direction="horizontal"
          className="workflow-resize-handle is-side"
          role="separator"
          aria-orientation="vertical"
          aria-label={t("proto.wf.resize")}
          onDoubleClick={() => useWorkflowLayout.getState().set({ side: 1 / 2 })}
          onPointerDown={(e) =>
            startResize(
              e,
              e.currentTarget.parentElement,
              (x, rect) => clamp((rect.right - x) / rect.width, 300 / rect.width, 1 - 280 / rect.width),
              (next) => useWorkflowLayout.getState().set({ side: next }),
            )
          }
        />
      )}
      <div className="relative flex min-w-0 flex-1">
        <Canvas
          graph={graph}
          selected={editor.selected}
          highlight={editor.highlight}
          proposed={proposal?.changed}
          issues={readOnly ? undefined : issues}
          status={status}
          chosen={run?.taken}
          readOnly={readOnly}
          focus={editor.focus}
          fitKey={`${props.id}:${editor.panel ?? "none"}:${proposal?.id ?? ""}`}
          onSelect={(id) => editor.select(id)}
          onFlash={(id) => editor.flash([id])}
          onCommit={commit}
          onUndo={editor.undo}
          onRedo={editor.redo}
          canUndo={editor.past.length > 0}
          canRedo={editor.future.length > 0}
        />
        {proposal && (
          <div className="workflow-banner" role="status">
            <Icon name="doc-spark" size="small" className="shrink-0 text-[var(--primary-600)]" />
            <span className="min-w-0 flex-1 text-[13px] leading-5 text-text-strong">
              <strong className="font-[500]">{t("proto.wf.proposal.title")}</strong>
              {proposal.summary}
            </span>
            <BrandButton variant="auxiliary" size="small" onClick={() => discardProposal(proposal.id)}>
              {t("proto.wf.proposal.discard")}
            </BrandButton>
            <BrandButton variant="primary" size="small" onClick={() => applyProposal(proposal.id)}>
              {t("proto.wf.proposal.apply")}
            </BrandButton>
          </div>
        )}
        {submitted && !proposal && (
          <div className="workflow-banner is-muted" role="status">
            <Icon name="info" size="small" className="shrink-0" />
            <span className="min-w-0 flex-1 text-[13px] leading-5">{t("proto.wf.submittedReadonly")}</span>
          </div>
        )}
      </div>
      {selectedNode && editor.panel === "node" && (
        <NodePanel
          key={selectedNode.id}
          graph={graph}
          node={selectedNode}
          readOnly={readOnly}
          run={run}
          onCommit={(next, change, focus) => commit(next, change, focus)}
          onClose={() => editor.select(undefined)}
          onAsk={(node) => usePrompt.getState().setDraft(`/${WORKFLOW_CREATOR} 修改「${node.title}」：`, sessionId)}
          onOpenFile={openFile}
        />
      )}
      {editor.panel === "trial" && (
        <TrialPanel
          workflowId={props.id}
          graph={doc.graph}
          onClose={() => editor.setPanel(undefined)}
          // 运行中只高亮，不切走试运行面板；运行前（校验问题）选中并打开配置
          onLocate={(target) => (run && "nodeId" in target && target.nodeId && !("message" in target) ? editor.flash([target.nodeId]) : locate(target))}
          onFinished={(summary) => sessionId && workflowService.appendSessionMessage(sessionId, t("proto.wf.trial.ask", { name: meta.data!.name }), summary, useSync.getState().apply)}
        />
      )}
    </div>
  )
}

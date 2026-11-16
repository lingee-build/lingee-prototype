import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button, FileIcon, Icon } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { FileDiff } from "@/mock/fixtures/files"
import { fileService } from "@/services"

const LINE_STYLE: Record<string, string> = {
  "+": "bg-[color-mix(in_srgb,var(--icon-diff-add-base)_12%,transparent)]",
  "-": "bg-[color-mix(in_srgb,var(--icon-diff-delete-base)_12%,transparent)]",
}

function Changes(props: { additions: number; deletions: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-12-medium tabular-nums">
      {props.additions > 0 && <span style={{ color: "var(--icon-diff-add-base)" }}>+{props.additions}</span>}
      {props.deletions > 0 && <span style={{ color: "var(--icon-diff-delete-base)" }}>-{props.deletions}</span>}
    </span>
  )
}

function DiffFile(props: { diff: FileDiff; open: boolean; onToggle: () => void; onOpenFile: () => void }) {
  const t = useT()
  const { diff } = props
  const slash = diff.path.lastIndexOf("/")
  return (
    <div className="rounded-[12px] border border-border-weak-base bg-background-base overflow-hidden">
      <div
        role="button"
        aria-expanded={props.open}
        className="group flex h-10 items-center gap-2 px-3 cursor-pointer hover:bg-surface-base-hover transition-colors"
        onClick={props.onToggle}
      >
        <FileIcon node={{ path: diff.path, type: "file" }} className="size-4 shrink-0" />
        <span className="flex min-w-0 flex-1 items-center text-13-regular" title={diff.path}>
          <span className="truncate text-text-weak">{diff.path.slice(0, slash + 1)}</span>
          <span className="shrink-0 text-text-strong">{diff.path.slice(slash + 1)}</span>
        </span>
        <button
          type="button"
          className="hidden group-hover:inline-flex h-6 items-center rounded-md px-1.5 text-12-regular text-text-weak hover:bg-[var(--icon-bg-hover)] hover:text-text-strong cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            props.onOpenFile()
          }}
        >
          {t("ui.sessionReview.openFile")}
        </button>
        <Changes additions={diff.additions} deletions={diff.deletions} />
        <Icon name={props.open ? "chevron-down-16" : "chevron-right-16"} size="small" className="text-icon-weak" />
      </div>
      {props.open && (
        <div className="border-t border-border-weak-base overflow-x-auto py-1 font-mono text-[12px] leading-[20px] select-text">
          {diff.lines.map((line, index) => (
            <div key={index} className={cx("flex min-w-max px-3", LINE_STYLE[line[0]])}>
              <span className="w-4 shrink-0 select-none text-text-weaker">{line[0] === " " ? "" : line[0]}</span>
              <span className="whitespace-pre">{line.slice(1) || " "}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** 审查页签：本会话改动的文件清单，逐个展开看 diff */
export function ReviewView(props: { sessionId: string; onOpenFile: (path: string) => void }) {
  const t = useT()
  const diffs = useQuery({ queryKey: ["diff", props.sessionId], queryFn: () => fileService.diff(props.sessionId) })
  const [closed, setClosed] = useState<string[]>([])
  const list = diffs.data ?? []
  const allOpen = closed.length === 0

  if (diffs.isPending) return <div className="px-6 py-4 text-14-regular text-text-weak">{t("common.loading")}</div>
  if (list.length === 0)
    return (
      <div className="h-full pb-64 flex flex-col items-center justify-center text-center gap-6">
        <div className="text-14-regular text-text-weak max-w-56">{t("session.review.empty")}</div>
      </div>
    )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-14-medium text-text-strong">{t("ui.sessionReview.title")}</span>
          <Changes additions={list.reduce((sum, x) => sum + x.additions, 0)} deletions={list.reduce((sum, x) => sum + x.deletions, 0)} />
        </div>
        <Button variant="ghost" size="small" onClick={() => setClosed(allOpen ? list.map((x) => x.path) : [])}>
          {t(allOpen ? "ui.sessionReview.collapseAll" : "ui.sessionReview.expandAll")}
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-8 flex flex-col gap-3">
        {list.map((diff) => (
          <DiffFile
            key={diff.path}
            diff={diff}
            open={!closed.includes(diff.path)}
            onToggle={() => setClosed((x) => (x.includes(diff.path) ? x.filter((p) => p !== diff.path) : [...x, diff.path]))}
            onOpenFile={() => props.onOpenFile(diff.path)}
          />
        ))}
      </div>
    </div>
  )
}

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { IconButton, Search, Tooltip } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { FileDiff } from "@/mock/fixtures/files"
import { fileService } from "@/services"
import { usePanel } from "@/stores/panel"
import { useSync } from "@/stores/sync"
import { EmptyFiles } from "./EmptyFiles"
import { FileTree } from "./FileTree"
import { FileView } from "./FileView"
import { PanelTabs } from "./PanelTabs"
import { buildTree, filterTree } from "./file-tree-model"

const KIND_COLOR: Record<FileDiff["kind"], string> = {
  add: "var(--icon-diff-add-base)",
  del: "var(--icon-diff-delete-base)",
  mix: "var(--icon-diff-modified-base)",
}

/** 文件树视图：左边是可筛选的文件树，右边是多标签的文件查看区 */
export function FileTreePane(props: { projectId: string; sessionId?: string }) {
  const t = useT()
  const client = useQueryClient()
  const panel = usePanel()
  const [filter, setFilter] = useState("")
  const project = useSync((s) => s.projects.find((x) => x.id === props.projectId))
  const files = useQuery({ queryKey: ["files", props.projectId], queryFn: () => fileService.list(props.projectId) })
  const diffs = useQuery({ queryKey: ["diff", props.sessionId], queryFn: () => fileService.diff(props.sessionId ?? ""), enabled: !!props.sessionId })

  const kinds = useMemo(() => new Map((diffs.data ?? []).map((x) => [x.path, x.kind])), [diffs.data])
  const tree = useMemo(() => filterTree(buildTree(files.data ?? []), filter), [files.data, filter])
  const treeHidden = panel.treeHidden && panel.files.length > 0

  if (files.data?.length === 0)
    return (
      <div id="file-tree-panel" className="h-full flex overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <EmptyFiles />
        </div>
      </div>
    )

  return (
    <div id="file-tree-panel" className="h-full min-h-0 flex overflow-hidden">
      <div
        className={cx(
          "relative min-h-0 flex flex-col shrink-0 overflow-hidden bg-background-stronger group/filetree",
          "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none",
          !treeHidden && "border-r border-[var(--neutral-100)]",
        )}
        style={{ width: treeHidden ? 0 : panel.fileTreeWidth }}
      >
        <div className="shrink-0 px-2 pt-2 pb-1 flex items-center gap-1">
          <div className="flex-1 min-w-0">
            <Search value={filter} onChange={setFilter} placeholder={t("filetree.filter.placeholder")} />
          </div>
          <Tooltip value={t("filetree.refresh")} placement="bottom" gutter={8} className="shrink-0">
            <IconButton
              icon="refresh"
              variant="ghost"
              iconSize="small"
              className={cx("h-7 w-7", files.isFetching && "animate-spin")}
              disabled={files.isFetching}
              onClick={() => void client.invalidateQueries({ queryKey: ["files", props.projectId] })}
              aria-label={t("filetree.refresh")}
            />
          </Tooltip>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" data-component="filetree">
          {tree.length === 0 && filter ? (
            <div className="px-3 py-2 text-12-regular text-text-weak">{t("filetree.filter.noResults")}</div>
          ) : (
            <FileTree
              // 筛选词变化时重建，让目录按新的结果重新展开
              key={filter ? "filtering" : "all"}
              rootLabel={project?.name ?? props.projectId}
              nodes={tree}
              kinds={kinds}
              activePath={panel.active}
              filtering={!!filter}
              onFileClick={panel.openFile}
            />
          )}
        </div>
      </div>

      {panel.files.length === 0 ? (
        <div className="flex-1 flex items-center justify-center relative">
          <EmptyFiles />
        </div>
      ) : (
        <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden bg-background-base">
          <div data-component="tabs" data-variant="normal" data-orientation="horizontal" className="h-full flex flex-col editor-file-tabs">
            <PanelTabs
              active={panel.active}
              files={panel.files}
              fileColor={(path) => {
                const kind = kinds.get(path)
                return kind && KIND_COLOR[kind]
              }}
              onSelect={panel.setActive}
              onClose={panel.closeFile}
              onCloseOthers={panel.closeOthers}
              onCloseToRight={panel.closeToRight}
              onCloseAll={panel.closeAll}
            />
            {panel.active && (
              <div data-slot="tabs-content" role="tabpanel" className="flex-1 min-h-0 overflow-hidden">
                <FileView
                  key={panel.active}
                  projectId={props.projectId}
                  path={panel.active}
                  headerAccessory={
                    <IconButton
                      icon={treeHidden ? "sidepanel-open" : "sidepanel-close"}
                      variant="ghost"
                      size="small"
                      className="size-6 rounded-md shrink-0 -ml-2"
                      onClick={() => panel.setTreeHidden(!treeHidden)}
                      aria-label={t(treeHidden ? "command.sidebar.open" : "command.sidebar.close")}
                    />
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

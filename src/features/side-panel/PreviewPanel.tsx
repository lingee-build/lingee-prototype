import { useQuery } from "@tanstack/react-query"
import { Icon, Tooltip } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { fileService } from "@/services"
import { usePanel } from "@/stores/panel"
import { DrawerView } from "./drawer/DrawerView"
import { FileTreePane } from "./FileTreePane"
import { ReviewView } from "./ReviewView"

/**
 * 会话右侧的预览面板（对应原工程 session.tsx 里的预览区）。
 * 顶部一条工具栏（折叠 / 展开会话区），下面按当前视图显示「审查」「文件树」或产物抽屉（技能 / 智能体 / 业务组件）。
 */
export function PreviewPanel(props: { projectId: string; sessionId?: string; working?: boolean }) {
  const t = useT()
  const panel = usePanel()
  // 新任务页没有审查视图
  const view = panel.view === "review" && !props.sessionId ? undefined : panel.view
  const diffs = useQuery({ queryKey: ["diff", props.sessionId], queryFn: () => fileService.diff(props.sessionId ?? ""), enabled: !!props.sessionId })
  const collapseLabel = t(panel.sessionCollapsed ? "command.session.expand" : "command.session.collapse")

  return (
    <>
      {view && (
        <div className="relative shrink-0 w-px h-full bg-[var(--neutral-100)]" />
      )}
      <div
        className={cx(
          "relative h-full flex flex-col overflow-hidden transition-opacity duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          view ? "flex-1 min-w-0" : "w-0 min-w-0 opacity-0 pointer-events-none",
        )}
      >
        {view && (
          <>
            <div className={cx("flex items-center justify-between pl-4.5 pr-6 py-3 shrink-0 border-l-[0px]", panel.drawer?.kind !== "agentConfig" && "border-b border-[var(--neutral-100)]")}>
              <div className="flex items-center gap-1">
                <Tooltip placement="bottom" value={collapseLabel} openDelay={300}>
                  <button
                    type="button"
                    className={cx(
                      "session-preview-header-icon p-0 border-none cursor-pointer inline-flex items-center justify-center outline-none transition-colors active:[--icon-fill:var(--icon-fill-active)]",
                      panel.sessionCollapsed ? "bg-[var(--icon-bg-active)] rounded-[6px]" : "bg-transparent",
                    )}
                    onClick={panel.toggleSessionCollapsed}
                    aria-label={collapseLabel}
                  >
                    <Icon size="small" name="drawer" className={cx(panel.sessionCollapsed && "text-[var(--icon-fill-active)]")} />
                  </button>
                </Tooltip>
              </div>
              {view === "drawer" && panel.drawer ? (
                <>
                  {panel.drawer.kind !== "agentConfig" && (
                    <span className="flex-1 min-w-0 px-2 text-[14px] font-medium leading-[22px] text-text-strong truncate" title={panel.drawer.title}>
                      {panel.drawer.title}
                    </span>
                  )}
                  {/* 右上角叠着页面级的图标栏（审查 / 文件树），关闭按钮往左让开 */}
                  {panel.drawer.kind !== "agentConfig" && <Tooltip placement="bottom" value={t("common.close")} openDelay={300} className="mr-[98px]">
                    <button
                      type="button"
                      className="session-preview-header-icon p-0 border-none bg-transparent cursor-pointer inline-flex items-center justify-center outline-none transition-colors"
                      onClick={panel.closeDrawer}
                      aria-label={t("common.close")}
                    >
                      <Icon size="small" name="close-small" />
                    </button>
                  </Tooltip>}
                </>
              ) : (
                <div />
              )}
            </div>
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {view === "review" && props.sessionId && (
                <div id="review-panel" className="flex-1 min-w-0 h-full bg-background-page">
                  <div data-component="tabs" data-variant="normal" data-orientation="horizontal" className="h-full flex flex-col">
                    <div className="shrink-0 flex">
                      <div data-slot="tabs-list" role="tablist">
                        <div data-slot="tabs-trigger-wrapper" data-value="review">
                          <button type="button" role="tab" aria-selected data-slot="tabs-trigger" data-value="review" data-selected="">
                            <div className="flex items-center gap-1">
                              <div>{t("session.tab.review")}</div>
                              <div>{diffs.data?.length ?? 0}</div>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <ReviewView sessionId={props.sessionId} onOpenFile={panel.openFile} />
                    </div>
                  </div>
                </div>
              )}
              {view === "drawer" && panel.drawer && (
                <div className="flex-1 min-w-0 h-full bg-background-page">
                  <DrawerView target={panel.drawer} working={!!props.working} />
                </div>
              )}
              {view === "wiki" && (
                <div className="flex-1 min-w-0 h-full bg-background-page p-5">
                  <div className="text-[16px] font-medium text-text-strong">{t("wiki.title")}</div>
                  <div className="mt-3 text-[12px] text-text-weak">{t("wiki.empty")}</div>
                </div>
              )}
              {view === "fileTree" && (
                <div className="flex-1 min-w-0 h-full">
                  <FileTreePane projectId={props.projectId} sessionId={props.sessionId} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

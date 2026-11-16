import { useState, type CSSProperties, type ReactNode } from "react"
import { BrandButton, Icon, Search, SegmentedControl, Tooltip, showToast } from "@/ui"
import { useT } from "@/i18n"

export interface DevPageLayoutProps {
  title: string
  addLabel?: string
  onAdd?: () => void
  /** 「新建」按钮变体：技能页用蓝色描边（secondary），其余默认实心（primary） */
  addVariant?: "primary" | "secondary"
  /** 渲染在「新建」按钮左侧的自定义操作区 */
  addBeforeAction?: ReactNode
  tabs: Array<{ value: string; label: string }>
  tab: string
  onTabChange: (value: string) => void
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  searchWrapperStyle?: CSSProperties
  onRefresh?: () => void | Promise<unknown>
  /** 工具栏下方的操作条（如技能页批量操作条），固定不随列表滚动 */
  subToolbar?: ReactNode
  children: ReactNode
}

/**
 * 技能 / 智能体 / 业务组件三个开发页共用的页面壳：
 * 顶部固定（标题、页签、刷新、搜索、新建），下方内容区滚动。业务逻辑留在各页面。
 */
export function DevPageLayout(props: DevPageLayoutProps) {
  const t = useT()
  const [spinning, setSpinning] = useState(false)
  const refreshLabel = t("session.files.refresh")

  // 刷新：约 600ms 的旋转动画，结束后 Toast 反馈；动画期间禁用，避免重复触发
  const refresh = async () => {
    if (spinning) return
    setSpinning(true)
    await Promise.resolve(props.onRefresh?.()).catch(() => undefined)
    setTimeout(() => {
      setSpinning(false)
      showToast({ variant: "success", title: t("kcode.devPage.refreshSuccess") })
    }, 600)
  }

  return (
    <div className="dev-page-layout size-full flex flex-col overflow-hidden">
      <div className="shrink-0 w-full">
        <div className="mx-auto flex w-full flex-col" style={{ maxWidth: 1200, padding: "0 40px 0 24px" }}>
          <div className="flex flex-col gap-2 pb-4">
            <div className="flex items-center" style={{ height: 52 }}>
              <h2 className="dev-page-title text-[20px] leading-9 text-text-strong" style={{ fontSize: 18, fontWeight: 500 }}>
                {props.title}
              </h2>
            </div>

            <div className="flex items-center justify-between">
              <SegmentedControl className="dev-page-tabs" value={props.tab} onChange={props.onTabChange} items={props.tabs} />
              <div className="flex items-center gap-3 ml-auto">
                {props.onRefresh && (
                  <Tooltip value={refreshLabel} placement="top" gutter={4}>
                    <button
                      type="button"
                      aria-label={refreshLabel}
                      disabled={spinning}
                      onClick={() => void refresh()}
                      className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[8px] border-none bg-transparent transition-colors hover:bg-surface-base-hover disabled:cursor-default [--icon-base:var(--icon-strong-base)]"
                    >
                      <Icon name="refresh" size="small" className={spinning ? "dev-page-refresh-spin" : ""} />
                    </button>
                  </Tooltip>
                )}
                <div className="flex items-center">
                  <Search
                    value={props.searchValue}
                    onChange={props.onSearchChange}
                    placeholder={props.searchPlaceholder}
                    wrapperStyle={props.searchWrapperStyle}
                  />
                </div>
                {(props.onAdd || props.addBeforeAction) && (
                  <div className="flex items-center gap-3">
                    {props.addBeforeAction}
                    {props.onAdd && (
                      <BrandButton variant={props.addVariant ?? "primary"} size="normal" icon="plus-fill" iconSize="xs" onClick={props.onAdd}>
                        {props.addLabel}
                      </BrandButton>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {props.subToolbar && (
        <div className="shrink-0 w-full">
          <div className="mx-auto w-full" style={{ maxWidth: 1200, padding: "0 40px 12px 24px" }}>
            {props.subToolbar}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* 顶部留 2px：卡片选中描边是外扩的 box-shadow，贴顶会被裁掉上边线 */}
        <div className="mx-auto flex min-h-full w-full flex-col" style={{ maxWidth: 1200, padding: "2px 40px 24px 24px" }}>
          {props.children}
        </div>
      </div>
    </div>
  )
}

export const DEV_GRID = "grid grid-cols-1 gap-4 pb-6 md:grid-cols-2 [@media(min-width:1100px)]:grid-cols-3"
export const DOT_BUTTON =
  "flex size-[28px] cursor-pointer items-center justify-center rounded-[8px] bg-transparent border-none transition-colors hover:bg-[var(--surface-base)] [--icon-base:var(--icon-strong-base)]"

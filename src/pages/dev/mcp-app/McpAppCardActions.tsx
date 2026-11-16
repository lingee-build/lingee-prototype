import { useState, type ReactNode } from "react"
import { DropdownMenu, Icon, Tooltip, type IconName } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { McpApp } from "@/mock/fixtures/dev"
import { useMcpAppActions, type McpAppBusy } from "@/features/mcp-app-detail/use-mcp-app-actions"

const DOT_BUTTON =
  "flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-[8px] bg-transparent border-none transition-colors hover:bg-[var(--surface-base)] [--icon-base:var(--icon-strong-base)]"

const Spinner = () => (
  <span
    style={{ display: "inline-block", width: 12, height: 12, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", flexShrink: 0 }}
  />
)

/**
 * 业务组件卡片的「…」菜单：预览 / 编辑 / 构建打包 / 测试 / 提交 / 删除。
 * 耗时操作不关菜单，在对应项后面转圈；成品包（没有源码）不能预览和构建打包，悬停说明原因。
 */
export function McpAppCardActions(props: { app: McpApp; onChanged: () => void }) {
  const t = useT()
  const { app } = props
  const [open, setOpen] = useState(false)
  const actions = useMcpAppActions(props.onChanged)
  const busy = actions.busy
  const dist = app.packageKind === "dist"

  const item = (icon: IconName, label: string, onSelect: () => void, loading?: McpAppBusy, disabled?: boolean) => (
    <DropdownMenu.Item
      disabled={!!busy || disabled}
      className="flex items-center cursor-pointer gap-1"
      onSelect={(e) => {
        // 耗时操作保持菜单打开，让用户看到进度
        if (loading) e.preventDefault()
        onSelect()
      }}
    >
      <Icon name={icon} size="small" />
      <span>{label}</span>
      {loading && busy === loading && <Spinner />}
    </DropdownMenu.Item>
  )
  const sourceOnly = (node: ReactNode, tip: string) =>
    dist ? (
      <Tooltip value={t(tip)} placement="right">
        {node}
      </Tooltip>
    ) : (
      node
    )

  return (
    <div
      className={cx(
        "flex items-center transition-opacity duration-150",
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu placement="bottom-start" open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger aria-label="more" className={DOT_BUTTON}>
          <Icon name="dot-grid" size="small" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content style={{ minWidth: 100 }}>
            {sourceOnly(item("play-triangle", t("kcode.mcpApp.action.preview"), () => actions.preview(app), undefined, dist), "kcode.mcpApp.action.previewTooltipDist")}
            {item("edit", t("kcode.mcpApp.action.edit"), () => actions.edit(app))}
            {sourceOnly(
              item("archive", t(app.buildStatus === "success" ? "kcode.mcpApp.action.repackage" : "kcode.mcpApp.action.package"), () => void actions.package(app), "package", dist),
              "kcode.mcpApp.action.packageTooltipDist",
            )}
            {item("test-flask", t("kcode.mcpApp.action.test"), () => void actions.test(app), "test")}
            {item("submit-upload", t("kcode.mcpApp.action.submit"), () => actions.submit(app))}
            <DropdownMenu.Item disabled={!!busy} onSelect={() => actions.remove(app)} className="group/delete flex items-center cursor-pointer gap-1" variant="destructive">
              <Icon name="trash-16" size="small" className="group-hover/delete:text-[var(--text-on-error-base)]" />
              <span className="group-hover/delete:text-[var(--text-on-error-base)]">{t("kcode.mcpApp.action.delete")}</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </div>
  )
}

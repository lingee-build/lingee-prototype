import { ContextMenu as Radix } from "radix-ui"
import { FileIcon, IconButton } from "@/ui"
import { useT } from "@/i18n"

function FileTab(props: {
  path: string
  selected: boolean
  nameColor?: string
  single: boolean
  last: boolean
  onSelect: () => void
  onClose: () => void
  onCloseOthers: () => void
  onCloseToRight: () => void
  onCloseAll: () => void
}) {
  const t = useT()
  const item = (label: string, onSelect: () => void) => (
    <Radix.Item data-slot="context-menu-item" onSelect={onSelect}>
      <div data-slot="context-menu-item-label">{label}</div>
    </Radix.Item>
  )
  return (
    <div className="relative">
      <div
        data-slot="tabs-trigger-wrapper"
        data-value={props.path}
        title={props.path}
        onAuxClick={(e) => {
          // 鼠标中键关闭标签
          if (e.button === 1) props.onClose()
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={props.selected}
          data-slot="tabs-trigger"
          data-value={props.path}
          data-selected={props.selected ? "" : undefined}
          onClick={props.onSelect}
        >
          <Radix.Root>
            <Radix.Trigger asChild>
              <div className="contents">
                <div className="flex items-center gap-1.5 min-w-0 font-[400]">
                  <FileIcon node={{ path: props.path, type: "file" }} className="size-4 shrink-0" />
                  <span className="truncate" style={{ color: props.nameColor }}>
                    {props.path.split("/").pop()}
                  </span>
                </div>
              </div>
            </Radix.Trigger>
            <Radix.Portal>
              <Radix.Content data-component="context-menu-content" className="kcode-ctx-content tab-ctx-content">
                {item(t("tabs.contextMenu.close"), props.onClose)}
                {!props.single && item(t("tabs.contextMenu.closeOthers"), props.onCloseOthers)}
                {!props.last && item(t("tabs.contextMenu.closeToRight"), props.onCloseToRight)}
                {item(t("tabs.contextMenu.closeAll"), props.onCloseAll)}
              </Radix.Content>
            </Radix.Portal>
          </Radix.Root>
        </button>
        <div data-slot="tabs-trigger-close-button" data-hidden>
          <IconButton icon="close-small" variant="ghost" className="h-5 w-5" onClick={props.onClose} aria-label={t("common.closeTab")} />
        </div>
      </div>
    </div>
  )
}

/** 文件标签条：可关闭、可右键（关闭 / 关闭其他 / 关闭右侧 / 全部关闭），文件名按变更类型着色 */
export function PanelTabs(props: {
  active?: string
  files: string[]
  fileColor: (path: string) => string | undefined
  onSelect: (path: string) => void
  onClose: (path: string) => void
  onCloseOthers: (path: string) => void
  onCloseToRight: (path: string) => void
  onCloseAll: () => void
}) {
  return (
    <div className="shrink-0 relative">
      <div data-slot="tabs-list" role="tablist">
        {props.files.map((path, index) => (
          <FileTab
            key={path}
            path={path}
            selected={props.active === path}
            nameColor={props.fileColor(path)}
            single={props.files.length === 1}
            last={index === props.files.length - 1}
            onSelect={() => props.onSelect(path)}
            onClose={() => props.onClose(path)}
            onCloseOthers={() => props.onCloseOthers(path)}
            onCloseToRight={() => props.onCloseToRight(path)}
            onCloseAll={props.onCloseAll}
          />
        ))}
      </div>
    </div>
  )
}

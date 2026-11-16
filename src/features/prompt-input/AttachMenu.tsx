import { Button, DropdownMenu, Icon, type IconName } from "@/ui"
import { useT } from "@/i18n"
import { usePrompt } from "@/stores/prompt"

function ModeItem(props: { mode: "spec" | "quest"; icon: IconName }) {
  const t = useT()
  const { mode, toggleMode } = usePrompt()
  return (
    <DropdownMenu.Item className="mode-card-item flex items-start justify-between gap-2 cursor-pointer" onSelect={() => toggleMode(props.mode)}>
      <span className="flex flex-col gap-[2px] min-w-0">
        <span className="flex items-center gap-2">
          <Icon name={props.icon} size="small" className="text-[var(--neutral-600)]" />
          <span className="text-[14px] font-[600] leading-[20px]">{t(`agent.name.${props.mode}`)}</span>
        </span>
        <span className="text-[12px] font-[400] leading-[16px] text-[var(--dropdown-fg-color-text-grouplabel)]">
          {t(`agent.desc.${props.mode}`)}
        </span>
      </span>
      {mode === props.mode && <Icon name="check" size="small" style={{ color: "var(--neutral-600, rgba(0,0,0,0.64))" }} className="mt-[2px]" />}
    </DropdownMenu.Item>
  )
}

/** 输入框左下角的「+」：上传文件 / 上传文件夹 / Spec 与 目标 两个互斥模式 */
export function AttachMenu(props: { placement: "top-start" | "bottom-start"; onPick: (folder: boolean) => void; restoreFocus: () => void }) {
  const t = useT()
  return (
    <DropdownMenu placement={props.placement} gutter={10}>
      <DropdownMenu.Trigger asChild>
        <Button
          data-action="prompt-attach"
          variant="ghost"
          className="size-9 p-0 rounded-[50%] hover:bg-[var(--neutral-50)] hover:[--icon-fill:var(--neutral-900)] [--icon-fill:var(--neutral-700)] bg-transparent border-none"
          aria-label={t("prompt.action.attachFile")}
        >
          <Icon name="plus" className="size-9" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content onCloseAutoFocus={(event) => { event.preventDefault(); props.restoreFocus() }} className="min-w-[260px] p-1 rounded-[16px] flex flex-col gap-[2px]">
          <DropdownMenu.Item
            className="flex items-center gap-1 px-2 cursor-pointer text-[var(--neutral-700)]"
            onSelect={() => props.onPick(false)}
          >
            <Icon name="attachment" size="small" className="text-[var(--neutral-600)]" />
            <span className="text-[14px] font-[400] leading-[20px]">{t("prompt.tools.upload")}</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex items-center gap-1 px-2 cursor-pointer text-[var(--neutral-700)]"
            onSelect={() => props.onPick(true)}
          >
            <Icon name="folder-16" size="small" className="text-[var(--neutral-600)]" />
            <span className="text-[14px] font-[400] leading-[20px]">{t("prompt.tools.uploadFolder")}</span>
          </DropdownMenu.Item>
          <div style={{ display: "flex", padding: "0 8px", flexDirection: "column", alignItems: "flex-start", alignSelf: "stretch" }}>
            <DropdownMenu.Separator className="mx-0 w-full" />
          </div>
          <ModeItem mode="spec" icon="spec" />
          <ModeItem mode="quest" icon="goal" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}

import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { TabProps } from "./form"

/**
 * 「角色设定」页签：一个随内容长高的大文本框，超出面板高度后在框内滚动。
 * 高度自适应用的是 CSS Grid 镜像：不可见的镜像 div 与 textarea 叠在同一格，由镜像撑开行高。
 */
export function RoleSettingsTab(props: TabProps) {
  const t = useT()
  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="relative min-h-0" style={{ maxHeight: "calc(100% - 32px)" }}>
        <div
          className={cx(
            "agent-config-editor border border-[var(--border-weak-base)] bg-[var(--input-base)] overflow-y-auto no-scrollbar transition-colors duration-150 max-h-full h-full",
            !props.readonly && "hover:border-[var(--border-base)] focus-within:border-[var(--border-selected)]",
          )}
        >
          <div className="grid">
            <div
              aria-hidden="true"
              className="invisible whitespace-pre-wrap break-words pt-3 px-3 pb-3.5 text-[14px] leading-5 font-sans font-normal pointer-events-none [grid-area:1/1/2/2]"
              style={{ minHeight: 120 }}
            >
              {`${props.form.role} `}
            </div>
            <textarea
              readOnly={props.readonly}
              value={props.form.role}
              onChange={(e) => props.set({ role: e.currentTarget.value })}
              placeholder={t("kcode.agentConfig.role.placeholder")}
              className="w-full resize-none bg-transparent border-none outline-none p-3 text-[14px] leading-5 font-sans font-normal text-text-strong placeholder:text-text-weak [grid-area:1/1/2/2]"
              style={{ overflow: "hidden" }}
            />
          </div>
        </div>
      </div>
      <span className="shrink-0 text-12-regular text-text-weak">{t("kcode.agentConfig.role.hint")}</span>
    </div>
  )
}

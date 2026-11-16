import { useRef } from "react"
import { publicUrl } from "@/lib/public-url"
import { useT } from "@/i18n"
import { pickAvatar } from "./form"

/** 头像在基础信息中编辑；选择文件只更新表单，随「保存」一起提交。 */
export function AgentAvatarPicker(props: { agentId: string; value?: string; disabled?: boolean; onChange: (value: string) => void }) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)

  return (
    <>
      <button
        type="button"
        className="agent-header-avatar group relative flex size-10 shrink-0 items-center justify-center rounded-full enabled:cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-selected)]"
        disabled={props.disabled}
        aria-label={t("kcode.agentConfig.basic.changeAvatar")}
        title={t("kcode.agentConfig.basic.changeAvatar")}
        onClick={() => input.current?.click()}
      >
        <img src={publicUrl(props.value || pickAvatar(props.agentId))} alt="" className="size-full rounded-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m14 5 5 5M4 20l4-1 12-12a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /></svg>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file) {
            const reader = new FileReader()
            reader.onload = () => props.onChange(String(reader.result))
            reader.readAsDataURL(file)
          }
          event.currentTarget.value = ""
        }}
      />
    </>
  )
}

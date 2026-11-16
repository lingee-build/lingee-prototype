import { FileIcon, Icon, Tooltip } from "@/ui"
import { useT } from "@/i18n"

export interface Attachment { id: string; file: File; url?: string }
const size = (bytes: number) => bytes < 1024 ? `${bytes}B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`

/** File and image cards use Build's image-attachments.tsx dimensions and slots. */
export function Attachments(props: { items: Attachment[]; onRemove: (id: string) => void }) {
  const t = useT()
  if (!props.items.length) return null
  const mixed = props.items.some((item) => !item.url)
  return (
    <div data-component="prompt-attachments" className="relative pt-4 px-4">
      <div className="no-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto pb-3">
        {props.items.map((item) => (
          <Tooltip key={item.id} value={item.file.name} placement="top" contentClass="break-all">
            <div className={item.url && !mixed ? "relative group shrink-0" : "relative group flex items-center gap-1 shrink-0 h-[48px] w-[170px] rounded-[16px] bg-[var(--neutral-50)] px-1 py-1"}>
              {item.url ? <img src={item.url} alt={item.file.name} className={mixed ? "size-10 shrink-0 rounded-[8px] object-cover" : "size-14 shrink-0 rounded-[12px] object-cover"} /> : <FileIcon node={{path: item.file.name, type: "file"}} className="size-8 shrink-0" />}
              {(!item.url || mixed) && <div className="min-w-0 flex-1">
                <div className="h-4.5 leading-[18px] text-[12px] text-[var(--neutral-700)] truncate">{item.file.name}</div>
                <div className="h-[18px] leading-[18px] text-[12px] font-normal text-[var(--neutral-400)]">{item.file.name.split('.').at(-1)?.toLowerCase()}·{size(item.file.size)}</div>
              </div>}
              <button type="button" onClick={() => props.onRemove(item.id)} className="absolute top-1 right-1 size-3.5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer" aria-label={`${t("prompt.attachment.remove")} ${item.file.name}`}><Icon name="remove-file" containerClass="!size-3.5" size="small" /></button>
            </div>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}

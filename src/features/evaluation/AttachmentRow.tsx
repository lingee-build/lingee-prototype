import { Icon } from "@/ui"
import type { EvalAttachment } from "@/services/evaluation"

export function AttachmentRow({ file, download, remove }: { file: EvalAttachment; download: () => void; remove?: () => void }) {
  return <div className="eval-file-row">
    <Icon name="attachment" size="small" />
    <button type="button" className="eval-file-name" title={`下载 ${file.name}`} aria-label={`下载 ${file.name}`} onClick={download}>{file.name}</button>
    <span className="eval-muted eval-file-size">{Math.max(1, Math.ceil(file.size / 1024))} KB</span>
    {remove && <button type="button" className="eval-file-remove" aria-label={`移除附件 ${file.name}`} onClick={remove}>移除</button>}
  </div>
}

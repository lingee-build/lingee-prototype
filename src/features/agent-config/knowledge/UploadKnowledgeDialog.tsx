import { useRef, useState } from "react"
import { Dialog, Icon, showToast, useDialog } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { sleep } from "@/mock/latency"
import { fileExtension, fmtFileSize, getFileTypeColor } from "./shared"

const MAX_BYTES = 50 * 1024 * 1024
const ACCEPT = ".txt,.csv,.md,.json,.yaml,.yml,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.html"

/** 新增知识弹窗：拖拽或选择文件，上传后先存为个人知识（待审核） */
export function UploadKnowledgeDialog(props: { existing: string[]; onConfirm: (files: File[]) => void }) {
  const t = useT()
  const dialog = useDialog()
  const input = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<number>()
  const uploading = progress !== undefined

  const addFiles = (list: FileList) => {
    const picked = Array.from(list)
    const allowed = ACCEPT.split(",")
    const valid = picked.filter((file) => allowed.includes(`.${fileExtension(file.name).toLowerCase()}`) && file.size <= MAX_BYTES)
    if (valid.length < picked.length) showToast({ variant: "warning", title: t("kcode.agentKnowledge.uploadFormats", { size: MAX_BYTES / 1024 / 1024 }) })
    const fresh = valid.filter((file) => !props.existing.includes(file.name) && !files.some((x) => x.name === file.name))
    if (fresh.length < valid.length) showToast({ variant: "warning", title: t("kcode.agentKnowledge.duplicateFile") })
    setFiles((prev) => [...prev, ...fresh])
  }

  const confirm = async () => {
    // 逐个「上传」，按钮上显示进度
    await files.reduce((chain, _, i) => chain.then(() => (setProgress(i + 1), sleep(450))), Promise.resolve())
    props.onConfirm(files)
    dialog.close()
  }

  return (
    <Dialog fit title={t("kcode.agentKnowledge.uploadDialogTitle")}>
      <div className="flex flex-col min-h-0 flex-1">
        <div className="flex flex-col min-h-0 flex-1 overflow-y-auto" style={{ padding: "0 24px" }}>
          <div className="mb-4 rounded-[16px] px-[11px] py-[9px] flex items-center gap-2 border shrink-0 bg-[var(--primary-50)] border-[var(--primary-200)]">
            <Icon name="info-fill" size="small" className="size-5 shrink-0 text-[var(--primary-600)]" />
            <span className="text-[14px] leading-[20px] text-[var(--gray-800)]">{t("kcode.agentKnowledge.uploadHelp")}</span>
          </div>
          <div
            className={cx(
              "shrink-0 rounded-[12px] border-[1.5px] border-dashed text-center cursor-pointer transition-all",
              dragging ? "border-[#2f7bff] bg-[color-mix(in_srgb,var(--primary-600)_10%,transparent)]" : "border-[var(--border-weak-base)] bg-[var(--surface-base)] hover:border-[#2f7bff] hover:bg-[color-mix(in_srgb,var(--primary-600)_10%,transparent)]",
            )}
            style={{ padding: "32px 20px" }}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
            }}
          >
            <div className="flex items-center justify-center text-text-weak" style={{ marginBottom: 12 }}>
              <Icon name="cloud-upload" size="large" containerClass="text-text-weak" />
            </div>
            <div className="text-[16px] font-semibold text-text-strong" style={{ marginBottom: 10 }}>
              {t("kcode.agentKnowledge.dropzone")}
            </div>
            <div className="text-[13px] text-text-weak mx-auto" style={{ lineHeight: 1.7, maxWidth: 440 }}>
              {t("kcode.agentKnowledge.uploadFormats", { size: MAX_BYTES / 1024 / 1024 })}
            </div>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              accept={ACCEPT}
              onChange={(e) => {
                if (e.currentTarget.files?.length) addFiles(e.currentTarget.files)
                e.currentTarget.value = ""
              }}
            />
          </div>
          <div className={cx("flex flex-col gap-2 shrink-0", files.length > 5 && "max-h-[300px] overflow-y-auto")} style={{ marginTop: 14 }}>
            {files.map((file, index) => (
              <div key={file.name} className="flex items-center gap-2.5 border border-[var(--border-weak-base)] rounded-[10px] bg-[var(--surface-raised-stronger-non-alpha)]" style={{ padding: "9px 12px" }}>
                <span
                  className="w-8 h-8 rounded-[7px] shrink-0 flex items-center justify-center text-[9px] font-bold text-[#fff]"
                  style={{ background: getFileTypeColor(fileExtension(file.name)) }}
                >
                  {fileExtension(file.name).toUpperCase().slice(0, 4)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-text-strong truncate" title={file.name}>
                    {file.name}
                  </div>
                  <div className="text-[11px] text-text-weak" style={{ marginTop: 2 }}>
                    {fmtFileSize(file.size)}
                  </div>
                </div>
                <span
                  className={cx("shrink-0 text-text-weak", uploading ? "opacity-40 cursor-default" : "cursor-pointer hover:text-[#e05a5a]")}
                  onClick={() => !uploading && setFiles((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Icon name="close-small" size="small" containerClass="text-text-weak hover:text-[#e05a5a]" />
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end shrink-0" style={{ padding: "16px 24px 20px", gap: 12 }}>
          <span className="mr-auto text-[13px] text-text-weak">
            {files.length ? t("kcode.agentKnowledge.selectedFiles", { count: files.length }) : t("kcode.agentKnowledge.noFileSelected")}
          </span>
          <button
            type="button"
            className={cx(
              "h-9 rounded-[20px] text-[14px] font-semibold bg-[var(--surface-raised-stronger-non-alpha)] text-text-base border border-[var(--border-weak-base)] hover:bg-[var(--surface-base)]",
              uploading ? "opacity-50 cursor-default" : "cursor-pointer",
            )}
            style={{ padding: "0 22px" }}
            disabled={uploading}
            onClick={dialog.close}
          >
            {t("kcode.agentKnowledge.cancel")}
          </button>
          <button
            type="button"
            className={cx(
              "h-9 rounded-[20px] text-[14px] font-semibold bg-[#2f7bff] text-[#fff] border border-[#2f7bff]",
              uploading || !files.length ? "opacity-50 cursor-default" : "cursor-pointer hover:bg-[#1f6cf0]",
            )}
            style={{ padding: "0 22px" }}
            disabled={uploading || !files.length}
            onClick={() => void confirm()}
          >
            {uploading ? t("kcode.agentKnowledge.uploading", { current: progress, total: files.length }) : t("kcode.agentKnowledge.confirm")}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

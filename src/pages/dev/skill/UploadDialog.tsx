import { useRef, useState } from "react"
import { BrandButton, Dialog, DropdownMenu, Icon, IconButton, useDialog } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { sleep } from "@/mock/latency"
import { useSync } from "@/stores/sync"

const ACCEPT = ".zip,.tar.gz,application/zip,application/gzip,application/x-gzip,application/x-compressed"

const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)

/** 上传技能包：选目标项目 → 选 / 拖入压缩包 → 导入并检测（导入后跳到会话里做合规检测） */
export function UploadDialog(props: { defaultProjectId?: string; onUploaded: (file: File, projectId: string) => void }) {
  const t = useT()
  const dialog = useDialog()
  const projects = useSync((s) => s.projects)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [projectId, setProjectId] = useState(props.defaultProjectId ?? projects[0]?.id ?? "")
  const [menuWidth, setMenuWidth] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const projectName = projects.find((x) => x.id === projectId)?.name ?? ""

  const upload = async () => {
    if (!file) return
    setLoading(true)
    await sleep(900)
    dialog.close()
    props.onUploaded(file, projectId)
  }

  return (
    <Dialog fit className="w-[560px] !self-center !rounded-[24px] overflow-hidden shadow-[0px_6px_12px_rgba(0,0,0,0.08)]">
      <IconButton icon="remove-dialog" variant="ghost" aria-label={t("ui.common.close")} className="absolute right-4 top-4 z-10 size-9 rounded-xl" onClick={dialog.close} />
      <div className="flex flex-col gap-5 px-6 pt-5 pb-6">
        <div className="flex flex-col gap-2">
          <span className="text-14-medium text-text-strong">{t("kcode.skillDev.upload.importToProject")}</span>
          <DropdownMenu
            placement="bottom"
            gutter={4}
            onOpenChange={(open) => {
              // +2px 补偿触发器两侧 1px 边框，让菜单与触发器外框等宽
              if (open && trigger.current) setMenuWidth(trigger.current.getBoundingClientRect().width + 2)
            }}
          >
            <DropdownMenu.Trigger
              ref={trigger}
              className="flex h-9 w-full cursor-pointer items-center justify-between rounded-2xl border border-[var(--border-weak-base)] bg-[var(--input-base)] px-3 transition-colors duration-150 hover:border-[var(--border-base)] [&[data-expanded]]:border-[var(--border-selected)]"
            >
              <span className="truncate text-[14px] leading-5 font-normal text-text-strong" title={projectName}>
                {projectName}
              </span>
              <Icon name="chevron-down" size="small" className="text-text-weak shrink-0" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="domain-select-menu" style={{ minWidth: menuWidth, width: menuWidth }}>
                {projects.map((project) => (
                  <DropdownMenu.Item key={project.id} onSelect={() => setProjectId(project.id)}>
                    <DropdownMenu.ItemLabel className="truncate text-text-strong">{project.name}</DropdownMenu.ItemLabel>
                    {projectId === project.id && (
                      <span data-slot="dropdown-menu-item-indicator">
                        <Icon name="check" size="small" className="text-[var(--neutral-600)]" />
                      </span>
                    )}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu>
        </div>

        <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)} />
        {file ? (
          <div className="flex h-[140px] items-center gap-3 rounded-[16px] border-2 border-dotted border-[var(--primary-200)] bg-[var(--primary-50)] px-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--primary-100)]">
              <Icon name="folder-plus-24" size="normal" className="text-[var(--primary-600)]" />
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-hidden">
              <span className="truncate text-[14px] font-medium leading-[22px] text-text-strong" title={file.name}>
                {file.name}
              </span>
              <span className="text-[12px] leading-[18px] text-text-weak">
                {formatSize(file.size)} · {file.name.endsWith(".tar.gz") ? "TAR.GZ" : "ZIP"}
              </span>
            </div>
            <button
              type="button"
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-text-weak transition-colors hover:bg-[var(--surface-base)] hover:text-text-strong"
              onClick={() => setFile(null)}
            >
              <Icon name="close-small" size="medium" />
            </button>
          </div>
        ) : (
          <div
            className={cx(
              "group flex h-[140px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[16px] border-2 border-dotted transition-colors hover:border-[var(--primary-200)] hover:bg-[var(--primary-50)]",
              dragOver ? "border-[var(--primary-200)] bg-[var(--primary-50)]" : "border-[var(--border-weak-base)]",
            )}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              setFile(e.dataTransfer.files[0] ?? null)
            }}
          >
            <Icon
              name="folder-plus-24"
              size="medium"
              className={cx("transition-colors", dragOver ? "text-[var(--primary-600)]" : "text-text-weak group-hover:text-[var(--primary-600)]")}
            />
            <span
              className={cx("transition-colors", dragOver ? "text-[var(--primary-600)]" : "text-text-strong group-hover:text-[var(--primary-600)]")}
              style={{ fontSize: 14, fontWeight: 400 }}
            >
              {t("kcode.skillDev.upload.dropzone.title")}
            </span>
            <span
              className={cx("transition-colors", dragOver ? "text-[var(--primary-300)]" : "text-[var(--neutral-500)] group-hover:text-[var(--primary-300)]")}
              style={{ fontSize: 12, fontWeight: 400, lineHeight: "18px" }}
            >
              {t("kcode.skillDev.upload.dropzone.hint")}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-14-medium text-text-strong">{t("kcode.skillDev.upload.requirements.title")}</span>
          <ul className="flex flex-col gap-1 pl-5 text-13-regular text-text-weak list-disc">
            <li>{t("kcode.skillDev.upload.requirements.item1")}</li>
            <li>{t("kcode.skillDev.upload.requirements.item2")}</li>
          </ul>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            className="h-[36px] w-[80px] cursor-pointer rounded-[8px] border-none bg-transparent px-4 text-[14px] text-[var(--neutral-600)] transition-colors hover:bg-[var(--surface-base-hover)]"
            disabled={loading}
            onClick={dialog.close}
          >
            {t("kcode.skillDev.action.cancel")}
          </button>
          <BrandButton className="px-2" variant="primary" size="normal" disabled={!file || loading} onClick={() => void upload()}>
            {t("kcode.skillDev.upload.uploadAndDetect")}
          </BrandButton>
        </div>
      </div>
    </Dialog>
  )
}

import { useRef, useState } from "react"
import { BrandButton, Dialog, DropdownMenu, Icon, showToast, useDialog } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { McpApp } from "@/mock/fixtures/dev"
import { mcpAppService } from "@/services"
import { useSync } from "@/stores/sync"

interface Analysis {
  kind: "dist" | "source" | "unknown"
  /** 包里的 info.json 给出的 appCode；源码包可能没有 */
  appCode: string
}

/**
 * 原型里不真的解压，按文件名猜包类型：名字带 dist 的当成品包，其余当源码包；
 * 名字以 kdcloud_ 开头视为带了 info.json（能读到 appCode），空文件视为无法识别。
 */
const analyze = (file: File): Analysis => {
  const base = file.name.replace(/\.zip$/i, "")
  if (file.size === 0) return { kind: "unknown", appCode: "" }
  const appCode = /^kdcloud_/.test(base) ? base.replace(/[-.]?dist$/i, "").replace(/[^a-zA-Z0-9_]/g, "_") : ""
  if (/dist/i.test(base)) return { kind: "dist", appCode: appCode || `kdcloud_scm_${base.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase()}` }
  return { kind: "source", appCode }
}

const formatFileSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

/**
 * 导入业务组件弹窗：选目标项目 + 拖入 / 选择 zip。
 * 成品包直接标记为已构建；源码包若没带 info.json，需要补一段自定义的 appCode。
 */
export function McpAppUploadDialog(props: { current?: string; onUploaded: () => void }) {
  const t = useT()
  const dialog = useDialog()
  const projects = useSync((s) => s.projects)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [width, setWidth] = useState(0)
  const [selected, setSelected] = useState(props.current ?? projects[0]?.id ?? "")
  const [file, setFile] = useState<File>()
  const [custom, setCustom] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const analysis = file ? analyze(file) : undefined
  const needCustom = analysis?.kind === "source" && !analysis.appCode
  const customValid = /^[a-zA-Z0-9_]{5,}$/.test(custom)
  const projectName = (id: string) => `${projects.find((x) => x.id === id)?.name ?? id}${id === props.current ? t("kcode.mcpApp.upload.currentSuffix") : ""}`

  const pick = (picked?: File) => {
    if (!picked) return
    if (!/\.zip$/i.test(picked.name)) return showToast({ variant: "warning", title: t("kcode.mcpApp.upload.invalidFile") })
    setCustom("")
    setFile(picked)
    if (analyze(picked).kind === "unknown") showToast({ variant: "warning", title: t("kcode.mcpApp.upload.error.unknownPackage") })
  }

  const upload = async () => {
    if (!file || !analysis || analysis.kind === "unknown") return
    setLoading(true)
    const appCode = analysis.appCode || `kdcloud_scm_${custom}`
    const now = new Date().toISOString()
    const built = analysis.kind === "dist"
    const app: McpApp = {
      appCode,
      appName: appCode,
      appDescription: "",
      projectId: selected,
      mcpStatus: "",
      buildStatus: built ? "success" : null,
      tested: false,
      packageKind: analysis.kind,
      version: "1.0.0",
      artifacts: built ? [{ version: "1.0.0", createdAt: now, changeDesc: "" }] : [],
      info: built ? { cloud: "kdcloud", domain: "scm", appCode, appName: appCode, runMode: "message", version: "1.0.0" } : null,
    }
    await mcpAppService.create(app)
    setLoading(false)
    showToast({ variant: "success", title: t(built ? "kcode.mcpApp.upload.success" : "kcode.mcpApp.upload.successImport") })
    props.onUploaded()
    dialog.close()
  }

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept=".zip,application/zip,application/x-zip-compressed"
      className="hidden"
      onChange={(e) => {
        pick(e.currentTarget.files?.[0])
        e.currentTarget.value = ""
      }}
    />
  )

  return (
    <Dialog fit className="w-[560px] !self-center !rounded-[24px] overflow-hidden shadow-[0px_6px_12px_rgba(0,0,0,0.08)]">
      <div className="flex flex-col gap-5 px-6 pt-5 pb-6">
        <div className="flex flex-col gap-2">
          <span className="text-14-medium text-text-strong">{t("kcode.mcpApp.upload.importToProject")}</span>
          <DropdownMenu placement="bottom" gutter={4} onOpenChange={(open) => open && trigger.current && setWidth(trigger.current.getBoundingClientRect().width)}>
            <DropdownMenu.Trigger
              ref={trigger}
              className="flex h-9 w-full cursor-pointer items-center justify-between rounded-2xl border border-[var(--border-weak-base)] bg-[var(--input-base)] px-3 transition-colors duration-150 hover:border-[var(--border-base)] [&[data-expanded]]:border-[var(--border-selected)]"
            >
              <span className="truncate text-[14px] leading-5 font-normal text-text-strong">{projectName(selected)}</span>
              <Icon name="chevron-down" size="small" className="text-text-weak shrink-0" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="!z-[10001]" style={{ minWidth: width, width }}>
                {projects.map((project) => (
                  <DropdownMenu.Item key={project.id} onSelect={() => setSelected(project.id)}>
                    <DropdownMenu.ItemLabel className="truncate text-text-strong">{projectName(project.id)}</DropdownMenu.ItemLabel>
                    {selected === project.id && (
                      <DropdownMenu.ItemIndicator>
                        <Icon name="check" size="small" className="text-[var(--neutral-600)]" />
                      </DropdownMenu.ItemIndicator>
                    )}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu>
        </div>

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
                {formatFileSize(file.size)}
                {analysis && analysis.kind !== "unknown" && ` · ${t(`kcode.mcpApp.upload.kind.${analysis.kind}`)}`}
              </span>
            </div>
            <button
              type="button"
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-text-weak transition-colors hover:bg-[var(--surface-base)] hover:text-text-strong"
              onClick={() => setFile(undefined)}
            >
              <Icon name="close-small" size="medium" />
            </button>
            {fileInput}
          </div>
        ) : (
          <div
            className={cx(
              "group flex h-[140px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[16px] border-2 border-dotted border-[var(--border-weak-base)] transition-colors hover:border-[var(--primary-200)] hover:bg-[var(--primary-50)]",
              dragOver && "border-[var(--primary-200)] bg-[var(--primary-50)]",
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
              pick(e.dataTransfer.files[0])
            }}
          >
            {fileInput}
            <Icon name="folder-plus-24" size="medium" className="text-text-weak group-hover:text-[var(--primary-600)]" />
            <span className="text-text-strong group-hover:text-[var(--primary-600)]" style={{ fontSize: 14, fontWeight: 400 }}>
              {t("kcode.mcpApp.upload.dropzone.title")}
            </span>
            <span className="text-[var(--neutral-500)] group-hover:text-[var(--primary-300)] leading-[18px]" style={{ fontSize: 12, fontWeight: 400 }}>
              {t("kcode.mcpApp.upload.dropzone.hint")}
            </span>
          </div>
        )}

        {needCustom && (
          <div className="flex flex-col gap-1.5">
            <span className="text-14-medium text-text-strong">{t("kcode.mcpApp.upload.appCode.label")}</span>
            <input
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.currentTarget.value)}
              placeholder="myapp"
              className="h-9 rounded-2xl border border-[var(--border-weak-base)] bg-[var(--input-base)] px-3 text-[14px] text-text-strong outline-none transition-colors focus:border-[var(--border-selected)]"
            />
            <span className="text-[12px] leading-[18px] text-[var(--neutral-500)]">{t("kcode.mcpApp.upload.appCode.hint")}</span>
            {custom && !customValid && <span className="text-[12px] leading-[18px] text-[var(--danger-600)]">{t("kcode.mcpApp.upload.appCode.invalid")}</span>}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-14-medium text-text-strong">{t("kcode.mcpApp.upload.requirements.title")}</span>
          <ul className="flex flex-col gap-1 pl-5 text-13-regular text-text-weak list-disc">
            <li>{t("kcode.mcpApp.upload.requirements.item1")}</li>
            <li>{t("kcode.mcpApp.upload.requirements.item2")}</li>
            <li>{t("kcode.mcpApp.upload.requirements.item3")}</li>
          </ul>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            className="h-[34px] cursor-pointer rounded-[8px] border-none bg-transparent px-4 text-[14px] text-[var(--neutral-600)] transition-colors hover:bg-[var(--surface-base-hover)]"
            disabled={loading}
            onClick={dialog.close}
          >
            {t("kcode.mcpApp.upload.cancel")}
          </button>
          <BrandButton variant="primary" size="normal" disabled={!file || loading || analysis?.kind === "unknown" || (needCustom && !customValid)} onClick={() => void upload()}>
            {t("kcode.mcpApp.upload.confirm")}
          </BrandButton>
        </div>
      </div>
    </Dialog>
  )
}

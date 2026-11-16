import { useRef, useState } from "react"
import { Dialog as Radix } from "radix-ui"
import { Dialog, Icon, showToast, useDialog } from "@/ui"
import { useT } from "@/i18n"
import type { Skill } from "@/mock/fixtures/dev"
import { useSync } from "@/stores/sync"
import { usePersonalSkills, type InstallInput } from "@/stores/personal-skills"

/** 来源已定：技能开发页卡片菜单进入（US-2026-082714） */
export type ProjectSkillSource = { kind: "project"; skill: Skill }
/** 来源待选：设置页「+ 安装技能」进入（现状入口），原型用固定演示目录模拟选择 */
export type LocalDirSource = { kind: "local" }
export type InstallSource = ProjectSkillSource | LocalDirSource

/** 线上同款安装状态机（settings-skills.tsx 的 InstallState） */
type InstallState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "ready"; name: string; conflict: boolean }
  | { phase: "installing" }
  | { phase: "done" }
  | { phase: "error"; message: string }

/** local 模式演示选择：点「选择文件夹 / 选择文件」后填入的数据（模拟服务端读 SKILL.md） */
const DEMO_PICK: InstallInput & { path: string } = {
  name: "mo-solution-design",
  displayName: "mo-solution-design",
  desc: "生成企业级解决方案 PPT 大纲，适用于产品、客户、行业解决方案与培训演示场景。",
  projectId: "downloads",
  projectName: "本地目录",
  path: "/Users/kingdee/Downloads/mo-solution-design",
}

const MAX_FILE_SIZE = 50 * 1024 * 1024

const isValidFile = (f: File) => /\.(zip|tar\.gz)$/i.test(f.name)

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const fileFormatLabel = (t: (key: string) => string, f: File) =>
  /\.tar\.gz$/i.test(f.name) ? t("settings.skills.install.fileCard.tarGzFormat") : t("settings.skills.install.fileCard.zipFormat")

/**
 * 「安装个人技能」弹窗：按线上 settings-skills.tsx 的 DialogInstallSkill 移植，
 * 结构、样式、文案、状态机与线上一致（idle → checking → ready+conflict → installing → done）。
 * 卡片菜单进来时只有来源不同：目录已填入该技能所在的工程 skills 子目录，不可改选、无移除按钮。
 */
export function InstallPersonalSkillDialog(props: { source: InstallSource }) {
  const t = useT()
  const { close } = useDialog()
  const items = usePersonalSkills((s) => s.items)
  const install = usePersonalSkills((s) => s.install)

  // project 来源：目录已定（工程目录下该技能的 skills 子目录）
  const skill = props.source.kind === "project" ? props.source.skill : undefined
  const project = useSync((s) => (skill ? s.projects.find((x) => x.id === skill.projectId) : undefined))
  const fixedDir =
    props.source.kind === "project" && project ? `${project.worktree}/skills/${props.source.skill.name}` : ""

  const [sourceDir, setSourceDir] = useState(fixedDir)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [overwrite, setOverwrite] = useState(false)
  const [state, setState] = useState<InstallState>({ phase: "idle" })
  const fileInput = useRef<HTMLInputElement>(null)

  const isLoading = state.phase === "checking" || state.phase === "installing"
  const hasSource = !!file || !!sourceDir.trim()

  const handleFile = (f: File | undefined) => {
    if (!f) return
    if (!isValidFile(f)) {
      showToast({ variant: "warning", title: t("settings.skills.install.error.invalidFile") })
      return
    }
    if (f.size > MAX_FILE_SIZE) {
      showToast({ variant: "warning", title: t("settings.skills.install.error.fileTooLarge") })
      return
    }
    setFile(f)
    setSourceDir("")
    setOverwrite(false)
    setState({ phase: "idle" })
  }

  // 线上走 bridge.selectFolder；原型无宿主桥，固定返回演示目录
  const selectFolder = () => {
    setSourceDir(DEMO_PICK.path)
    setFile(null)
    setOverwrite(false)
    setState({ phase: "idle" })
  }

  /** 安装写入的数据：project 来源用技能本身，local 来源用演示数据（模拟服务端读 SKILL.md） */
  const installInput = (): InstallInput | null => {
    if (props.source.kind === "project") {
      if (!skill) return null
      return {
        name: skill.name,
        displayName: skill.displayName,
        desc: skill.desc,
        projectId: skill.projectId,
        projectName: project?.name ?? t("proto.personalInstall.unknownProject"),
      }
    }
    return hasSource ? DEMO_PICK : null
  }

  const installRequest = async (overwriteInstall: boolean) => {
    const input = installInput()
    if (!input) return
    setState({ phase: overwriteInstall ? "installing" : "checking" })
    // 原型用短延时模拟 POST /skill/install
    await new Promise((resolve) => setTimeout(resolve, overwriteInstall ? 700 : 500))
    if (!overwriteInstall) {
      // 409 同名：进入 ready + conflict，弹窗不关，等用户勾选覆盖
      if (items.some((x) => x.name === input.name)) {
        setState({ phase: "ready", name: input.name, conflict: true })
        return
      }
    }
    // 200：写入个人技能库（覆盖沿用原启用状态），提示并关闭
    install(input)
    setState({ phase: "done" })
    showToast({ variant: "success", title: t("settings.skills.install.success") })
    close()
  }

  const ready = state.phase === "ready" ? state : undefined
  const showConflict = ready?.conflict === true

  return (
    <Dialog
      fit
      customHeader
      className="w-[480px] !self-center !rounded-[24px] overflow-hidden shadow-[0px_6px_12px_rgba(0,0,0,0.08)]"
    >
      <div className="flex flex-col gap-4 px-5 pt-5 pb-6">
        <Radix.Title asChild>
          <span className="text-16-medium text-text-strong">{t("settings.skills.install.title")}</span>
        </Radix.Title>

        {/* Dropzone / File card / Folder display（照线上结构；project 来源目录已定、无移除按钮） */}
        {file ? (
          <div className="flex h-[140px] items-center gap-3 rounded-[16px] border-2 border-dotted border-[var(--primary-200)] bg-[var(--icon-bg-hover)] px-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--icon-bg-hover)]">
              <Icon name="folder-plus-24" size="normal" className="text-[var(--primary-600)]" />
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-hidden">
              <span className="truncate text-[14px] font-medium leading-[22px] text-text-strong">{file.name}</span>
              <span className="text-[12px] leading-[18px] text-text-weak">
                {formatFileSize(file.size)} · {fileFormatLabel(t, file)}
              </span>
            </div>
            <button
              type="button"
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-text-weak transition-colors hover:bg-[var(--icon-bg-hover)] hover:text-text-strong"
              onClick={() => {
                setFile(null)
                setState({ phase: "idle" })
              }}
              disabled={isLoading}
            >
              <Icon name="close-small" size="medium" />
            </button>
          </div>
        ) : sourceDir.trim() ? (
          <div className="flex h-[140px] items-center gap-3 rounded-[16px] border-2 border-dotted border-[var(--primary-200)] bg-[var(--icon-bg-hover)] px-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--icon-bg-hover)]">
              <Icon name="folder-plus-24" size="normal" className="text-[var(--primary-600)]" />
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-hidden">
              <span className="truncate text-[14px] font-medium leading-[22px] text-text-strong">
                {sourceDir.split(/[\\/]/).pop() || sourceDir}
              </span>
              <span className="truncate text-[12px] leading-[18px] text-text-weak">{sourceDir}</span>
            </div>
            {props.source.kind === "local" && (
              <button
                type="button"
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-text-weak transition-colors hover:bg-[var(--icon-bg-hover)] hover:text-text-strong"
                onClick={() => {
                  setSourceDir("")
                  setState({ phase: "idle" })
                }}
                disabled={isLoading}
              >
                <Icon name="close-small" size="medium" />
              </button>
            )}
          </div>
        ) : (
          <div
            className={`group flex h-[140px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[16px] border-2 border-dotted transition-colors hover:border-[var(--primary-200)] hover:bg-[var(--icon-bg-hover)] ${
              dragOver ? "border-[var(--primary-200)] bg-[var(--icon-bg-hover)]" : "border-[var(--border-weak-base)]"
            }`}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const dt = e.dataTransfer
              if (!dt) return
              const droppedFile = dt.files[0]
              if (droppedFile && isValidFile(droppedFile)) {
                handleFile(droppedFile)
                return
              }
              // Folder drag: detect via webkitGetAsEntry, resolve path via bridge（线上仅 Electron 支持）
              const entry = dt.items[0]?.webkitGetAsEntry?.()
              if (entry?.isDirectory) {
                showToast({ variant: "warning", title: t("settings.skills.install.error.dragFolderNotSupported") })
                return
              }
              if (droppedFile) {
                showToast({ variant: "warning", title: t("settings.skills.install.error.invalidFile") })
              }
            }}
          >
            <input
              ref={fileInput}
              type="file"
              accept=".zip,.tar.gz,application/zip,application/gzip,application/x-gzip,application/x-compressed"
              className="hidden"
              onChange={(e) => handleFile(e.currentTarget.files?.[0])}
            />
            <Icon
              name="folder-plus-24"
              size="medium"
              className={
                dragOver
                  ? "text-[var(--primary-600)] transition-colors"
                  : "text-text-weak transition-colors group-hover:text-[var(--primary-600)]"
              }
            />
            <span
              className={
                dragOver
                  ? "text-[var(--primary-600)] transition-colors"
                  : "text-text-strong transition-colors group-hover:text-[var(--primary-600)]"
              }
              style={{ fontSize: "14px", fontWeight: 400 }}
            >
              {t("settings.skills.install.dropzone.title")}{" "}
              <button
                type="button"
                className="cursor-pointer text-[var(--primary-500)] underline hover:text-[var(--primary-600)] disabled:cursor-default"
                onClick={(e) => {
                  e.stopPropagation()
                  selectFolder()
                }}
                disabled={isLoading}
              >
                {t("settings.skills.install.selectFolder")}
              </button>
              {" / "}
              <button
                type="button"
                className="cursor-pointer text-[var(--primary-500)] underline hover:text-[var(--primary-600)] disabled:cursor-default"
                onClick={(e) => {
                  e.stopPropagation()
                  fileInput.current?.click()
                }}
                disabled={isLoading}
              >
                {t("settings.skills.install.selectFile")}
              </button>
            </span>
          </div>
        )}

        {/* Technical requirements */}
        <ul className="flex flex-col gap-1 pl-5 text-13-regular text-text-weak list-disc">
          <li>{t("settings.skills.install.requirements.item1")}</li>
          <li>{t("settings.skills.install.requirements.item2")}</li>
          <li>{t("settings.skills.install.requirements.item3")}</li>
        </ul>

        {/* Conflict UI（线上 409 后展示：警告框 + 覆盖勾选） */}
        {showConflict && (
          <div className="flex items-start gap-2 rounded-[10px] border border-[var(--warning-300)] bg-[var(--warning-50)] px-3 py-2">
            <Icon name="warning-circle" size="small" className="mt-0.5 shrink-0 text-[var(--warning-600)]" />
            <div className="flex flex-col gap-1">
              <span className="text-13-medium text-[var(--warning-700)]">
                {t("settings.skills.install.conflict").replace("{{name}}", ready!.name)}
              </span>
              <label className="flex cursor-pointer items-center gap-1.5 text-13-regular text-text-base">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(event) => setOverwrite(event.currentTarget.checked)}
                />
                {t("settings.skills.install.overwriteConfirm")}
              </label>
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div className="mt-2 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => close()}
            disabled={isLoading}
            className="flex cursor-pointer items-center justify-center gap-1 shrink-0 rounded-lg border-none bg-transparent px-4 py-2 text-sm font-normal leading-[22px] whitespace-nowrap !text-[var(--button-text-text)] transition-colors hover:bg-[var(--icon-bg-hover)] active:bg-[var(--icon-bg-active)] disabled:cursor-default disabled:opacity-60"
          >
            {t("kcode.skillDev.action.cancel")}
          </button>
          {showConflict ? (
            <button
              type="button"
              onClick={() => void installRequest(true)}
              disabled={isLoading || !overwrite}
              className="flex cursor-pointer items-center justify-center gap-1 shrink-0 rounded-lg border-none px-4 py-2 text-sm font-medium leading-5 !bg-[var(--button-primary-bg)] hover:!bg-[var(--button-primary-bg-hover)] active:!bg-[var(--button-primary-bg-active)] text-[var(--button-primary-text)] transition-colors disabled:cursor-default disabled:opacity-60"
            >
              {t("settings.skills.install.overwriteBtn")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void installRequest(false)}
              disabled={isLoading || !hasSource}
              className="flex cursor-pointer items-center justify-center gap-1 shrink-0 rounded-lg border-none px-4 py-2 text-sm font-medium leading-5 !bg-[var(--button-primary-bg)] hover:!bg-[var(--button-primary-bg-hover)] active:!bg-[var(--button-primary-bg-active)] text-[var(--button-primary-text)] transition-colors disabled:cursor-default disabled:opacity-60"
            >
              {t("settings.skills.install.confirm")}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  )
}

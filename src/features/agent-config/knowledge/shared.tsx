import { Icon, Markdown } from "@/ui"
import { cx } from "@/lib/cx"
import { useLocaleStore, useT } from "@/i18n"
import type { KnowledgeEntry } from "@/mock/fixtures/knowledge"
import type { FolderState } from "./tree"

/** 个人上传的知识在界面上统一显示的目录名（与线上一致，固定文案） */
export const PERSONAL_UPLOAD_LABEL = "临时目录"
/** 左树里「上传知识」入口的占位 id */
export const PERSONAL_VIEW_ID = "__personal__"

export function fmtFileSize(bytes: number) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

export const useKnowledgeDate = () => {
  const locale = useLocaleStore((s) => s.locale)
  return (iso?: string) => (iso ? new Date(iso).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US") : "")
}

export function getFileTypeColor(type: string) {
  const map: Record<string, string> = { PDF: "#ef5b5b", DOCX: "#4a86e8", DOC: "#4a86e8", XLSX: "#38a169", XLS: "#38a169", CSV: "#38a169", PPTX: "#e8813a", PPT: "#e8813a" }
  return map[type.toUpperCase()] || "#8a8d93"
}

export const fileExtension = (name: string) => (name.includes(".") ? (name.split(".").pop() ?? "") : "")

/** 知识树里的文件夹图标（描边、半开样式） */
export function KnowledgeFolderIcon(props: { className?: string }) {
  return (
    <svg className={props.className} width="16" height="14" viewBox="0 0 17 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.31494 0C7.19062 0 8.02283 0.382562 8.59277 1.04736L9.49585 2.10132C9.78079 2.4337 10.197 2.62496 10.6348 2.625H13.3499C13.4167 2.625 13.4815 2.63422 13.5432 2.65063C15.0455 2.84506 16.1942 4.14918 16.1528 5.70483L16.125 6.76978C16.1231 6.83939 16.1108 6.90622 16.0913 6.96973C16.7682 7.65124 17.0161 8.6466 16.5798 9.81006L15.7332 12.0674C15.2417 13.3779 13.9921 14.2491 12.5925 14.2573L3.77197 14.3093C1.49072 14.2582 0.198238 12.6109 0.364746 10.7498L0 5.625C0 4.71535 0.481449 3.67362 1.3125 3.11426V2.93921C1.3125 1.2824 2.69306 7.56435e-05 4.34985 0H6.31494ZM4.3916 7.50586C3.65157 7.56472 3.00936 8.05786 2.76636 8.76929L1.97754 10.3286L1.94238 10.4429C1.62835 11.589 2.45658 12.7398 3.64307 12.8064L3.76318 12.8093L12.5837 12.7573C13.3613 12.7528 14.0554 12.2688 14.3284 11.5408L15.175 9.28345C15.6203 8.09601 14.7839 7.58159 13.541 7.50366L13.4194 7.5H4.54102L4.3916 7.50586ZM4.34985 1.5C3.52149 1.50008 2.84985 2.17162 2.84985 3V3.375C2.84985 3.49748 2.81989 3.61273 2.76782 3.71484C2.73487 3.8766 2.6302 4.04909 2.39062 4.24292C1.78103 4.73597 1.52569 4.90712 1.52563 5.48804L1.66406 7.61279C2.26826 6.62633 3.34967 6.00001 4.54102 6H13.4194C13.8546 6.00001 14.2649 6.05513 14.6396 6.1582L14.6536 5.66528C14.676 4.82157 13.9983 4.12508 13.1543 4.125H10.5C10.4529 4.125 10.407 4.11939 10.3623 4.11108C9.58835 4.0405 8.86734 3.67304 8.35693 3.07764L7.45386 2.02368C7.16889 1.69131 6.75276 1.5 6.31494 1.5H4.34985Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** 文档处理状态角标：只在「未完成 / 失败」时出现 */
export function KnowledgeStatusBadge(props: { status?: KnowledgeEntry["status"] }) {
  const t = useT()
  if (!props.status || props.status === "READY") return null
  const failed = props.status === "FAILED"
  return (
    <span
      className="shrink-0 text-[10px] rounded-[5px] font-medium"
      style={{ padding: "2px 6px", background: failed ? "#fdecec" : "#fff6e8", color: failed ? "#d0524e" : "#b8791a" }}
      title={t(failed ? "kcode.agentKnowledge.status.failedTooltip" : "kcode.agentKnowledge.status.processingTooltip")}
    >
      {t(`kcode.agentKnowledge.status.${props.status.toLowerCase()}`)}
    </span>
  )
}

/** 目录勾选框。interactive 为 false 时只展示状态（已关联列表里不能点） */
export function FolderCheckbox(props: { state: FolderState; covered?: boolean; onToggle?: () => void }) {
  const on = props.state !== "none"
  return (
    <span
      className={cx(
        "rounded-[5px] border-[1.5px] shrink-0 flex items-center justify-center",
        props.onToggle ? "w-[18px] h-[18px] transition-all" : "w-[17px] h-[17px] cursor-default",
        props.onToggle
          ? props.covered
            ? "bg-[#c9d6ee] border-[#c9d6ee] text-[#fff] cursor-default"
            : on
              ? "bg-[var(--primary-600)] border-[var(--primary-600)] text-[var(--white-100)] cursor-pointer"
              : "border-[var(--border-weak-base)] cursor-pointer"
          : on || props.covered
            ? "bg-[var(--primary-200)] border-[var(--primary-200)] text-[var(--white-100)]"
            : "border-[var(--border-weak-base)]",
      )}
      onClick={
        props.onToggle &&
        ((e) => {
          e.stopPropagation()
          props.onToggle?.()
        })
      }
    >
      {props.state === "full" && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {props.state === "part" && <span className="w-[9px] h-[2px] rounded-sm bg-[#fff]" />}
    </span>
  )
}

/** 企业知识文档卡片：目录标签 + 格式 + 状态角标 / 标题 / 更新时间。处理失败的不能点开 */
export function DocCard(props: { doc: KnowledgeEntry; dirName: string; filled?: boolean; onOpen: () => void }) {
  const t = useT()
  const date = useKnowledgeDate()
  const failed = props.doc.status === "FAILED"
  return (
    <div
      className={cx(
        "shrink-0 border border-[var(--border-weak-base)] agent-config-list-card bg-[var(--surface-raised-stronger-non-alpha)] transition-all",
        failed ? "cursor-default" : "cursor-pointer hover:border-[var(--border-weak-base)] hover:shadow-sm",
      )}
      style={{ padding: "15px 16px" }}
      title={failed ? t("kcode.agentKnowledge.previewFailed") : undefined}
      onClick={() => !failed && props.onOpen()}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cx(
            "text-[11px] rounded-[5px] font-medium",
            props.filled ? "text-[#2f7bff] bg-[color-mix(in_srgb,var(--primary-600)_10%,transparent)]" : "text-[var(--primary-500)] border border-[var(--primary-500)] bg-transparent",
          )}
          style={{ padding: "2px 8px" }}
        >
          {props.dirName}
        </span>
        <span className="text-[11px] text-text-weak font-semibold tracking-wide">{props.doc.format.toUpperCase()}</span>
        <KnowledgeStatusBadge status={props.doc.status} />
      </div>
      <div className="text-[14px] font-semibold text-text-strong truncate" style={{ marginBottom: 6 }} title={props.doc.name}>
        {props.doc.name}
      </div>
      <div className="text-[12px] text-text-weak">{t("kcode.agentKnowledge.updatedAt", { time: date(props.doc.timeUpdated) })}</div>
    </div>
  )
}

/** 文档详情：返回按钮 + 文档头（格式色块、标题、元信息）+ 正文 */
export function DocDetail(props: {
  name: string
  format: string
  tag: string
  tagOutlined?: boolean
  status?: KnowledgeEntry["status"]
  size?: number
  creatorName?: string
  time: string
  content?: string
  notice?: string
  onBack: () => void
}) {
  const t = useT()
  const fmt = props.format.toUpperCase()
  return (
    <div className="flex h-full flex-col min-h-0">
      <button
        type="button"
        className="shrink-0 flex items-center gap-1.5 h-[30px] rounded-[8px] text-[13px] text-text-base cursor-pointer self-start hover:bg-[var(--surface-base)] hover:text-text-strong"
        style={{ padding: "0 10px 0 6px", marginBottom: 14 }}
        onClick={props.onBack}
      >
        <Icon name="chevron-left-16" size="small" containerClass="text-current" />
        {t("kcode.agentKnowledge.back")}
      </button>
      <div className="shrink-0 flex items-start border-b border-[var(--border-weak-base)]" style={{ gap: 13, paddingBottom: 16, marginBottom: 16 }}>
        <div className="w-11 h-11 rounded-[10px] shrink-0 flex items-center justify-center text-[12px] font-bold text-[#fff]" style={{ background: getFileTypeColor(fmt) }}>
          {fmt}
        </div>
        <div className="min-w-0">
          <div className="text-[18px] font-bold text-text-strong leading-snug break-all">{props.name}</div>
          <div className="flex items-center flex-wrap gap-2 mt-2 text-[12px] text-text-weak">
            <span
              className={cx("text-[11px] rounded-[5px]", props.tagOutlined ? "text-[var(--primary-500)] border border-[var(--primary-500)]" : "text-[#2f7bff] bg-[color-mix(in_srgb,var(--primary-600)_10%,transparent)]")}
              style={{ padding: "2px 8px" }}
            >
              {props.tag}
            </span>
            <KnowledgeStatusBadge status={props.status} />
            <span>{fmt}</span>
            {props.size && (
              <>
                <span className="text-text-weak">·</span>
                <span>{fmtFileSize(props.size)}</span>
              </>
            )}
            {props.creatorName && (
              <>
                <span className="text-text-weak">·</span>
                <span>{props.creatorName}</span>
              </>
            )}
            <span className="text-text-weak">·</span>
            <span>{props.time}</span>
          </div>
        </div>
      </div>
      {props.notice && (
        <div className="shrink-0 text-[12px] text-[#d0524e] bg-[color-mix(in_srgb,var(--danger-600)_12%,transparent)] rounded-[7px]" style={{ padding: "8px 11px", marginBottom: 12, lineHeight: 1.6 }}>
          {props.notice}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar select-text">
        {props.content ? (
          <Markdown text={props.content} />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-text-weak">{t("kcode.agentKnowledge.status.pendingHint")}</div>
        )}
      </div>
    </div>
  )
}

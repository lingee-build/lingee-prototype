import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { BrandButton, ConfirmDialog, Empty, Icon, showToast, useDialog } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { KnowledgeBinding } from "@/mock/fixtures/dev"
import type { KnowledgeCategory, KnowledgeEntry } from "@/mock/fixtures/knowledge"
import { knowledgeService } from "@/services"
import type { TabProps } from "../form"
import { AddKnowledgeDialog } from "./AddKnowledgeDialog"
import { DocCard, DocDetail, FolderCheckbox, KnowledgeFolderIcon, PERSONAL_UPLOAD_LABEL, PERSONAL_VIEW_ID, fileExtension, fmtFileSize, useKnowledgeDate } from "./shared"
import { folderState, indexTree, isCovered } from "./tree"
import { UploadKnowledgeDialog } from "./UploadKnowledgeDialog"

const ROW_ACTIVE = "bg-[var(--surface-base)] text-[var(--neutral-800)] font-[600]"
const ROW_IDLE = "text-[var(--text-base)] hover:bg-[var(--surface-base)] hover:text-[var(--neutral-700)]"

/**
 * 「知识」页签：左边是已关联的企业知识目录树 + 「上传知识」入口，右边是当前目录下的文档卡片。
 * 企业知识只能按目录关联（「添加」弹窗里勾目录）；个人上传的文件先存为个人知识，审核通过后才转成企业知识。
 */
export function KnowledgeBaseTab(props: TabProps) {
  const t = useT()
  const dialog = useDialog()
  const date = useKnowledgeDate()
  const { form, set, readonly } = props
  const [query, setQuery] = useState("")
  const [current, setCurrent] = useState<string>()
  const [open, setOpen] = useState(() => new Set<string>())
  const [detail, setDetail] = useState<KnowledgeEntry>()
  const [personalDetail, setPersonalDetail] = useState<KnowledgeBinding>()

  const tree = useQuery({ queryKey: ["knowledge-tree"], queryFn: knowledgeService.tree })
  const index = useMemo(() => indexTree(tree.data ?? []), [tree.data])
  const catalogs = form.knowledge.filter((x) => x.kind === "catalog")
  const personal = form.knowledge.filter((x) => x.scope === "personal")
  const bound = useMemo(() => new Set(catalogs.map((x) => x.id)), [form.knowledge])
  const keyword = query.trim().toLowerCase()

  /** 目录本身、祖先或任一子孙已关联，才出现在左树里 */
  const associated = (dir: KnowledgeCategory) => folderState(dir.id, bound, index) !== "none"
  const matches = (dir: KnowledgeCategory): boolean => !keyword || dir.name.toLowerCase().includes(keyword) || dir.children.some(matches)
  const roots = (tree.data ?? []).filter((dir) => associated(dir) && matches(dir))

  // 默认选中第一个已关联目录；没有企业知识但有个人知识时落到「上传知识」
  useEffect(() => {
    if (current === PERSONAL_VIEW_ID ? personal.length > 0 : current && folderState(current, bound, index) !== "none") return
    setCurrent(catalogs[0]?.id ?? (personal.length ? PERSONAL_VIEW_ID : undefined))
  }, [tree.data, form.knowledge])

  const scopeIds = current && current !== PERSONAL_VIEW_ID ? (index.subtree.get(current) ?? []).filter((id) => folderState(id, bound, index) === "full") : []
  const docs = useQuery({
    queryKey: ["knowledge-docs", scopeIds.join(","), keyword],
    queryFn: () => knowledgeService.docs(scopeIds),
    enabled: scopeIds.length > 0,
  })
  const shown = (docs.data ?? []).filter((x) => !keyword || x.name.toLowerCase().includes(keyword) || (x.creatorName ?? "").toLowerCase().includes(keyword))
  const dirNameOf = (doc: KnowledgeEntry) => index.byId.get(doc.categoryId)?.name ?? t("kcode.agentKnowledge.uncategorized")

  const removeFolder = (id: string) => {
    const drop = new Set(index.subtree.get(id) ?? [id])
    set({ knowledge: form.knowledge.filter((x) => x.kind !== "catalog" || !drop.has(x.id)) })
  }
  const confirmRemovePersonal = (binding: KnowledgeBinding) =>
    dialog.show(() => (
      <ConfirmDialog
        variant="danger"
        title={t("kcode.agentKnowledge.deleteTitle")}
        description={t("kcode.agentKnowledge.deleteDescription", { name: binding.name })}
        cancelText={t("kcode.agentKnowledge.cancel")}
        confirmText={t("kcode.agentKnowledge.delete")}
        onConfirm={() => {
          set({ knowledge: form.knowledge.filter((x) => x.id !== binding.id) })
          showToast({ variant: "success", title: t("kcode.agentKnowledge.deleted", { name: binding.name }) })
        }}
      />
    ))

  const openAdd = () =>
    dialog.show(() => (
      <AddKnowledgeDialog
        selected={catalogs.map((x) => x.id)}
        onConfirm={(ids, added) => {
          const kept = form.knowledge.filter((x) => x.kind !== "catalog" || ids.includes(x.id))
          set({ knowledge: [...kept, ...added.filter((x) => !kept.some((y) => y.id === x.id))] })
          if (added[0]) setCurrent(added[0].id)
        }}
      />
    ))
  const openUpload = () =>
    dialog.show(() => (
      <UploadKnowledgeDialog
        existing={personal.map((x) => x.name)}
        onConfirm={(files) => {
          const now = new Date().toISOString()
          const added: KnowledgeBinding[] = files.map((file, i) => ({
            id: `kp_${Date.now().toString(36)}_${i}`,
            name: file.name,
            path: file.name,
            kind: "document",
            scope: "personal",
            size: file.size,
            status: 0,
            updatedAt: now,
          }))
          set({ knowledge: [...form.knowledge, ...added] })
          setCurrent(PERSONAL_VIEW_ID)
          showToast({ variant: "success", title: t("kcode.agentKnowledge.uploaded", { count: files.length }) })
        }}
      />
    ))

  const renderDir = (dir: KnowledgeCategory, depth: number): ReactNode => {
    const children = dir.children.filter((child) => associated(child) && matches(child))
    const expanded = !!keyword || open.has(dir.id)
    const state = folderState(dir.id, bound, index)
    // 被已关联的祖先覆盖的目录不能单独移除，只显示数量
    const removable = !readonly && !isCovered(dir.id, bound, index)
    return (
      <div key={dir.id}>
        <div
          className={cx("group flex items-center gap-2 rounded-full text-[14px] cursor-pointer", current === dir.id ? ROW_ACTIVE : ROW_IDLE)}
          style={{ minHeight: 38, paddingLeft: 11 + depth * 20, paddingRight: 11, paddingTop: 7, paddingBottom: 7, marginBottom: 2 }}
          title={dir.name}
          onClick={() => setCurrent(dir.id)}
        >
          {children.length > 0 ? (
            <span
              className="w-4 shrink-0 flex items-center justify-center cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                setOpen((prev) => {
                  const next = new Set(prev)
                  if (!next.delete(dir.id)) next.add(dir.id)
                  return next
                })
              }}
            >
              <Icon name="chevron-right-16" size="small" containerClass="text-current" style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
            </span>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <FolderCheckbox state={state} />
          <KnowledgeFolderIcon className="shrink-0 text-text-base" />
          <span className="flex-1 truncate">{dir.name}</span>
          <span className={cx("text-[12px] text-text-weak shrink-0", removable && "group-hover:hidden")}>{dir.count}</span>
          {removable && (
            <span
              className="hidden group-hover:flex w-[17px] h-[17px] shrink-0 items-center justify-center text-text-weak cursor-pointer hover:text-[#e05a5a]"
              title={t("kcode.agentKnowledge.removeAssociation")}
              onClick={(e) => {
                e.stopPropagation()
                removeFolder(dir.id)
              }}
            >
              <Icon name="delete" size="small" containerClass="text-text-weak hover:text-[#e05a5a]" />
            </span>
          )}
        </div>
        {expanded && children.map((child) => renderDir(child, depth + 1))}
      </div>
    )
  }

  if (detail)
    return (
      <DocDetail
        name={detail.name}
        format={detail.format}
        tag={dirNameOf(detail)}
        status={detail.status}
        size={detail.size}
        creatorName={detail.creatorName}
        time={t("kcode.agentKnowledge.updatedAt", { time: date(detail.timeUpdated) })}
        content={detail.content}
        onBack={() => setDetail(undefined)}
      />
    )
  if (personalDetail)
    return (
      <DocDetail
        name={personalDetail.name}
        format={fileExtension(personalDetail.name)}
        tag={PERSONAL_UPLOAD_LABEL}
        tagOutlined
        size={personalDetail.size}
        time={t("kcode.agentKnowledge.uploadedAt", { time: date(personalDetail.updatedAt) })}
        notice={personalDetail.reviewComment ? t("kcode.agentKnowledge.rejectionReason", { reason: personalDetail.reviewComment }) : undefined}
        onBack={() => setPersonalDetail(undefined)}
      />
    )

  const personalShown = personal.filter((x) => !keyword || x.name.toLowerCase().includes(keyword))
  const skeleton = [0, 1, 2].map((i) => (
    <div key={i} className="shrink-0 border border-[var(--border-weak-base)] agent-config-list-card bg-[var(--surface-raised-stronger-non-alpha)]" style={{ padding: "15px 16px" }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="h-[18px] w-[68px] rounded-[5px] bg-[var(--surface-base)] animate-pulse" />
        <div className="h-[14px] w-[34px] rounded-[4px] bg-[var(--surface-base)] animate-pulse" />
      </div>
      <div className="h-[18px] w-[46%] rounded-[5px] bg-[var(--surface-base)] animate-pulse" style={{ marginBottom: 8 }} />
      <div className="h-[14px] w-[30%] rounded-[4px] bg-[var(--surface-base)] animate-pulse" />
    </div>
  ))

  return (
    <div className="flex h-full flex-col min-h-0">
      <div className="shrink-0 flex flex-wrap items-center gap-2.5 mb-3">
        {!readonly && (
          <>
            <BrandButton variant="auxiliary" size="normal" icon="plus-16" iconSize="small" onClick={openAdd}>
              {t("kcode.agentKnowledge.add")}
            </BrandButton>
            <BrandButton variant="auxiliary" size="normal" icon="submit-upload" iconSize="small" onClick={openUpload}>
              {t("kcode.agentKnowledge.upload")}
            </BrandButton>
          </>
        )}
        <div
          className={cx("flex items-center gap-[7px] h-9 rounded-xl border border-[var(--border-weak-base)] bg-[var(--surface-raised-stronger-non-alpha)]", readonly ? "w-full" : "ml-auto min-w-[180px] flex-1")}
          style={{ padding: "0 12px" }}
        >
          <Icon name="search-16" size="small" className="shrink-0 text-text-weak" />
          <input
            type="text"
            className="flex-1 min-w-0 border-0 outline-none text-[13px] bg-transparent text-text-strong placeholder:text-text-weak placeholder:opacity-100"
            placeholder={t("kcode.agentKnowledge.searchPlaceholder")}
            title={t("kcode.agentKnowledge.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </div>
      </div>

      <div className="flex flex-1 gap-3.5 min-h-0">
        <div className="relative shrink-0 w-[230px]">
          <div className="h-full rounded-xl border border-[var(--border-weak-base)] p-1.5 overflow-y-auto no-scrollbar">
            {tree.isPending ? (
              [72, 56, 64, 48, 60].map((w) => (
                <div key={w} className="flex items-center gap-2" style={{ minHeight: 38, padding: "7px 11px" }}>
                  <span className="w-4 shrink-0" />
                  <div className="h-4 w-4 shrink-0 rounded-[4px] bg-[var(--surface-base)] animate-pulse" />
                  <div className="h-3.5 rounded-[4px] bg-[var(--surface-base)] animate-pulse" style={{ width: `${w}%` }} />
                </div>
              ))
            ) : (
              <>
                <div className="text-[11px] text-text-weak font-semibold" style={{ padding: "10px 10px 5px" }}>
                  {t("kcode.agentKnowledge.enterpriseSection")}
                </div>
                {roots.length > 0 ? (
                  roots.map((dir) => renderDir(dir, 0))
                ) : (
                  <div className="text-[12px] text-text-weak" style={{ padding: "4px 12px 8px" }}>
                    {t(keyword ? "kcode.agentKnowledge.noMatchDirectory" : "kcode.agentKnowledge.noEnterpriseDirectory")}
                  </div>
                )}
                <div className="text-[11px] text-text-weak font-semibold" style={{ padding: "10px 10px 5px" }}>
                  {t("kcode.agentKnowledge.personalSection")}
                </div>
                {personalShown.length > 0 ? (
                  <div
                    className={cx("flex items-center gap-2 rounded-full text-[14px] cursor-pointer", current === PERSONAL_VIEW_ID ? ROW_ACTIVE : ROW_IDLE)}
                    style={{ minHeight: 38, padding: "7px 11px", marginBottom: 2 }}
                    onClick={() => setCurrent(PERSONAL_VIEW_ID)}
                    title={PERSONAL_UPLOAD_LABEL}
                  >
                    <span className="w-4 shrink-0" />
                    <FolderCheckbox state="full" />
                    <KnowledgeFolderIcon className="shrink-0 text-text-base" />
                    <span className="flex-1 truncate">{PERSONAL_UPLOAD_LABEL}</span>
                    <span className="text-[12px] text-text-weak shrink-0">{personalShown.length}</span>
                  </div>
                ) : (
                  <div className="text-[12px] text-text-weak" style={{ padding: "4px 12px 8px" }}>
                    {t(keyword ? "kcode.agentKnowledge.noMatchDirectory" : "kcode.agentKnowledge.noPersonalKnowledge")}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto no-scrollbar flex flex-col gap-3 pr-0.5">
          {tree.isPending ? (
            skeleton
          ) : current === PERSONAL_VIEW_ID ? (
            personalShown.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <Empty />
              </div>
            ) : (
              personalShown.map((binding) => (
                <div
                  key={binding.id}
                  className="shrink-0 border border-[var(--border-weak-base)] agent-config-list-card bg-[var(--surface-raised-stronger-non-alpha)] cursor-pointer transition-all hover:border-[var(--border-weak-base)] hover:shadow-sm"
                  style={{ padding: "15px 16px" }}
                  onClick={() => setPersonalDetail(binding)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] text-[var(--primary-500)] border border-[var(--primary-500)] bg-transparent rounded-[5px] font-medium" style={{ padding: "2px 8px" }}>
                      {PERSONAL_UPLOAD_LABEL}
                    </span>
                    <span className="text-[11px] text-text-weak font-semibold tracking-wide">{fileExtension(binding.name).toUpperCase()}</span>
                    {binding.status !== 2 && (
                      <span
                        className="shrink-0 text-[10px] rounded-[5px] font-medium"
                        style={{ padding: "2px 6px", background: binding.status === 1 ? "#fdecec" : "#fff6e8", color: binding.status === 1 ? "#d0524e" : "#b8791a" }}
                        title={t(binding.status === 1 ? "kcode.agentKnowledge.status.rejectedHint" : "kcode.agentKnowledge.status.pendingHint")}
                      >
                        {t(binding.status === 1 ? "kcode.skillDev.enterpriseStatus.rejected" : "kcode.agentConfig.skills.statusReviewing")}
                      </span>
                    )}
                    {!readonly && binding.status !== 2 && (
                      <button
                        type="button"
                        className="ml-auto flex w-[17px] h-[17px] shrink-0 items-center justify-center border-0 bg-transparent p-0 text-text-weak cursor-pointer hover:text-[#e05a5a]"
                        title={t("kcode.agentKnowledge.delete")}
                        aria-label={t("kcode.agentKnowledge.delete")}
                        onClick={(e) => {
                          e.stopPropagation()
                          confirmRemovePersonal(binding)
                        }}
                      >
                        <Icon name="delete" size="small" containerClass="text-text-weak hover:text-[#e05a5a]" />
                      </button>
                    )}
                  </div>
                  <div className="text-[14px] font-semibold text-text-strong truncate" style={{ marginBottom: 6 }} title={binding.name}>
                    {binding.name}
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-text-weak">
                    {binding.size && (
                      <>
                        <span>{fmtFileSize(binding.size)}</span>
                        <span className="text-text-weak">·</span>
                      </>
                    )}
                    <span>{t("kcode.agentKnowledge.uploadedAt", { time: date(binding.updatedAt) })}</span>
                  </div>
                  {binding.reviewComment && (
                    <div className="text-[12px] text-[#d0524e] bg-[color-mix(in_srgb,var(--danger-600)_12%,transparent)] rounded-[7px]" style={{ padding: "7px 10px", marginTop: 10, lineHeight: 1.6 }}>
                      {t("kcode.agentKnowledge.rejectionReason", { reason: binding.reviewComment })}
                    </div>
                  )}
                </div>
              ))
            )
          ) : docs.isFetching && !docs.data ? (
            skeleton
          ) : shown.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <Empty />
            </div>
          ) : (
            shown.map((doc) => <DocCard key={doc.id} doc={doc} dirName={dirNameOf(doc)} onOpen={() => setDetail(doc)} />)
          )}
        </div>
      </div>
    </div>
  )
}

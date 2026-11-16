import { useMemo, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Dialog, Empty, Icon, useDialog } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { KnowledgeBinding } from "@/mock/fixtures/dev"
import type { KnowledgeCategory, KnowledgeEntry } from "@/mock/fixtures/knowledge"
import { knowledgeService } from "@/services"
import { DocCard, DocDetail, FolderCheckbox, KnowledgeFolderIcon, useKnowledgeDate } from "./shared"
import { folderState, indexTree, isCovered } from "./tree"

/**
 * 添加企业知识弹窗：左边勾目录（勾父目录即覆盖全部子目录），右边预览该目录下的文档。
 * 只能按目录关联，文档卡片仅供查看。
 */
export function AddKnowledgeDialog(props: { selected: string[]; onConfirm: (ids: string[], added: KnowledgeBinding[]) => void }) {
  const t = useT()
  const dialog = useDialog()
  const date = useKnowledgeDate()
  const [query, setQuery] = useState("")
  const [bound, setBound] = useState(() => new Set(props.selected))
  const [open, setOpen] = useState(() => new Set<string>())
  const [current, setCurrent] = useState<string>()
  const [detail, setDetail] = useState<KnowledgeEntry>()

  const tree = useQuery({ queryKey: ["knowledge-tree"], queryFn: knowledgeService.tree })
  const index = useMemo(() => indexTree(tree.data ?? []), [tree.data])
  const keyword = query.trim().toLowerCase()
  const folder = current ?? tree.data?.[0]?.id
  const docs = useQuery({
    queryKey: ["knowledge-pick", keyword || folder],
    queryFn: () => (keyword ? knowledgeService.search(keyword) : knowledgeService.docs(index.subtree.get(folder ?? "") ?? [])),
    enabled: !!keyword || !!folder,
  })
  const hitDirs = useMemo(() => new Set((keyword ? (docs.data ?? []) : []).map((x) => x.categoryId)), [docs.data, keyword])
  const matches = (dir: KnowledgeCategory): boolean =>
    !keyword || dir.name.toLowerCase().includes(keyword) || hitDirs.has(dir.id) || dir.children.some(matches)
  const dirName = (doc: KnowledgeEntry) => index.byId.get(doc.categoryId)?.name ?? t("kcode.agentKnowledge.uncategorized")

  /** 勾选目录：已勾则取消；勾上时把它的子孙目录的单独关联并掉 */
  const toggle = (dir: KnowledgeCategory) => {
    if (isCovered(dir.id, bound, index)) return
    setBound((prev) => {
      const next = new Set(prev)
      const subtree = index.subtree.get(dir.id) ?? [dir.id]
      const on = folderState(dir.id, prev, index) !== "none"
      subtree.forEach((id) => next.delete(id))
      if (!on) next.add(dir.id)
      return next
    })
  }

  const confirm = () => {
    const ids = [...bound]
    const now = new Date().toISOString()
    props.onConfirm(
      ids,
      ids
        .filter((id) => !props.selected.includes(id))
        .map((id) => ({ id, name: index.byId.get(id)?.name ?? id, path: index.paths.get(id) ?? id, kind: "catalog", scope: "enterprise", updatedAt: now })),
    )
    dialog.close()
  }

  const renderNode = (dir: KnowledgeCategory, depth: number): ReactNode => {
    const children = dir.children.filter(matches)
    const expanded = !!keyword || open.has(dir.id)
    const covered = isCovered(dir.id, bound, index)
    return (
      <div key={dir.id}>
        <div
          className={cx(
            "flex items-center gap-2 h-9 rounded-full text-[14px] text-[var(--text-base)] cursor-pointer",
            covered && "opacity-60",
            folder === dir.id && !keyword ? "bg-[var(--surface-base)] text-[var(--neutral-800)] font-[600]" : "hover:bg-[var(--surface-base)] hover:text-[var(--neutral-700)]",
          )}
          style={{ paddingLeft: 6 + depth * 20, paddingRight: 10, marginBottom: 2 }}
          title={dir.name}
          onClick={() => setCurrent(dir.id)}
        >
          {children.length > 0 ? (
            <span
              className="w-[18px] h-[18px] shrink-0 flex items-center justify-center cursor-pointer text-text-weak"
              onClick={(e) => {
                e.stopPropagation()
                setOpen((prev) => {
                  const next = new Set(prev)
                  if (!next.delete(dir.id)) next.add(dir.id)
                  return next
                })
              }}
            >
              <Icon name="chevron-right-16" size="small" containerClass="text-text-weak" style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
            </span>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}
          <FolderCheckbox state={folderState(dir.id, bound, index)} covered={covered} onToggle={() => toggle(dir)} />
          <span className="w-5 h-5 shrink-0 flex items-center justify-center text-text-base">
            <KnowledgeFolderIcon className="text-text-base" />
          </span>
          <span className="flex-1 truncate">{dir.name}</span>
          <span className="ml-auto text-[11px] text-text-weak shrink-0">{dir.count}</span>
        </div>
        {expanded && children.map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  const roots = (tree.data ?? []).filter(matches)

  return (
    <Dialog fit width="min(1080px, 90vw)" title={t("kcode.agentKnowledge.addEnterpriseTitle")}>
      <div className="flex flex-col" style={{ height: "min(660px, 82vh)" }}>
        {detail ? (
          <div className="flex-1 min-h-0" style={{ padding: "0 24px 20px" }}>
            <DocDetail
              name={detail.name}
              format={detail.format}
              tag={dirName(detail)}
              status={detail.status}
              size={detail.size}
              creatorName={detail.creatorName}
              time={t("kcode.agentKnowledge.updatedAt", { time: date(detail.timeUpdated) })}
              content={detail.content}
              onBack={() => setDetail(undefined)}
            />
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ padding: "0 24px" }}>
              <div className="mb-4 rounded-[16px] px-[11px] py-[9px] flex items-center gap-2 border shrink-0 bg-[var(--primary-50)] border-[var(--primary-200)]">
                <Icon name="info-fill" size="small" className="size-5 shrink-0 text-[var(--primary-600)]" />
                <span className="text-[14px] leading-[20px] text-[var(--gray-800)]">{t("kcode.agentKnowledge.addTip")}</span>
              </div>
              <div className="flex items-center gap-2 rounded-[9px] border border-[var(--border-weak-base)] text-text-weak shrink-0" style={{ height: 38, padding: "0 13px", marginBottom: 12 }}>
                <Icon name="search-16" size="small" className="shrink-0 text-text-weak" />
                <input
                  type="text"
                  className="flex-1 min-w-0 border-0 outline-none text-[13px] bg-transparent text-text-strong placeholder:text-text-weak placeholder:opacity-100"
                  placeholder={t("kcode.agentKnowledge.searchPlaceholder")}
                  value={query}
                  onChange={(e) => setQuery(e.currentTarget.value)}
                />
              </div>
              <div className="flex-1 min-h-0 flex gap-3.5" style={{ marginTop: 6 }}>
                <div className="w-[260px] shrink-0 overflow-y-auto no-scrollbar rounded-[12px] border border-[var(--border-weak-base)]" style={{ padding: 6 }}>
                  {roots.map((dir) => renderNode(dir, 0))}
                  {!tree.isPending && roots.length === 0 && (
                    <div className="flex items-center justify-center h-20 text-[13px] text-text-weak">
                      {t(keyword ? "kcode.agentKnowledge.noMatch" : "kcode.agentKnowledge.noDirectoriesToLink")}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 overflow-y-auto no-scrollbar flex flex-col gap-3">
                  {docs.isFetching || tree.isPending ? (
                    <div className="flex-1 flex items-center justify-center text-text-weak text-[13px]">
                      {t(keyword ? "kcode.agentKnowledge.searching" : "kcode.agentKnowledge.loading")}
                    </div>
                  ) : (docs.data ?? []).length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <Empty />
                    </div>
                  ) : (
                    (docs.data ?? []).map((doc) => <DocCard key={doc.id} doc={doc} dirName={dirName(doc)} filled onOpen={() => setDetail(doc)} />)
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end shrink-0" style={{ padding: "16px 24px 20px", gap: 12 }}>
              <span className="mr-auto text-[13px] text-text-weak">
                {bound.size === 0 ? (
                  t("kcode.agentKnowledge.noFolderSelected")
                ) : (
                  <>
                    {t("kcode.agentKnowledge.selectedFolders")}
                    <b className="text-[#2f7bff] font-semibold">{bound.size}</b>
                    {t("kcode.agentKnowledge.selectedFoldersUnit")}
                  </>
                )}
              </span>
              <button
                type="button"
                className="h-9 rounded-[12px] text-[14px] font-semibold cursor-pointer bg-[var(--surface-raised-stronger-non-alpha)] text-text-base border border-[var(--border-weak-base)] hover:bg-[var(--surface-base)]"
                style={{ padding: "0 22px" }}
                onClick={dialog.close}
              >
                {t("kcode.agentKnowledge.cancel")}
              </button>
              <button
                type="button"
                className="h-9 rounded-[12px] text-[14px] font-semibold cursor-pointer bg-[#2f7bff] text-[#fff] border border-[#2f7bff] hover:bg-[#1f6cf0]"
                style={{ padding: "0 22px" }}
                onClick={confirm}
              >
                {t("kcode.agentKnowledge.confirm")}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}

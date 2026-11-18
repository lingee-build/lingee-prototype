import { useMemo, useState, type ReactNode } from "react"
import { Dialog as Radix } from "radix-ui"
import { useNavigate, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { ConfirmDialog, Dialog, DropdownMenu, Empty, Icon, Tile, Tooltip, showToast, useDialog, type IconName } from "@/ui"
import { publicUrl } from "@/lib/public-url"
import { agentService } from "@/services"
import { DEV_GRID, DOT_BUTTON, DevPageLayout } from "@/features/dev-page/DevPageLayout"
import { useEditSession } from "@/features/dev-page/use-edit-session"
import { useAuth } from "@/stores/auth"
import { ADDED_AGENTS, useWorkAgents, visibleDeveloped, type DevelopedAgent } from "@/stores/work-agents"

type WorkTab = "added" | "developed"
const TABS: Array<{ value: WorkTab; label: string }> = [
  { value: "added", label: "我添加的" },
  { value: "developed", label: "我开发的" },
]

/** 统一展示模型：「我添加的」与「我开发的」共用卡片与详情 */
interface CardModel {
  id: string
  name: string
  desc: string
  avatar: string
  footer: string
  skills: Array<{ displayName: string; desc: string }>
  refs: string[]
  developed?: DevelopedAgent
}

/**
 * Work「智能体」页：我添加的（市场、企业资源）/ 我开发的（Build 个人安装）。
 * 页面壳与卡片沿用开发页（DevPageLayout + Tile），不展示安装状态标签。
 * 「我开发的」操作：使用 / 查看详情 / 前往 Build 编辑 / 卸载；不支持修改配置和更新。
 */
export function Component() {
  const dialog = useDialog()
  const navigate = useNavigate()
  const editSession = useEditSession()
  const [params, setParams] = useSearchParams()
  const tab: WorkTab = params.get("tab") === "developed" ? "developed" : "added"
  const [query, setQuery] = useState("")
  const account = useAuth((s) => s.account)
  const developed = useWorkAgents((s) => s.developed)
  const uninstall = useWorkAgents((s) => s.uninstall)
  // Build 源智能体是否还在：决定「前往 Build 编辑」是否可用
  const buildAgents = useQuery({ queryKey: ["agents"], queryFn: agentService.list, staleTime: 0 })
  const sourceExists = (id: string) => (buildAgents.data ?? []).some((x) => x.id === id)

  const cards: CardModel[] = useMemo(() => {
    const list: CardModel[] =
      tab === "added"
        ? ADDED_AGENTS.map((x) => ({ id: x.id, name: x.name, desc: x.desc, avatar: x.avatar, footer: `来自${x.source}`, skills: x.skills, refs: [] }))
        : visibleDeveloped(developed, account).map((x) => ({
            id: x.key,
            name: x.name,
            desc: x.desc,
            avatar: x.avatar,
            footer: `来自 Build · ${x.installedAt}`,
            skills: x.skills,
            refs: [...x.mcpRefs, ...x.knowledgeRefs],
            developed: x,
          }))
    const keyword = query.trim().toLowerCase()
    return keyword ? list.filter((x) => `${x.name} ${x.desc}`.toLowerCase().includes(keyword)) : list
  }, [tab, developed, account, query])

  const use = (card: CardModel) => navigate(`/work/agent/chat?id=${encodeURIComponent(card.id)}`)
  const goEdit = (item: DevelopedAgent) =>
    void editSession({
      title: `编辑【${item.name}】`,
      draft: `/ai-partner-creator 编辑【${item.name}】：`,
      projectId: item.sourceProjectId,
      target: { agent: item.sourceAgentId },
    })
  const askUninstall = (item: DevelopedAgent) =>
    dialog.show(() => (
      <ConfirmDialog
        title="卸载智能体"
        description={`确定卸载「${item.name}」吗？将删除 Work 中的该智能体及包内技能，不影响 Build 中的开发资产。`}
        cancelText="取消"
        confirmText="卸载"
        variant="danger"
        onConfirm={() => {
          uninstall(item.key)
          showToast({ variant: "success", title: "已卸载" })
        }}
      />
    ))
  const showDetail = (card: CardModel) =>
    dialog.show(() => (
      <AgentDetail
        card={card}
        canEdit={!!card.developed && sourceExists(card.developed.sourceAgentId)}
        onUse={() => use(card)}
        onEdit={card.developed ? () => goEdit(card.developed!) : undefined}
        onUninstall={card.developed ? () => askUninstall(card.developed!) : undefined}
      />
    ))

  return (
    <div className="flex-1 min-h-0 w-full bg-background-page">
      <DevPageLayout
        title="智能体"
        searchWrapperStyle={{ background: "color-mix(in srgb, var(--surface-raised-stronger-non-alpha) 64%, transparent)" }}
        tabs={TABS}
        tab={tab}
        onTabChange={(value) => setParams(value === "developed" ? { tab: "developed" } : {}, { replace: true })}
        searchValue={query}
        onSearchChange={setQuery}
        onRefresh={() => buildAgents.refetch()}
        searchPlaceholder="搜索智能体"
      >
        {cards.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-2">
            <Empty description={query ? "没有匹配的智能体" : tab === "developed" ? "暂无开发的智能体，可在 Build 智能体页「提交 - 个人自用」" : undefined} />
          </div>
        ) : (
          <div className={DEV_GRID}>
            {cards.map((card) => {
              const dev = card.developed
              const editable = !!dev && sourceExists(dev.sourceAgentId)
              return (
                <Tile
                  key={card.id}
                  className="dev-page-tile tile-filled tile-icon-40 group cursor-pointer"
                  onClick={() => showDetail(card)}
                  icon={<img src={publicUrl(card.avatar)} alt="" className="shrink-0 h-[40px] w-[40px]" />}
                  name={card.name}
                  desc={card.desc}
                  footer={<span className="text-12-regular text-text-weak">{card.footer}</span>}
                  action={
                    <CardMenu>
                      <MenuItem icon="chat" label="使用" onSelect={() => use(card)} />
                      <MenuItem icon="bullet-list" label="查看详情" onSelect={() => showDetail(card)} />
                      {dev && (
                        <MenuItem
                          icon="square-arrow-top-right"
                          label="前往 Build 编辑"
                          disabled={!editable}
                          tip={editable ? undefined : "Build 中的源智能体已删除"}
                          onSelect={() => goEdit(dev)}
                        />
                      )}
                      {dev && (
                        <DropdownMenu.Item onSelect={() => askUninstall(dev)} className="group/delete flex items-center cursor-pointer gap-1" variant="destructive">
                          <Icon name="trash-16" size="small" className="group-hover/delete:text-[var(--text-on-error-base)]" />
                          <span className="group-hover/delete:text-[var(--text-on-error-base)]">卸载</span>
                        </DropdownMenu.Item>
                      )}
                    </CardMenu>
                  }
                />
              )
            })}
          </div>
        )}
      </DevPageLayout>
    </div>
  )
}

/** 卡片右上角「…」菜单：悬停卡片出现，样式与开发页卡片菜单一致 */
function CardMenu(props: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={
        open
          ? "flex items-center opacity-100"
          : "flex items-center opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto"
      }
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu placement="bottom-start" open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger aria-label="more" className={DOT_BUTTON}>
          <Icon name="dot-grid" size="small" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content style={{ minWidth: 100 }}>{props.children}</DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </div>
  )
}

function MenuItem(props: { icon: IconName; label: string; onSelect: () => void; disabled?: boolean; tip?: string }) {
  const item = (
    <DropdownMenu.Item disabled={props.disabled} className="flex items-center cursor-pointer gap-1 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50" onSelect={props.onSelect}>
      <Icon name={props.icon} size="small" />
      <span>{props.label}</span>
    </DropdownMenu.Item>
  )
  return props.tip ? (
    <Tooltip value={props.tip} placement="right" gutter={4}>
      <div>{item}</div>
    </Tooltip>
  ) : (
    item
  )
}

/** 查看详情：智能体信息 + 关联技能清单；只读，不支持修改开发配置 */
function AgentDetail(props: { card: CardModel; canEdit: boolean; onUse: () => void; onEdit?: () => void; onUninstall?: () => void }) {
  const { close } = useDialog()
  const { card } = props
  const dev = card.developed
  return (
    <Dialog fit customHeader className="w-[520px] !self-center !rounded-[24px] overflow-hidden shadow-[0px_6px_12px_rgba(0,0,0,0.08)]">
      <div className="flex flex-col gap-4 px-5 pt-5 pb-6">
        <div className="flex items-start gap-3">
          <img src={publicUrl(card.avatar)} alt="" className="size-12 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Radix.Title asChild>
              <span className="text-16-medium text-text-strong">{card.name}</span>
            </Radix.Title>
            <Radix.Description asChild>
              <span className="text-13-regular text-text-weak">{card.desc}</span>
            </Radix.Description>
          </div>
          <button type="button" aria-label="关闭" className={DOT_BUTTON} onClick={() => close()}>
            <Icon name="close-small" size="small" />
          </button>
        </div>

        <div className="flex flex-col gap-1 text-13-regular text-text-base">
          <span>来源：{dev ? "Build 个人安装" : card.footer.replace("来自", "")}</span>
          {dev && <span>安装时间：{dev.installedAt}</span>}
          {dev && !props.canEdit && <span className="text-[var(--warning-700)]">Build 中的源智能体已删除，仍可继续使用，但无法跳转编辑。</span>}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-14-medium text-text-strong">关联技能（{card.skills.length}）</span>
          <ul className="flex flex-col gap-1.5 rounded-[12px] bg-[var(--icon-bg-hover)] px-4 py-3">
            {card.skills.map((s) => (
              <li key={s.displayName} className="flex items-center gap-2 text-13-regular">
                <Icon name="skill-bolt" size="small" className="shrink-0 text-[var(--primary-600)]" />
                <span className="shrink-0 text-text-strong">{s.displayName}</span>
                <span className="truncate text-text-weak">{s.desc}</span>
              </li>
            ))}
          </ul>
        </div>

        {card.refs.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-14-medium text-text-strong">引用资源</span>
            <span className="text-13-regular text-text-base">{card.refs.join("、")}</span>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            {props.onUninstall && (
              <button
                type="button"
                className="h-[34px] cursor-pointer rounded-[8px] border-none bg-transparent px-3 text-14-regular text-[#E53535] transition-colors hover:bg-surface-base-hover"
                onClick={() => {
                  close()
                  props.onUninstall!()
                }}
              >
                卸载
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {props.onEdit && (
              <button
                type="button"
                disabled={!props.canEdit}
                title={props.canEdit ? undefined : "Build 中的源智能体已删除"}
                className="h-[34px] cursor-pointer rounded-[8px] border border-[var(--border-weak-base)] bg-transparent px-3 text-14-regular text-text-base transition-colors hover:bg-surface-base-hover disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  close()
                  props.onEdit!()
                }}
              >
                前往 Build 编辑
              </button>
            )}
            <button
              type="button"
              className="h-[34px] cursor-pointer rounded-[8px] border-none bg-[var(--brand-button-primary-base)] px-4 text-14-regular [color:#fff] transition-opacity hover:opacity-90"
              onClick={() => {
                close()
                props.onUse()
              }}
            >
              使用
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

import { guardUpgrade, UpgradeCard } from "@/features/artifact-upgrade/UpgradeGate"
import { CapsuleTag, Empty, Tile, useDialog } from "@/ui"
import { publicUrl } from "@/lib/public-url"
import { useT } from "@/i18n"
import type { Agent } from "@/mock/fixtures/dev"
import { agentService } from "@/services"
import { AgentDetailDialog } from "@/features/agent-config/AgentDetailDialog"
import { domainI18nKeys, pickAvatar } from "@/features/agent-config/form"
import { DEV_GRID, DevPageLayout } from "@/features/dev-page/DevPageLayout"
import { useDevList } from "@/features/dev-page/use-dev-list"
import { useStartSession } from "@/features/dev-page/use-start-session"
import { AgentCardActions } from "./AgentCardActions"

const TABS = ["all", "saved", "submitted", "published", "rejected"]

/**
 * 页签筛选口径（与线上一致）：
 * - 「已保存」= 从未提交的 + 本地改过还没提交的
 * - 其余页签只看云端状态，且排除本地改过的
 */
const matchTab = (agent: Agent, tab: string) => {
  if (tab === "saved") return agent.isChanged === true || !agent.backendStatus || agent.backendStatus === "saved"
  return agent.isChanged !== true && agent.backendStatus === tab
}

/** 智能体开发页：卡片列表 + 状态页签 + 搜索；点卡片看详情，卡片菜单里编辑 / 测试 / 提交 / 撤回 / 删除 */
export function AgentDevPage() {
  const t = useT()
  const dialog = useDialog()
  const startSession = useStartSession()
  const data = useDevList<Agent>({ queryKey: "agents", fetch: agentService.list, matchTab, searchText: (agent) => `${agent.name} ${agent.desc}` })

  // Build 中的智能体统一按创建时间倒序排列
  const list = [...data.list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <DevPageLayout
      title={t("kcode.agentDev.pageTitle")}
      searchWrapperStyle={{ background: "color-mix(in srgb, var(--surface-raised-stronger-non-alpha) 64%, transparent)" }}
      addLabel={t("kcode.agentDev.add")}
      onAdd={() => startSession("/ai-partner-creator ")}
      tabs={TABS.map((value) => ({ value, label: t(`kcode.agentDev.tab.${value}`) }))}
      tab={data.tab}
      onTabChange={data.setTab}
      searchValue={data.query}
      onSearchChange={data.setQuery}
      onRefresh={data.refresh}
      searchPlaceholder={t("kcode.agentDev.search")}
    >
      {list.length === 0 ? (
        !data.loading && (
          <div className="flex-1 flex items-center justify-center p-2">
            <Empty description={data.filtered ? t("kcode.agentDev.empty.noMatch") : undefined} />
          </div>
        )
      ) : (
        <div className={DEV_GRID}>
          {list.map((agent) => (
            <UpgradeCard key={agent.id} id={agent.id}>
            <Tile
              className="dev-page-tile tile-filled tile-icon-40 group cursor-pointer"
              onClick={() => {
                const open = () => dialog.show(() => <AgentDetailDialog agent={agent} onChanged={() => void data.refresh()} />)
                if (!guardUpgrade([agent.id], open)) open()
              }}
              icon={<img src={publicUrl(agent.avatar || pickAvatar(agent.id))} alt="" className="shrink-0 h-[40px] w-[40px]" />}
              name={agent.name}
              desc={agent.desc}
              status={agent.status}
              isChanged={agent.isChanged}
              backendStatus={agent.backendStatus}
              changedTipText={(status) => t(`kcode.agentDev.changedTip.${status}`)}
              reason={agent.rejectionRemark}
              footer={
                <>
                  {domainI18nKeys[agent.domain] && <CapsuleTag>{t(domainI18nKeys[agent.domain])}</CapsuleTag>}
                </>
              }
              action={<AgentCardActions agent={agent} onChanged={() => void data.refresh()} />}
            />
            </UpgradeCard>
          ))}
        </div>
      )}
    </DevPageLayout>
  )
}

import { UpgradeCard } from "@/features/artifact-upgrade/UpgradeGate"
import { BrandButton, Empty, Tile, useDialog } from "@/ui"
import { useT } from "@/i18n"
import type { McpApp } from "@/mock/fixtures/dev"
import { mcpAppService } from "@/services"
import { DEV_GRID, DevPageLayout } from "@/features/dev-page/DevPageLayout"
import { DynamicSkillIcon } from "@/features/dev-page/DynamicSkillIcon"
import { useDevList } from "@/features/dev-page/use-dev-list"
import { useStartSession } from "@/features/dev-page/use-start-session"
import { McpAppDetailDialog } from "@/features/mcp-app-detail/McpAppDetailDialog"
import { matchCategory, statusColor, statusKey } from "@/features/mcp-app-detail/status"
import { McpAppCardActions } from "./McpAppCardActions"
import { McpAppUploadDialog } from "./McpAppUploadDialog"

/**
 * 业务组件开发页：卡片列表 + 状态页签（暂存 / 待审核 / 已发布 / 已驳回）+ 搜索。
 * 卡片左下是线上状态，右下是本地构建状态；点卡片看详情，「导入」上传 zip 包。
 */
export function McpAppDevPage() {
  const t = useT()
  const dialog = useDialog()
  const startSession = useStartSession()
  const data = useDevList<McpApp>({
    queryKey: "mcp-apps",
    fetch: mcpAppService.list,
    matchTab: matchCategory,
    searchText: (app) => `${app.appName} ${app.appCode} ${app.appDescription}`,
  })
  const refresh = () => void data.refresh()
  const list = [...data.list].sort((a, b) => a.appName.localeCompare(b.appName))

  return (
    <DevPageLayout
      title={t("kcode.mcpApp.title")}
      searchWrapperStyle={{ background: "color-mix(in srgb, var(--surface-raised-stronger-non-alpha) 64%, transparent)" }}
      addLabel={t("kcode.mcpApp.add")}
      onAdd={() => startSession("/mcp-apps-builder ")}
      addBeforeAction={
        <BrandButton
          variant="secondary"
          size="normal"
          icon="submit-upload"
          iconSize="xs"
          className="[&_[data-component=icon]]:!w-[14px] [&_[data-component=icon]]:!h-[14px] [--brand-button-secondary-hover:#6D80FF]"
          onClick={() => dialog.show(() => <McpAppUploadDialog onUploaded={refresh} />)}
        >
          {t("kcode.mcpApp.upload.button")}
        </BrandButton>
      }
      tabs={[
        { value: "all", label: t("kcode.mcpApp.filter.all") },
        { value: "STAGED", label: t("kcode.mcpApp.filter.draft") },
        { value: "PENDING", label: t("kcode.mcpApp.filter.pendingReview") },
        { value: "PUBLISHED", label: t("kcode.mcpApp.filter.published") },
        { value: "REJECTED", label: t("kcode.mcpApp.filter.rejected") },
      ]}
      tab={data.tab}
      onTabChange={data.setTab}
      searchValue={data.query}
      onSearchChange={data.setQuery}
      onRefresh={data.refresh}
      searchPlaceholder={t("kcode.mcpApp.search")}
    >
      {data.loading ? (
        <div className="text-14-regular text-text-weak py-8 text-center">{t("kcode.mcpApp.loading")}</div>
      ) : list.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-2">
          <Empty description={data.filtered ? t("kcode.mcpApp.empty.noMatch") : undefined} />
        </div>
      ) : (
        <div className={DEV_GRID}>
          {list.map((app) => (
            <UpgradeCard key={app.appCode} id={app.appCode}>
            <Tile
              className="dev-page-tile tile-filled tile-icon-40 group cursor-pointer"
              name={app.appName}
              desc={app.appDescription}
              icon={<DynamicSkillIcon name={app.appName || app.appCode} size={40} />}
              onClick={() => dialog.show(() => <McpAppDetailDialog app={app} />)}
              footer={
                <div className="flex w-full items-center gap-2">
                  <span className={`text-[12px] leading-[18px] whitespace-nowrap ${statusColor(app.mcpStatus)}`}>{t(statusKey(app.mcpStatus))}</span>
                  <span
                    className={`ml-auto text-[12px] leading-[18px] whitespace-nowrap ${app.buildStatus === "success" ? "text-[var(--primary-600)]" : "text-[var(--neutral-500)]"}`}
                  >
                    {t(app.buildStatus === "success" ? "kcode.mcpApp.status.built" : "kcode.mcpApp.status.notBuilt")}
                  </span>
                </div>
              }
              action={<McpAppCardActions app={app} onChanged={refresh} />}
            />
            </UpgradeCard>
          ))}
        </div>
      )}
    </DevPageLayout>
  )
}

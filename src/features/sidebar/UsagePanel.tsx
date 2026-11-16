import { useT } from "@/i18n"
import { Tooltip } from "@/ui"

const usage = { used: 18_420, total: 50_000, renew: "2026.11.01", sharedUsed: 126_800, sharedQuota: 200_000 }
const format = (value: number) => value.toLocaleString("en-US")

/** 用户菜单里的「点数用量」子面板（数据为 mock） */
export function UsagePanel() {
  const t = useT()
  const percent = Math.round((usage.used / usage.total) * 100)
  return (
    <div className="flex w-[320px] flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-[400] leading-[18px] text-[var(--neutral-900)]">{t("sidebar.user.usageOverview")}</span>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-[500] leading-[18px] text-[var(--neutral-800)]">{t("sidebar.user.usagePackage")}</span>
          <span className="text-[14px] font-[400] leading-[18px] text-[var(--neutral-400)]">
            {t("sidebar.user.usageRenewDate").replace("{date}", usage.renew)}
          </span>
        </div>
        <div
          className="h-4 w-full"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            background: `linear-gradient(to right, #04b545 0%, #04b545 ${percent}%, var(--neutral-100) ${percent}%, var(--neutral-100) 100%)`,
            WebkitMask: "repeating-linear-gradient(to right, #000 0 2px, transparent 2px 4px)",
            mask: "repeating-linear-gradient(to right, #000 0 2px, transparent 2px 4px)",
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-[400] leading-[18px] text-[var(--neutral-500)]">
            <span className="text-[var(--neutral-900)]">{format(usage.used)}</span>
            {`/${format(usage.total)}`}
            {t("sidebar.user.usageUsedPercent").replace("{percent}", String(percent))}
          </span>
          <span className="inline-flex items-baseline gap-1 text-[14px] font-[400] leading-[18px] text-[var(--neutral-500)]">
            {t("sidebar.user.usageRemaining")} <span className="text-[var(--neutral-900)]">{format(usage.total - usage.used)}</span>
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-[500] leading-[18px] text-[var(--neutral-800)]">{t("sidebar.user.usageSharedPackage")}</span>
        </div>
        <div className="flex items-center gap-4 rounded-[12px] border border-[var(--neutral-100)] px-4 pb-2 pt-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[12px] font-[500] leading-[18px] text-[var(--neutral-600)]">{t("sidebar.user.usageUsed")}</span>
            <span className="text-[20px] font-[600] leading-[36px] text-[var(--neutral-900)]">{format(usage.sharedUsed)}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="inline-flex items-center gap-1 text-[12px] font-[500] leading-[18px] text-[var(--neutral-600)]">
              {t("sidebar.user.usagePersonalQuota")}
              <Tooltip
                placement="top"
                gutter={6}
                value={<span className="block w-[220px] text-left whitespace-normal">{t("sidebar.user.usageQuotaTooltip")}</span>}
              >
                <span className="inline-flex cursor-pointer items-center">
                  <svg className="h-3 w-3 shrink-0 text-[var(--neutral-400)]" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M8 7.25v4M8 4.75v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
              </Tooltip>
            </span>
            <span className="text-[20px] font-[600] leading-[36px] text-[var(--neutral-900)]">{format(usage.sharedQuota)}</span>
          </div>
        </div>
      </section>
    </div>
  )
}

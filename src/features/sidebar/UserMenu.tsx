import { useState } from "react"
import { useNavigate } from "react-router"
import { Avatar, DropdownMenu, Icon } from "@/ui"
import { inlinePaths } from "@/ui/icon/inline-paths.gen"
import { cx } from "@/lib/cx"
import { LOCALES, localeLabel, useLocaleStore, useT } from "@/i18n"
import { useAuth } from "@/stores/auth"
import { useSync } from "@/stores/sync"
import { useThemeStore, type ColorScheme } from "@/theme"
import { UsagePanel } from "./UsagePanel"

const SUB_TRIGGER =
  "flex h-11 w-full cursor-pointer items-center gap-2 rounded-[16px] px-2 text-[var(--neutral-700)] transition-colors hover:bg-[var(--neutral-50)]"
const ITEM = "flex h-11 cursor-pointer items-center gap-2 rounded-[16px] px-2 text-[var(--neutral-700)]"
const LABEL = "min-w-0 flex-1 truncate text-left text-[14px] font-[400] leading-[18px]"
const SCHEMES: ColorScheme[] = ["system", "light", "dark"]

/** 侧边栏底部的用户入口：点数用量 / 语言 / 主题 / 配置管理 / 退出登录 */
export function UserMenu() {
  const t = useT()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const user = useSync((s) => s.user)
  const { locale, setLocale } = useLocaleStore()
  const { colorScheme, setColorScheme } = useThemeStore()
  const name = user?.displayName || user?.userId || ""

  return (
    <div data-component="sidebar-user-footer" className="relative shrink-0 px-3 py-2">
      <DropdownMenu placement="top-start" open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger className="group flex h-11 w-full items-center gap-2 rounded-[20px] border-none bg-transparent px-1 py-1.5 text-left cursor-pointer transition-colors hover:bg-[var(--neutral-100)]">
          <Avatar fallback={name} className="size-6 shrink-0 rounded-full text-[14px]" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-[500] leading-[20px] text-[var(--neutral-900)]" title={name}>
              {name}
            </div>
          </div>
          <div
            className={cx(
              "flex size-7 shrink-0 items-center justify-center rounded-[10px] text-[var(--neutral-400)] transition-opacity",
              open ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d={inlinePaths.userChevron} fill="currentColor" />
            </svg>
          </div>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="w-[232px] min-w-[232px] rounded-[20px] border-[0.5px] border-[var(--neutral-200)] bg-[var(--neutral-0)] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.08)]">
            <div className="px-2 py-1">
              <div className="truncate text-[14px] font-[500] leading-[20px] text-[var(--neutral-900)]" title={name}>
                {name}
              </div>
              {user?.tenantName && (
                <div className="mt-0.5 truncate text-[12px] font-[400] leading-[16px] text-[var(--neutral-500)]" title={user.tenantName}>
                  {user.tenantName}
                </div>
              )}
            </div>
            <div className="mt-1 mb-1.5 mx-1 h-px bg-[var(--neutral-100)]" />

            <DropdownMenu.Sub gutter={10}>
              <DropdownMenu.SubTrigger className={SUB_TRIGGER}>
                <svg className="h-4 w-4 shrink-0 text-[var(--neutral-600)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" d={inlinePaths.usageClock} fill="currentColor" />
                </svg>
                <span className={LABEL}>{t("sidebar.user.creditsUsage")}</span>
                <Icon name="chevron-right-16" size="small" className="text-[var(--neutral-400)]" />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent className="rounded-[20px] border-[0.5px] border-[var(--neutral-200)] bg-[var(--neutral-0)] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.08)]">
                  <UsagePanel />
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>

            <DropdownMenu.Sub gutter={10}>
              <DropdownMenu.SubTrigger className={SUB_TRIGGER}>
                <Icon name="global" size="small" className="text-[var(--neutral-600)]" />
                <span className={LABEL}>{localeLabel(locale)}</span>
                <Icon name="chevron-right-16" size="small" className="text-[var(--neutral-400)]" />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent style={{ minWidth: 180 }}>
                  {LOCALES.map((item) => (
                    <DropdownMenu.Item key={item} onSelect={() => setLocale(item)} className="flex items-center cursor-pointer">
                      <span className="flex-1 text-left">{localeLabel(item)}</span>
                      {locale === item && <Icon name="check" size="small" className="text-[var(--neutral-600)]" />}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>

            <DropdownMenu.Sub gutter={10}>
              <DropdownMenu.SubTrigger className={SUB_TRIGGER}>
                <Icon name="theme" size="small" className="text-[var(--neutral-600)]" />
                <span className={LABEL}>{t("command.theme.cycle")}</span>
                <Icon name="chevron-right-16" size="small" className="text-[var(--neutral-400)]" />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent style={{ minWidth: 180 }}>
                  {SCHEMES.map((scheme) => (
                    <DropdownMenu.Item key={scheme} onSelect={() => setColorScheme(scheme)} className="flex items-center cursor-pointer">
                      <span className="flex-1 text-left">{t(`theme.scheme.${scheme}`)}</span>
                      {colorScheme === scheme && <Icon name="check" size="small" className="text-[var(--neutral-600)]" />}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>

            <DropdownMenu.Sub gutter={10}>
              <DropdownMenu.SubTrigger className={SUB_TRIGGER}>
                <Icon name="building" size="small" className="text-[var(--neutral-600)]" />
                <span className={LABEL}>切换租户</span>
                <Icon name="chevron-right-16" size="small" />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent style={{ minWidth: 240 }}>
                  {["金蝶软件（中国）有限公司", "灵基演示租户"].map((tenantName) => (
                    <DropdownMenu.Item key={tenantName} className="flex cursor-pointer items-center gap-2" onSelect={() => {
                      useSync.setState((s) => ({ user: s.user ? { ...s.user, tenantName } : undefined }))
                      navigate("/dev/agent")
                    }}>
                      <span className="flex-1">{tenantName}</span>
                      {user?.tenantName === tenantName && <Icon name="check" size="small" />}
                    </DropdownMenu.Item>
                  ))}
                  <p className="px-2 py-1 text-[11px] text-text-weak">原型演示：复用项目数据，分别记录升级状态</p>
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>

            <DropdownMenu.Item onSelect={() => navigate("/settings")} className={ITEM}>
              <Icon name="setting" size="small" className="text-[var(--neutral-600)]" />
              <span className={LABEL}>{t("kcode.nav.configMgmt")}</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={useAuth.getState().logout} className={ITEM}>
              <Icon name="logout" size="small" className="text-[var(--neutral-600)]" />
              <span className={LABEL}>{t("sidebar.user.logout")}</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </div>
  )
}

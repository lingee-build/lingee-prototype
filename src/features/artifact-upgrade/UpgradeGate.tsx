import { ENABLE_ARTIFACT_UPGRADE, SHOW_TENANT_UPGRADE_PROMPT, guardUpgrade, needsUpgrade, initializeTenant, completeUpgrade, useUpgradeStore, legacySessions } from "./upgrade-state"
export { guardUpgrade, needsUpgrade, useUpgradeStore, legacySessions } from "./upgrade-state"
import { useSync } from "@/stores/sync"
import { useAuth } from "@/stores/auth"
import { WarningCircleIcon } from "@/ui/dialog/ConfirmDialog"
import { devStore } from "@/mock/dev-store"
import { useEffect, useState, type ReactNode } from "react"
import { Dialog as Radix } from "radix-ui"
import { useLocation, useNavigate } from "react-router"
import { Icon, showToast } from "@/ui"

/** 独立的公共强制弹窗，不可通过 Esc、空白区域或其他弹窗关闭。 */
export function UpgradeHost() {
  const pending = useUpgradeStore((s) => s.pending)
  const navigate = useNavigate()
  const location = useLocation()
  const account = useAuth((s) => s.account)
  const { ready, user, projects } = useSync()
  const tenant = `${account ?? ""}:${user?.tenantName ?? ""}`
  const inDev = location.pathname.startsWith("/dev/") || location.pathname.startsWith("/p/")
  useEffect(() => {
    if (account && ready && user && inDev) initializeTenant(tenant, projects.map((x) => x.id))
  }, [account, ready, tenant, projects, inDev])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  if (!pending || !account || !inDev || (pending.mode === "tenant" ? !SHOW_TENANT_UPGRADE_PROMPT : !ENABLE_ARTIFACT_UPGRADE)) return null
  const batch = pending.mode === "tenant"
  const upgrade = async () => {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      // 原型模拟快速升级；仅在内存记录升级标记，不执行真实产物迁移。
      await new Promise((resolve) => setTimeout(resolve, 180))
      completeUpgrade(pending.ids)
      showToast({ variant: "success", title: batch ? `升级完成，已升级 ${pending.ids.length} 个产物` : "升级成功" })
      pending.resume()
    } catch {
      setError("升级失败，请重试")
    } finally { setBusy(false) }
  }
  return (
    <Radix.Root open modal>
      <Radix.Portal>
        <Radix.Overlay data-component="dialog-overlay" style={{ zIndex: 1000 }} />
        <Radix.Content
          className="fixed left-1/2 top-1/2 z-[1001] w-[480px] max-w-[calc(100vw-40px)] -translate-x-1/2 -translate-y-1/2 rounded-[24px] bg-background-page px-5 pt-5 pb-6 shadow-[0px_6px_16px_0px_rgba(0,0,0,0.12)] outline-none"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center">
              <WarningCircleIcon className="size-5 text-[var(--primary-600)]" />
            </div>
            <Radix.Title className="text-16-medium text-text-strong">{batch ? "升级产物结构" : "产物需要升级"}</Radix.Title>
          </div>
          <Radix.Description className="ml-8 mt-2 text-14-regular leading-[22px] text-text-base">
            {batch ? "为统一灵基产物标准，需升级本地项目下的智能体、技能和业务组件产物包。" : "为统一灵基产物标准，需升级产物包结构。升级不影响原有能力，完成后即可继续使用。"}
          </Radix.Description>
          {batch && <div className="ml-8 mt-3 space-y-3 text-14-regular leading-[22px] text-text-base">
            <p>升级会调整文件结构和新增部分文件，<strong className="font-medium text-text-strong">不会影响原有能力，请放心升级。</strong></p>
          </div>}
          {!batch && pending.ids.length > 1 && <p className="mt-2 text-12-regular text-text-base">将同时升级当前会话关联的 {pending.ids.length} 个产物。</p>}
          {error && <p role="alert" className="mt-3 text-14-regular text-[var(--danger-600)]">{error}</p>}
          {batch && <p className="ml-8 mt-4 text-[12px] leading-5 text-text-weak break-words">
            升级范围：{user?.tenantName} · 全部 {projects.length} 个项目 · {pending.ids.length} 个待升级产物
          </p>}
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" className="h-[34px] cursor-pointer rounded-[8px] border-none bg-transparent px-3 text-14-regular text-text-base transition-colors hover:bg-surface-base-hover disabled:opacity-50" disabled={busy} onClick={() => {
              const path = pending.ids.some((id) => devStore.agents.some((agent) => agent.id === id)) ? "/dev/agent" : "/dev/skill"
              useUpgradeStore.setState({ pending: undefined })
              setError("")
              if (location.pathname.startsWith("/p/")) {
                const sessionId = location.pathname.split("/").pop() ?? ""
                const linked = legacySessions[sessionId] ?? []
                // 选择稍后时回到列表，避免留在尚未升级的开发会话继续修改。
                if (!batch || needsUpgrade(linked).length) navigate(path)
              }
            }}>{batch ? "稍后逐个升级" : "取消"}</button>
            <button type="button" className="h-[34px] cursor-pointer rounded-[8px] border-none bg-[var(--brand-button-primary-base)] px-4 text-14-regular [color:#fff] transition-opacity hover:opacity-90 disabled:opacity-50" disabled={busy} onClick={() => void upgrade()}>{error ? "重试" : batch ? "一键升级" : "立即升级"}</button>
          </div>
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  )
}

/** 旧产物整张卡片锁定，升级状态只保留在本次页面生命周期。 */
export function UpgradeCard(props: { id: string; children: ReactNode }) {
  useUpgradeStore((s) => s.upgraded)
  const locked = ENABLE_ARTIFACT_UPGRADE && needsUpgrade([props.id]).length > 0
  return (
    <div className="relative min-w-0">
      <div inert={locked || undefined}>{props.children}</div>
      {locked && (
        <button
          type="button"
          aria-label="升级不影响原有能力，立即升级"
          className="absolute inset-0 z-10 flex cursor-pointer items-end rounded-[24px] border-none p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-600)]"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.45) 42%, rgba(255,255,255,0.98) 76%)", boxShadow: "inset 0 0 0 1px rgba(125,120,160,0.08)" }}
          onClick={() => guardUpgrade([props.id], () => {})}
        >
          <span className="flex w-full items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[12px] leading-5 text-[var(--text-tile-desc)]">
              <Icon name="shield-check" size="small" className="!size-3.5 opacity-60" />
              升级不影响原有能力
            </span>
            <span className="shrink-0 rounded-[8px] px-3 py-1.5 text-[12px] font-medium leading-[18px]" style={{ background: "#F0EDFF", color: "#6655D5" }}>立即升级</span>
          </span>
        </button>
      )}
    </div>
  )
}

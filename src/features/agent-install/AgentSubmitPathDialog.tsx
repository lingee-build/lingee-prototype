import { useState } from "react"
import { BrandButton, Dialog, Icon, useDialog } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { Agent } from "@/mock/fixtures/dev"

export type AgentSubmitRoute = "enterprise" | "personal"

const LABEL: Record<AgentSubmitRoute, string> = { enterprise: "企业分发", personal: "个人自用" }

const DESC: Record<AgentSubmitRoute, string> = {
  enterprise: "适合团队共享，提交后需管理员在 Console 审核通过才会发布",
  personal: "适合本人独立使用，检测通过后即时提交到 Work，无需审核",
}

/**
 * 提交智能体第 1 步：选择路径（企业分发 / 个人自用）。卡片结构与样式照抄技能的 SkillSubmitPathDialog。
 * 企业分发不可用时（审核中 / 已发布且无修改）置灰并说明原因，个人自用始终可选。
 */
export function AgentSubmitPathDialog(props: { agent: Agent; enterpriseDisabledReason?: string; onConfirm: (route: AgentSubmitRoute) => void }) {
  const t = useT()
  const dialog = useDialog()
  const disabledEnt = !!props.enterpriseDisabledReason
  const [route, setRoute] = useState<AgentSubmitRoute>(disabledEnt ? "personal" : "enterprise")
  const option = (value: AgentSubmitRoute, icon: "building" | "user", iconClass: string, disabled?: boolean) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setRoute(value)}
      className={cx(
        "w-full cursor-pointer rounded-[16px] border-2 bg-transparent px-5 py-5 text-left disabled:cursor-not-allowed disabled:opacity-50",
        route === value ? "border-[#495DFF]" : "border-[var(--border-weak-base)]",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cx("flex size-7 items-center justify-center rounded-[8px]", iconClass)}>
          <Icon name={icon} size="small" className="size-4" />
        </span>
        <span className="text-[16px] font-medium text-text-strong">{LABEL[value]}</span>
      </div>
      <div className="mt-2 text-[13px] leading-[20px] text-text-weak">{disabled ? props.enterpriseDisabledReason : DESC[value]}</div>
    </button>
  )
  return (
    <Dialog title="提交智能体 · 选择路径" fit className="w-[520px] !rounded-[24px] overflow-hidden">
      <div className="space-y-3 px-5 pb-5">
        {option("enterprise", "building", "bg-[rgba(73,93,255,0.08)] text-[#495DFF]", disabledEnt)}
        {option("personal", "user", "bg-[var(--orange-50)] text-[var(--orange-600)]")}
        <div className="flex justify-end gap-3 pt-6">
          <BrandButton variant="auxiliary" size="normal" onClick={dialog.close}>{t("kcode.skillSubmit.pathSelect.cancel")}</BrandButton>
          <BrandButton variant="primary" size="normal" onClick={() => { dialog.close(); props.onConfirm(route) }}>{t("kcode.skillSubmit.pathSelect.submit")}</BrandButton>
        </div>
      </div>
    </Dialog>
  )
}

import { useEffect, useState, type ReactNode } from "react"
import { useNavigate } from "react-router"
import { EvaluationLabel } from "@/features/evaluation/EvaluationPanel"
import { DropdownMenu, Icon, type IconName } from "@/ui"
import { useT } from "@/i18n"
import type { Agent } from "@/mock/fixtures/dev"
import { DOT_BUTTON } from "@/features/dev-page/DevPageLayout"
import { canRemove, canSubmit, canWithdraw, useAgentActions, type AgentBusy } from "@/features/agent-actions/use-agent-actions"
import { cx } from "@/lib/cx"

const Spinner = () => (
  <span
    style={{ display: "inline-block", width: 12, height: 12, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", flexShrink: 0 }}
  />
)

/**
 * 智能体卡片右上角的「…」菜单：编辑 / 本地测试 / 云端测试 / 评测 / 提交 / 撤回 / 删除。
 * 平时悬停卡片才出现；测试、提交这类耗时操作进行中菜单保持打开并在对应项后面转圈，结束后自动收起。
 */
export function AgentCardActions(props: { agent: Agent; onChanged: () => void }) {
  const t = useT()
  const navigate = useNavigate()
  const { agent } = props
  const [open, setOpen] = useState(false)
  const actions = useAgentActions(props.onChanged)
  const busy = actions.busy

  useEffect(() => {
    if (!busy) setOpen(false)
  }, [busy])

  const item = (icon: IconName, label: ReactNode, onSelect: () => void, loading?: AgentBusy, keepOpen?: boolean) => (
    <DropdownMenu.Item
      disabled={!!busy}
      className="flex items-center cursor-pointer gap-1"
      onSelect={(e) => {
        if (keepOpen) e.preventDefault()
        onSelect()
      }}
    >
      <Icon name={icon} size="small" />
      <span>{label}</span>
      {loading && busy === loading && <Spinner />}
    </DropdownMenu.Item>
  )

  return (
    <div
      className={cx(
        "flex items-center transition-opacity duration-150",
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu placement="bottom-start" open={open} onOpenChange={(next) => (next || !busy) && setOpen(next)}>
        <DropdownMenu.Trigger aria-label="more" className={DOT_BUTTON}>
          <Icon name="dot-grid" size="small" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content style={{ minWidth: 100 }}>
            {item("edit-doc-16", t("kcode.agentDev.menu.edit"), () => actions.edit(agent))}
            {item("test-flask", t("kcode.agentConfig.localTest"), () => void actions.localTest(agent), "localTest", true)}
            {item("cloud-test", t("kcode.agentConfig.test"), () => actions.cloudTest(agent), "test", true)}
            {item("checklist", <EvaluationLabel />, () => navigate(`/dev/agent/${encodeURIComponent(agent.id)}/evaluation`))}
            {item("export", "导出", () => void actions.export(agent))}
            {canSubmit(agent) && item("submit-upload", t("kcode.agentConfig.submit"), () => actions.submit(agent), "submit")}
            {canWithdraw(agent) && item("undo", t("kcode.agentDev.action.withdraw"), () => actions.withdraw(agent), "withdraw")}
            {canRemove(agent) && (
              <DropdownMenu.Item onSelect={() => actions.remove(agent)} className="group/delete flex items-center cursor-pointer gap-1" variant="destructive">
                <Icon name="trash-16" size="small" className="group-hover/delete:text-[var(--text-on-error-base)]" />
                <span className="group-hover/delete:text-[var(--text-on-error-base)]">{t("kcode.agentDev.menu.delete")}</span>
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </div>
  )
}

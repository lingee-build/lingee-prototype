import { useState } from "react"
import { useNavigate } from "react-router"
import { EvaluationLabel } from "@/features/evaluation/EvaluationPanel"
import { DropdownMenu, Icon } from "@/ui"
import { useT } from "@/i18n"
import type { Skill } from "@/mock/fixtures/dev"
import { DOT_BUTTON } from "@/features/dev-page/DevPageLayout"

export interface SkillActionHandlers {
  onExport: (skill: Skill) => void
  onEdit: (skill: Skill) => void
  onLocalTest: (skill: Skill) => void
  onCloudTest: (skill: Skill) => void
  onCheck: (skill: Skill) => void
  onSubmit: (skill: Skill) => void
  onWithdraw: (skill: Skill) => void
  onDelete: (skill: Skill) => void
}

const ITEM = "flex items-center cursor-pointer gap-1"

/** 技能卡片右上角的「…」菜单：编辑 / 本地测试 / 云端测试 / 评测 / 检查 / 提交 /（审核中才有）撤回 / 删除 */
export function SkillCardActions(props: { skill: Skill; handlers: SkillActionHandlers; lockTip?: string }) {
  const t = useT()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { skill, handlers } = props
  return (
    <div className="flex items-center">
      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu placement="bottom-start" open={open} onOpenChange={setOpen}>
          <DropdownMenu.Trigger aria-label="more" className={DOT_BUTTON}>
            <Icon name="dot-grid" size="small" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="skill-card-actions-menu" style={{ minWidth: 100 }}>
              <DropdownMenu.Item onSelect={() => handlers.onEdit(skill)} className={ITEM}>
                <Icon name="edit-doc-16" size="small" />
                <span>{t("kcode.skillDev.action.edit")}</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => handlers.onLocalTest(skill)} className={ITEM}>
                <Icon name="test-flask" size="small" />
                <span>{t("kcode.skillPreview.action.localTest")}</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => handlers.onCloudTest(skill)} className={ITEM}>
                <Icon name="cloud-test" size="small" />
                <span>{t("kcode.skillPreview.action.test")}</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => navigate(`/dev/skill/${encodeURIComponent(skill.id)}/evaluation`)} className={ITEM}>
                <Icon name="checklist" size="small" />
                <EvaluationLabel />
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => handlers.onExport(skill)} className={ITEM}>
                <Icon name="export" size="small" />
                <span>导出</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => handlers.onCheck(skill)} className={ITEM}>
                <Icon name="shield-check" size="small" />
                <span>{t("kcode.skillDev.action.check")}</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => handlers.onSubmit(skill)} disabled={!!props.lockTip} title={props.lockTip} className={ITEM}>
                <Icon name="submit-upload" size="small" />
                <span>{t("kcode.skillPreview.action.submit")}</span>
              </DropdownMenu.Item>
              {skill.enterpriseStatus === "submitted" && (
                <DropdownMenu.Item onSelect={() => handlers.onWithdraw(skill)} disabled={!!props.lockTip} title={props.lockTip} className={ITEM}>
                  <Icon name="undo" size="small" />
                  <span>{t("kcode.skillDev.action.withdraw")}</span>
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item onSelect={() => handlers.onDelete(skill)} className="group/delete flex items-center cursor-pointer gap-1" variant="destructive">
                <Icon name="trash-16" size="small" className="group-hover/delete:text-[var(--text-on-error-base)]" />
                <span className="group-hover/delete:text-[var(--text-on-error-base)]">{t("kcode.skillDev.action.delete")}</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu>
      </div>
    </div>
  )
}

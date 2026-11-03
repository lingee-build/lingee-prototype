import { useNavigate } from "react-router"
import { ObjectEvaluationReport } from "@/features/evaluation/ObjectEvaluationReport"
import { useMemo, useState, type CSSProperties } from "react"
import { BrandButton, CapsuleTag, Dialog, Icon, Markdown, SegmentedControl, Tag, Tooltip, useDialog } from "@/ui"
import { cx } from "@/lib/cx"
import { useLocaleStore, useT } from "@/i18n"
import { buildFixPrompt } from "@/vendor/kcode-web/src/utils/skill-fix-prompts"
import type { Skill } from "@/mock/fixtures/dev"
import { skillDetailOf } from "@/mock/fixtures/skill-detail"
import { DynamicSkillIcon } from "@/features/dev-page/DynamicSkillIcon"
import { CheckTab } from "./CheckTab"
import { summarize, validationOf } from "./validation"
import { OverviewTab } from "./OverviewTab"

type DetailTab = "overview" | "preview" | "check" | "evaluation"

function MetaCell(props: { label: string; value: string; className?: string; icon?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 py-4">
      <div className="flex items-center gap-1.5">
        {props.icon && <Icon name="shield-check" size="small" className={cx("size-4", props.className)} />}
        <span className={cx("text-[16px] font-medium leading-[30px]", props.className ?? "text-text-strong")}>{props.value}</span>
      </div>
      <span className="text-[14px] leading-[20px] text-[var(--neutral-500)]">{props.label}</span>
    </div>
  )
}

const Divider = () => <div className="w-[0.5px] h-[50px] bg-[var(--neutral-100)] self-center" />

/**
 * 技能详情弹窗：顶部状态提示 + 标题栏 + 四格元数据 + 三个页签（概述 / 预览 / 检查）。
 * 检查页签里点某条规则的「去修复」，会关掉弹窗并带着修复提示词进入编辑会话。
 * 结构对齐原工程 pages/host-modal/skill-detail.tsx。
 */
export function SkillDetailDialog(props: { skill: Skill; initialTab?: DetailTab; onEdit: () => void; onFix: (prompt: string) => void }) {
  const t = useT()
  const dialog = useDialog()
  const navigate = useNavigate()
  const { skill } = props
  const detail = useMemo(() => skillDetailOf(skill), [skill])
  const [tab, setTab] = useState<DetailTab>(props.initialTab ?? "overview")
  // 检查过的技能带着上一次的报告，没检查过的显示「未检测」
  const locale = useLocaleStore((s) => s.locale)
  const groups = useMemo(() => validationOf(skill, locale), [skill, locale])
  const [checked, setChecked] = useState(!!skill.inspect)
  const submitted = skill.enterpriseStatus !== "saved"
  const security = !checked
    ? { text: t("kcode.skillDev.meta.securityCheck.notDetected"), color: "text-[var(--warning-600)]" }
    : summarize(groups).block === 0
      ? { text: t("kcode.skillDev.meta.securityCheck.noRisk"), color: "text-[var(--success-600)]" }
      : { text: t("kcode.skillDev.meta.securityCheck.hasRisk"), color: "text-[var(--warning-600)]" }
  const rejectionReason = skill.reason ? t("ui.tile.rejectionReason", { reason: skill.reason }) : ""

  return (
    <Dialog title={t("kcode.skillDev.detail.title")} fit className="w-[640px] !max-w-[94vw] !rounded-[24px] overflow-hidden shadow-[0px_6px_12px_rgba(0,0,0,0.08)]">
      <div className="relative flex flex-col max-h-[80vh] min-h-0">
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          {skill.changed && submitted && (
            <div
              className={cx(
                "mx-auto mb-4 w-[600px] min-h-[42px] rounded-[24px] pt-[4px] pb-[4px] pl-[12px] pr-[12px] flex items-center gap-[8px] border shrink-0",
                skill.enterpriseStatus === "rejected"
                  ? "bg-[var(--orange-50)] border-[var(--orange-200)]"
                  : "bg-[linear-gradient(to_right,rgba(77,137,255,0.03),rgba(77,137,255,0))] border-[rgba(77,137,255,0.08)]",
              )}
            >
              <Icon
                name="info-fill"
                size="small"
                className={cx("size-5 shrink-0", skill.enterpriseStatus === "rejected" ? "text-[var(--orange-600)]" : "text-[var(--primary-600)]")}
              />
              <span className="text-[16px] leading-[24px] text-[var(--gray-800)]">
                {t(`kcode.skillDev.changedTip.${skill.enterpriseStatus}`)}
                {skill.enterpriseStatus === "rejected" && rejectionReason}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 px-6 pb-4 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <DynamicSkillIcon name={skill.displayName} size={60} />
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[16px] font-medium leading-[24px] text-text-strong truncate min-w-0" title={skill.displayName}>
                    {skill.displayName}
                  </span>
                  <CapsuleTag className="shrink-0">{skill.category}</CapsuleTag>
                  {submitted &&
                    (skill.enterpriseStatus === "rejected" && rejectionReason ? (
                      <Tooltip value={rejectionReason} placement="top" gutter={4}>
                        <Tag type="error" className="whitespace-nowrap shrink-0 cursor-pointer">
                          {t(`kcode.skillDev.enterpriseStatus.${skill.enterpriseStatus}`)}
                        </Tag>
                      </Tooltip>
                    ) : (
                      <Tag type={skill.enterpriseStatus === "rejected" ? "error" : "normal"} className="whitespace-nowrap shrink-0">
                        {t(`kcode.skillDev.enterpriseStatus.${skill.enterpriseStatus}`)}
                      </Tag>
                    ))}
                  {skill.personalInstalled && (
                    <Tag type="normal" className="whitespace-nowrap shrink-0">
                      {t("kcode.skillDev.personalStatus.published")}
                    </Tag>
                  )}
                  {skill.changed && (submitted || skill.personalInstalled) && (
                    <Tooltip value={t("kcode.skillDev.changedTip.local")} placement="top" gutter={4}>
                      <Tag type="normal" className="whitespace-nowrap shrink-0 cursor-pointer">
                        {t("kcode.skillDev.status.localChanged")}
                      </Tag>
                    </Tooltip>
                  )}
                </div>
                <span className="text-[14px] text-[var(--text-tile-desc)] font-medium leading-[22px] truncate" title={skill.name}>
                  {skill.name}
                </span>
              </div>
            </div>
            <BrandButton
              variant="primary"
              size="normal"
              className="shrink-0"
              onClick={() => {
                dialog.close()
                props.onEdit()
              }}
            >
              {t("kcode.skillDev.action.edit")}
            </BrandButton>
          </div>

          <div className="flex mb-4 mx-6 border border-[var(--neutral-130)] rounded-[16px] shrink-0">
            <MetaCell label={t("kcode.skillDev.meta.developer")} value={detail.developer} />
            <Divider />
            <MetaCell label={t("kcode.skillDev.meta.securityCheck")} value={security.text} className={security.color} icon />
            <Divider />
            <MetaCell label={t("kcode.skillDev.meta.updateTime")} value={detail.updateTime} />
            <Divider />
            <MetaCell label={t("kcode.skillDev.meta.version")} value={detail.version} />
          </div>

          <div
            className="light-segmented flex items-center px-6 pb-3 shrink-0"
          >
            <SegmentedControl
              value={tab}
              onChange={value => setTab(value as DetailTab)}
              items={[...(["overview", "preview", "check"] as const).map((value) => ({ value, label: t(`kcode.skillPreview.tab.${value}`) })), {value:"evaluation", label:"评测报告"}]}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {tab === "evaluation" && <ObjectEvaluationReport objectId={`skill:${skill.id}`} open={url => { dialog.close(); navigate(url) }} />}
            {tab === "overview" && <OverviewTab skill={skill} detail={detail} />}
            {tab === "preview" && (
              <div className="flex-1 px-6 pb-4 select-text">
                <Markdown text={detail.content.replace(/^---\n[\s\S]*?\n---\n/, "")} className="skill-detail-markdown leading-relaxed" />
              </div>
            )}
            {tab === "check" && (
              <CheckTab
                groups={groups}
                checked={checked}
                onChecked={() => setChecked(true)}
                onFixPrompt={(ruleId, message) => {
                  dialog.close()
                  props.onFix(buildFixPrompt(ruleId, message, { skillName: skill.name, skillDir: `skills/${skill.name}` }))
                }}
              />
            )}
          </div>
        </div>
      </div>
    </Dialog>
  )
}

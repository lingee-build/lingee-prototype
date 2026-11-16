import { BrandButton, Empty, Icon, useDialog } from "@/ui"
import { useT } from "@/i18n"
import { useQuery } from "@tanstack/react-query"
import { skillService } from "@/services"
import { marketLocalState, type MarketLocalState } from "@/features/skill-publish-scope/SkillPublishScopeDialog"
import type { AgentSkill } from "@/mock/fixtures/dev"
import { DynamicSkillIcon } from "@/features/dev-page/DynamicSkillIcon"
import { AddSkillDialog } from "./AddSkillDialog"
import { SkillDetailDialog } from "@/features/skill-detail/SkillDetailDialog"
import { useEditSession } from "@/features/dev-page/use-edit-session"
import type { TabProps } from "./form"

/**
 * 技能来源 + 状态小标签。
 * - 商城技能：「商城技能」，本地发布后又修改显示「已保存」，更新审核中显示「审核中」
 * - 其余：「本地技能 | 已发布 / 审核中 / 未发布」
 */
export function SkillTags(props: { source?: AgentSkill["source"]; status?: AgentSkill["publishStatus"]; localState?: MarketLocalState }) {
  const t = useT()
  const cloud = props.source === "marketplace"
  const divider = <span className="shrink-0 w-px h-[10px]" style={{ background: "var(--border-weak-base)" }} />
  if (cloud)
    return (
      <>
        <span className="shrink-0 text-[12px] leading-[18px]" style={{ color: "var(--text-base)" }}>{t("kcode.agentConfig.skills.sourceCloud")}</span>
        {props.localState && divider}
        {props.localState === "changed" && <span className="shrink-0 text-[12px] leading-[18px] text-[var(--text-base)]" title="技能发布后本地有修改，需先提交技能审核">已保存</span>}
        {props.localState === "reviewing" && <span className="shrink-0 text-[12px] leading-[18px]" style={{ color: "rgba(41,112,255,1)" }}>审核中</span>}
      </>
    )
  const status =
    props.localState === "changed"
      ? { label: "已保存", color: "var(--text-base)" }
      : props.localState !== "reviewing" && props.status === "published"
      ? { label: t("kcode.agentConfig.skills.statusPublished"), color: "rgba(4,181,69,1)" }
      : props.localState === "reviewing" || props.status === "reviewing"
        ? { label: t("kcode.agentConfig.skills.statusReviewing"), color: "rgba(41,112,255,1)" }
        : { label: t("kcode.agentConfig.skills.statusUnpublished"), color: "var(--text-base)" }
  return (
    <>
      <span className="shrink-0 text-[12px] leading-[18px]" style={{ color: "var(--text-base)" }}>{t("kcode.agentConfig.skills.sourceLocal")}</span>
      {props.status && divider}
      {props.status && <span className="shrink-0 text-[12px] leading-[18px]" style={{ color: status.color }}>{status.label}</span>}
    </>
  )
}
/** 「技能」页签：已挂的技能列表，悬停出现移除按钮；「添加」打开技能选择弹窗 */
export function SkillConfigTab(props: TabProps & { projectId: string }) {
  const t = useT()
  const dialog = useDialog()
  const { form, set, readonly } = props
  // 商城技能需校验本地是否有改动，用实时技能数据计算状态
  const all = useQuery({ queryKey: ["skills"], queryFn: skillService.list, staleTime: 0 })
  const localOf = (name: string) => all.data?.find((x) => x.name === name)
  const editSession = useEditSession()
  const openDetail = (name: string) => {
    const skill = localOf(name)
    if (!skill) return
    const editDraft = (extra = "") => {
      const draft = t("kcode.skillDev.edit.draft", { name: skill.displayName })
      void editSession({ title: draft.replace(/[:：]\s*$/, ""), draft: `/kingdee-skill-creator ${draft}${extra}`, projectId: skill.projectId, target: { kdskill: skill.id } })
    }
    dialog.show(() => <SkillDetailDialog skill={skill} onEdit={() => editDraft()} onFix={(prompt) => editDraft(prompt)} />)
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {!readonly && (
        <div className="shrink-0 flex justify-start">
          <BrandButton
            variant="auxiliary"
            size="normal"
            icon="plus-16"
            iconSize="small"
            onClick={() => dialog.show(() => <AddSkillDialog projectId={props.projectId} selected={form.skills} onConfirm={(skills) => set({ skills })} />)}
          >
            {t("kcode.agentConfig.skills.addBtn")}
          </BrandButton>
        </div>
      )}
      {form.skills.length === 0 ? (
        <Empty className="py-12" />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-3">
          {form.skills.map((skill) => (
            <div key={skill.id} onClick={() => openDetail(skill.skillName)} className="group flex cursor-pointer items-center gap-3 agent-config-list-card hover:border-[#C7CAFF] border border-[var(--border-weak-base)] bg-[var(--input-base)] px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                <DynamicSkillIcon name={skill.name} size={40} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[14px] leading-5 font-medium text-text-strong select-text mr-1" title={skill.name}>
                    {skill.name}
                  </span>
                  <SkillTags source={skill.source} status={skill.publishStatus} localState={marketLocalState(localOf(skill.skillName))} />
                </div>
                <span className="text-12-regular text-text-weak truncate" title={skill.desc}>
                  {skill.desc}
                </span>
              </div>
              {!skill.builtin && !readonly && (
                <button
                  type="button"
                  className="hidden group-hover:flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg [--icon-fill:var(--text-secondary)] hover:bg-[rgba(255,158,166,0.12)] hover:[--icon-fill:var(--text-on-error-base)]"
                  onClick={(e) => { e.stopPropagation(); set({ skills: form.skills.filter((x) => x.id !== skill.id) }) }}
                >
                  <Icon name="trash-fill" size="small" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

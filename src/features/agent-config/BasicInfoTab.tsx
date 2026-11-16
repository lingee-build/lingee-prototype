import { AgentAudienceFields, AgentDisplayEditor, AgentDisplayOverview } from "./AgentDisplaySection"
import type { ReactNode } from "react"
import { Input, Switch } from "@/ui"
import { useT } from "@/i18n"
import type { TabProps } from "./form"
import { ModelLevelSelect } from "./selects"
import { AgentAvatarPicker } from "./AgentAvatarPicker"

/**
 * 基础信息：基本资料（含适用人群、示例问法）→ 介绍与场景 → 模型策略 → 更新日志。
 * 每个分区都是「标题 + 卡片」，与原配置页一致。
 */
export function BasicInfoTab(props: TabProps & { agentId: string; history: ReactNode; displayAttempt: number }) {
  const t = useT()
  const { form, set, readonly } = props

  return (
    <div className="agent-basic-info flex flex-col">
      {readonly ? <AgentDisplayOverview info={form.displayInfo} description={form.desc} /> : (
        <>
          <section className="agent-display-group">
            <div className="agent-config-surface agent-config-fields">
              <div className="agent-config-identity-row">
                <div className="agent-config-avatar-field shrink-0">
                  <AgentAvatarPicker agentId={props.agentId} value={form.avatar} disabled={readonly} onChange={(avatar) => set({ avatar })} />
                </div>
                <div className="min-w-0 flex-1">
                  <Input label={t("kcode.agentConfig.basic.name")} required value={form.name} onChange={(name) => set({ name })}
                    placeholder={t("kcode.agentConfig.basic.namePlaceholder")} />
                </div>
              </div>
              <Input label={t("kcode.agentConfig.basic.desc")} required multiline value={form.desc} onChange={(desc) => set({ desc })}
                placeholder={t("kcode.agentConfig.basic.descPlaceholder")} className="min-h-[56px] max-h-[160px] overflow-y-auto" />
              <AgentAudienceFields info={form.displayInfo} onChange={displayInfo => set({ displayInfo })} attempt={props.displayAttempt} />
            </div>
          </section>
          <AgentDisplayEditor info={form.displayInfo} onChange={displayInfo => set({ displayInfo })} attempt={props.displayAttempt} />
        </>
      )}

      <section className="agent-display-group">
        <h3 className="agent-config-section-title">{t("kcode.agentConfig.basic.modelPolicy.title")}</h3>
        <div className="agent-config-surface flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[14px] leading-5 text-text-strong">{t("kcode.agentConfig.basic.modelPolicy.allowSwitch")}</span>
              <span className="text-[12px] leading-4 text-text-weak">{t("kcode.agentConfig.basic.modelPolicy.allowSwitchDesc")}</span>
            </div>
            <Switch className="shrink-0" checked={form.allowModelSwitch} onChange={(allowModelSwitch) => set({ allowModelSwitch })} readOnly={readonly} hideLabel>
              {t("kcode.agentConfig.basic.modelPolicy.allowSwitch")}
            </Switch>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[14px] leading-5 text-text-strong">{t("kcode.agentConfig.basic.modelPolicy.defaultLevel")}</span>
              <span className="text-[12px] leading-4 text-text-weak">{t(`kcode.agentConfig.basic.modelPolicy.levelDesc.${form.defaultModelLevel}`)}</span>
            </div>
            <ModelLevelSelect value={form.defaultModelLevel} onChange={(defaultModelLevel) => set({ defaultModelLevel })} readonly={readonly} />
          </div>
        </div>
      </section>
      {props.history}
    </div>
  )
}

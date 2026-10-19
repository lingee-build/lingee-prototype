import { Input, Switch } from "@/ui"
import { useT } from "@/i18n"
import type { TabProps } from "./form"
import { DomainSelect, ModelLevelSelect } from "./selects"
import { AgentAvatarPicker } from "./AgentAvatarPicker"

/** 基础表单与模型策略共用配置页的卡片、标题和间距规范。 */
export function BasicInfoTab(props: TabProps & { agentId: string; hideIdentity?: boolean }) {
  const t = useT()
  const { form, set, readonly } = props

  return (
    <div className="agent-basic-info flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        {props.hideIdentity && <h3 className="agent-config-section-title" data-compact>{t("kcode.agentConfig.basic.desc")}</h3>}
        {props.hideIdentity ? (
          <div className="agent-config-surface text-[14px] leading-[22px] text-text-base whitespace-pre-wrap break-words">{form.desc}</div>
        ) : (
          <div className="agent-config-surface agent-config-fields">
            <div className="agent-config-identity-row">
              <div className="agent-config-avatar-field shrink-0">
                <AgentAvatarPicker agentId={props.agentId} value={form.avatar} disabled={readonly} onChange={(avatar) => set({ avatar })} />
              </div>
              <div className="min-w-0 flex-1">
            <Input
              label={t("kcode.agentConfig.basic.name")}
              required
              readOnly={readonly}
              value={form.name}
              onChange={(name) => set({ name })}
              placeholder={t("kcode.agentConfig.basic.namePlaceholder")}
            />
              </div>
            </div>
            <DomainSelect value={form.domain} onChange={(domain) => set({ domain })} label={t("kcode.agentConfig.basic.domain")} readonly={readonly} />
            <Input
              label={t("kcode.agentConfig.basic.desc")}
              required
              multiline
              readOnly={readonly}
              value={form.desc}
              onChange={(desc) => set({ desc })}
              placeholder={t("kcode.agentConfig.basic.descPlaceholder")}
              className="min-h-[88px] max-h-[160px] overflow-y-auto"
            />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="agent-config-section-title" data-compact={props.hideIdentity || undefined}>
          {t("kcode.agentConfig.basic.modelPolicy.title")}
        </h3>
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
    </div>
  )
}

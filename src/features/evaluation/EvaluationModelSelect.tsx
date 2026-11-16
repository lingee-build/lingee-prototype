import { useId, useState } from "react"
import { ModelGlyph, ModelOptionContent } from "@/features/prompt-input/ModelSelector"
import { DropdownMenu, Icon } from "@/ui"
import { useT } from "@/i18n"
import type { Model } from "@/mock/types"

/** 复用应用模型目录；选择仅回传当前表单，不写入开发对话的模型配置。 */
export function EvaluationModelSelect({ label, hint, value, models, onChange, error, disabled, defaultId, defaultLabel }: {
  label: string; hint: string; value: string; models: Model[]; onChange: (id: string) => void
  error?: string; disabled?: boolean; defaultId: string; defaultLabel: string
}) {
  const t = useT()
  const id = useId()
  const [open, setOpen] = useState(false)
  const current = models.find(model => model.id === value)
  const name = (model: Model) => model.modelLevel ? t(`model.displayName.${model.modelLevel}`) : model.name
  const ordered = [...models.filter(model => model.modelLevel), ...models.filter(model => !model.modelLevel)]
  const choose = (model: Model) => { onChange(model.id); setOpen(false) }
  return <div className="eval-model-field">
    <label id={`${id}-label`} htmlFor={`${id}-trigger`}>{label}</label>
    <DropdownMenu open={open} onOpenChange={setOpen} placement="bottom-start" gutter={6}>
      <DropdownMenu.Trigger asChild>
        <button type="button" id={`${id}-trigger`} className="kcode-model-selector__trigger eval-model-trigger" disabled={disabled}
          aria-labelledby={`${id}-label ${id}-value`} aria-invalid={!!error}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}>
          <ModelGlyph model={current} />
          <span id={`${id}-value`} className="kcode-model-selector__trigger-label eval-model-label"
            title={current ? current.id === defaultId ? defaultLabel : name(current) : undefined}>
            {current ? name(current) : value || t("proto.eval.models.choose")}
          </span>
          <Icon name="arrow-down-12" size="small" className="kcode-model-selector__trigger-chevron size-3 shrink-0" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="kcode-model-selector__popover eval-model-popover" aria-label={label}>
          <div className="kcode-model-selector__model-list eval-model-options" role="listbox" aria-label={label}>
            {ordered.map(model => <DropdownMenu.Item key={model.id} role="option" aria-selected={model.id === value}
              className="kcode-model-selector__model-option" onSelect={() => choose(model)}>
              <ModelOptionContent model={model} selected={model.id === value} label={name(model)} />
            </DropdownMenu.Item>)}
          </div>
          {!ordered.length && <p className="eval-model-empty" role="status">{t("proto.eval.models.empty")}</p>}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
    <p id={`${id}-hint`} className="eval-muted">{hint}</p>
    {error && <p id={`${id}-error`} className="eval-field-error" role="alert">{error}</p>}
  </div>
}

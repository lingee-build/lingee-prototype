import { useId, useState } from "react"
import { ModelOptionContent } from "@/features/prompt-input/ModelSelector"
import { DropdownMenu, Icon } from "@/ui"
import { useT } from "@/i18n"
import type { Model } from "@/mock/types"

/** 复用应用模型目录；选择仅回传当前表单，不写入开发对话的模型配置。 */
export function EvaluationModelSelect({ label, hint, value, models, onChange, error, disabled, defaultId, defaultLabel, multiple, onMultipleChange }: {
  label: string; hint?: string; value: string; models: Model[]; onChange: (id: string) => void
  error?: string; disabled?: boolean; defaultId: string; defaultLabel: string; multiple?: string[]; onMultipleChange?: (ids:string[])=>void
}) {
  const t = useT()
  const id = useId()
  const [open, setOpen] = useState(false)
  const current = models.find(model => model.id === value)
  const name = (model: Model) => model.modelLevel ? t(`model.displayName.${model.modelLevel}`) : model.name
  const ordered = [...models.filter(model => model.modelLevel), ...models.filter(model => !model.modelLevel)]
  const choose = (model: Model) => { if(multiple) { onMultipleChange?.(multiple.includes(model.id)?multiple.filter(id=>id!==model.id):[...multiple,model.id]);return } onChange(model.id); setOpen(false) }
  return <div className="eval-model-field">
    <label id={`${id}-label`} htmlFor={`${id}-trigger`}>{label}</label>
    <DropdownMenu open={open} onOpenChange={setOpen} placement="bottom-start" gutter={6}>
      <DropdownMenu.Trigger asChild>
        <button type="button" id={`${id}-trigger`} className="eval-model-trigger" disabled={disabled}
          aria-labelledby={`${id}-label ${id}-value`} aria-invalid={!!error}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}>

          <span id={`${id}-value`} className="eval-model-label"
            title={multiple?.length ? multiple.map(id => models.find(model => model.id === id)?.name ?? id).join(" · ") : current ? name(current) : undefined}>
            {multiple ? <span className="eval-model-selection">{multiple.length ? <>{multiple.slice(0, 2).map(id=><span className="eval-model-chip" key={id}>{models.find(m=>m.id===id)?.name || id}</span>)}{multiple.length > 2 && <span className="eval-model-chip eval-model-chip-count">+{multiple.length - 2}</span>}</> : "选择执行模型"}</span> : current ? name(current) : value || t("proto.eval.models.choose")}
          </span>
          <Icon name="chevron-down" size="small" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="kcode-model-selector__popover eval-model-popover" aria-label={label}>
          <div className="kcode-model-selector__model-list eval-model-options" role="group" aria-label={label}>
            {ordered.map(model => <DropdownMenu.Item key={model.id} role="menuitemcheckbox" aria-checked={multiple ? multiple.includes(model.id) : model.id === value}
              className="kcode-model-selector__model-option" onSelect={event => {if(multiple) event.preventDefault();choose(model)}}>
              <ModelOptionContent model={model} selected={multiple ? multiple.includes(model.id) : model.id === value} label={name(model)} />
            </DropdownMenu.Item>)}
          </div>
          {!ordered.length && <p className="eval-model-empty" role="status">{t("proto.eval.models.empty")}</p>}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
    {hint && <p id={`${id}-hint`} className="eval-muted">{hint}</p>}
    {error && <p id={`${id}-error`} className="eval-field-error" role="alert">{error}</p>}
  </div>
}

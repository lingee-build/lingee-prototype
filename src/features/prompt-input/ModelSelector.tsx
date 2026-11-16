import { useState } from "react"
import { Button, DropdownMenu, Icon, TooltipKeybind, type IconName } from "@/ui"
import { useT } from "@/i18n"
import type { Model } from "@/mock/types"
import { usePrompt } from "@/stores/prompt"
import { useSync } from "@/stores/sync"

const brandIcons = import.meta.glob<string>("../../source-runtime/model-icons/*.svg", { eager: true, import: "default", query: "?url" })
const brandIcon = (model: Model) => {
  if (model.modelLevel) return undefined
  const text = `${model.id} ${model.name}`.toLowerCase()
  const brand = ["qwen", "deepseek", "kimi", "minimax", "trae", "seed"].find((name) => text.includes(name)) ?? (text.includes("glm") ? "gml" : text.includes("hy3") || text.includes("hy-") ? "hy" : text.includes("step-5") ? "step" : undefined)
  return brand ? brandIcons[`../../source-runtime/model-icons/model-${brand}-16.svg`] : undefined
}

const levelIcon = (level?: string): IconName =>
  level === "fast" ? "lightning-charge" : level === "deep" ? "deep-thinking" : level === "expert" ? "level" : "models"

const formatCoefficient = (value?: string) => (value ? `${parseFloat(value).toFixed(1)}x` : undefined)

export function ModelGlyph({ model }: { model?: Model }) {
  const source = model && brandIcon(model)
  return source ? <img src={source} alt="" className="size-4 shrink-0 object-contain" /> : <Icon name={model ? levelIcon(model.modelLevel) : "models"} size="small" className="shrink-0 text-[var(--neutral-600)]" />
}

export function ModelOptionContent({ model, selected, label }: { model: Model; selected: boolean; label: string }) {
  return <>
                        {brandIcon(model) ? <img src={brandIcon(model)} alt="" className="size-4 shrink-0 object-contain" /> : <Icon name={levelIcon(model.modelLevel)} size="small" className="shrink-0" />}
                        <span className="kcode-model-selector__model-main">
                          <span className="kcode-model-selector__model-label" title={label}>
                            {label}
                          </span>
                        </span>
                        <span className="kcode-model-selector__model-end">
                          {model.consumptionCoefficient && (
                            <span className="kcode-model-selector__model-ratio">{formatCoefficient(model.consumptionCoefficient)}</span>
                          )}
                          {selected && (
                            <span className="kcode-model-selector__model-check">
                              <Icon name="check" size="small" />
                            </span>
                          )}
                        </span>
  </>
}

/** 模型选择器：等级模型（快速/深度/专家）在前，其余模型在后，右侧展示消耗系数 */
export function ModelSelector(props: { placement: "top-end" | "bottom-end"; restoreFocus: () => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const models = useSync((s) => s.models)
  const { modelId, setModel } = usePrompt()
  const current = models.find((x) => x.id === modelId)
  const label = (model: Model) => (model.modelLevel ? t(`model.displayName.${model.modelLevel}`) : model.name)
  const ordered = [...models.filter((x) => x.modelLevel), ...models.filter((x) => !x.modelLevel)]

  return (
    <TooltipKeybind placement="top" gutter={4} title={current ? label(current) : t("command.model.choose")}>
      <DropdownMenu open={open} onOpenChange={setOpen} placement={props.placement} gutter={8}>
        <DropdownMenu.Trigger asChild>
          <Button
            variant="ghost"
            size="normal"
            className="kcode-model-selector__trigger group max-w-[200px] h-9 py-[7px] px-[8px] rounded-[12px] text-[var(--prompt-input-trigger-text)] text-[14px] font-[400] leading-[22px] gap-1 hover:bg-[var(--prompt-input-trigger-bg)] border-none"
            data-action="prompt-model"
          >
            {current && brandIcon(current) ? <img src={brandIcon(current)} alt="" className="size-4 shrink-0 object-contain" /> : <Icon name={current ? levelIcon(current.modelLevel) : "refresh"} size="small" className="shrink-0 text-[var(--neutral-600)]" />}
            <span className="kcode-model-selector__trigger-label truncate text-[14px] leading-[22px] font-[400] text-[var(--neutral-700)]">{current ? label(current) : ""}</span>
            <Icon
              name="arrow-down-12"
              size="small"
              className="kcode-model-selector__trigger-chevron size-3 shrink-0 transition-transform duration-150 group-data-[expanded]:rotate-180 text-[var(--neutral-700)]"
            />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="kcode-model-selector__popover"
            style={{ height: Math.min(ordered.length * 34 + 8, 312) }}
            onCloseAutoFocus={(e) => { e.preventDefault(); props.restoreFocus() }}
          >
            <div className="kcode-model-selector__viewport">
              <section className="kcode-model-selector__panel kcode-model-selector__panel--models" tabIndex={-1}>
                <div className="kcode-model-selector__scroll">
                  <div className="kcode-model-selector__model-list" role="listbox" aria-label={t("model.selector.aria.chooseModel")}>
                    {ordered.map((model) => (
                      <DropdownMenu.Item
                        key={model.id}
                        className="kcode-model-selector__model-option"
                        role="option"
                        aria-selected={model.id === modelId}
                        onSelect={() => setModel(model.id)}
                      >
                        <ModelOptionContent model={model} selected={model.id === modelId} label={label(model)} />
                      </DropdownMenu.Item>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </TooltipKeybind>
  )
}

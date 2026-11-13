import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { useT } from "@/i18n"
import type { AgentDisplayInfo } from "@/mock/fixtures/dev"
import { Icon, IconButton, Input, Tag, Tooltip, showToast } from "@/ui"
import { AUDIENCE_LIMIT, displayInfoErrors, QUESTION_LIMIT, questionLength } from "./display-info"

const key = (name: string) => `proto.agentDisplay.${name}`
const introFields = ["coreValue", "coreAdvantage"] as const
const scenarioFields = ["title", "problem", "solution"] as const
type ScenarioField = (typeof scenarioFields)[number]
const emptyScenario = { title: "", problem: "", solution: "" }

/** 只读的「标签 + 内容」行，标签列定宽让各卡片内容起点对齐 */
function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="agent-info-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** 适用人群标签：详情与编辑共用，填写时看到的就是展示效果 */
function AudienceTag({ label, removeLabel, onRemove }: { label: string; removeLabel?: string; onRemove?: () => void }) {
  return (
    <Tag type="normal" className="agent-audience-tag" title={label}>
      <span className="min-w-0 truncate">{label}</span>
      {onRemove && (
        <button type="button" aria-label={removeLabel} onClick={onRemove}>
          <Icon name="close-small" size="small" />
        </button>
      )}
    </Tag>
  )
}

/** 示例问法 + 复制，交互与会话里的复制按钮一致 */
function ExampleQuestion({ text }: { text: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      showToast({ variant: "error", title: t(key("copyFailed")) })
    }
  }
  return (
    <div className="agent-info-question">
      <span>{text}</span>
      <Tooltip value={t(key(copied ? "copied" : "copy"))} placement="top" gutter={4}>
        <IconButton icon={copied ? "check" : "copy"} variant="ghost" iconSize="small" aria-label={t(key("copy"))} onClick={() => void copy()} />
      </Tooltip>
    </div>
  )
}

/**
 * 场景页签：沿用产品的下划线页签（tabs alt 样式），标签显示场景名称，未填名称时显示「场景 n」。
 * 编辑时末尾是「+ 添加」，当前场景可点 × 删除；有错误的场景名后加红点。
 */
function ScenarioTabs({ titles, value, onChange, invalid, onAdd, onRemove }: {
  titles: string[]; value: number; onChange: (index: number) => void
  invalid?: (index: number) => boolean; onAdd?: () => void; onRemove?: (index: number) => void
}) {
  const t = useT()
  return (
    <div data-component="tabs" data-variant="alt" data-orientation="horizontal" className="agent-scenario-tabs">
      <div data-slot="tabs-list" role="tablist" aria-label={t(key("scenarios"))}>
        {titles.map((title, index) => {
          const label = title.trim() || t(key("scenarioItem"), { index: index + 1 })
          const selected = index === value
          return (
            <div key={index} data-slot="tabs-trigger-wrapper">
              <button type="button" role="tab" aria-selected={selected} data-slot="tabs-trigger" data-selected={selected ? "" : undefined} title={label}
                onClick={() => onChange(index)}>
                {label}
                {invalid?.(index) && <i className="agent-tab-dot" aria-hidden="true" />}
              </button>
              {onRemove && selected && (
                <span data-slot="tabs-trigger-close-button">
                  <IconButton icon="close-small" variant="ghost" aria-label={t(key("removeScenario"), { index: index + 1 })} onClick={() => onRemove(index)} />
                </span>
              )}
            </div>
          )
        })}
        {onAdd && (
          <div data-slot="tabs-trigger-wrapper">
            <button type="button" data-slot="tabs-trigger" className="agent-scenario-add" onClick={onAdd}>
              <Icon name="plus-16" size="small" />{t(key("add"))}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 详情（只读）：概览卡片（描述 / 人群 / 问法）+ 介绍与场景卡片。
 * 历史智能体没有这些字段时仍显示字段名，值显示「未填写」，让开发者知道需要补充，版式也不随数据变化。
 */
export function AgentDisplayOverview({ info, description }: { info: AgentDisplayInfo; description: string }) {
  const t = useT()
  const [active, setActive] = useState(0)
  const empty = <span className="text-text-weak">{t(key("empty"))}</span>
  const scenarios = info.businessScenarios
  const current = Math.min(active, scenarios.length - 1)
  const scenario = scenarios[current]
  return (
    <div className="agent-display-overview">
      <dl className="agent-config-surface agent-info-list">
        <InfoRow label={t("kcode.agentConfig.basic.desc")}>{description || empty}</InfoRow>
        <InfoRow label={t(key("audience"))}>
          {info.targetAudience.length ? (
            <span className="agent-audience-tags">
              {info.targetAudience.map((value, index) => <AudienceTag key={`${index}-${value}`} label={value} />)}
            </span>
          ) : empty}
        </InfoRow>
        <InfoRow label={t(key("question"))}>{info.exampleQuestion ? <ExampleQuestion text={info.exampleQuestion} /> : empty}</InfoRow>
      </dl>
      <section className="agent-display-group">
        <h3 className="agent-config-section-title">{t(key("introScenarios"))}</h3>
        <div className="agent-config-surface agent-info-list">
          {introFields.map(field => <InfoRow key={field} label={t(key(field))}>{info.detailedIntroduction[field] || empty}</InfoRow>)}
          <InfoRow label={t(key("scenarios"))}>
            {scenario ? (
              <div className="agent-scenario-panel">
                <ScenarioTabs titles={scenarios.map(item => item.title)} value={current} onChange={setActive} />
                <div className="agent-scenario-body">
                  <p><span className="text-text-weak">{t(key("problem"))}：</span>{scenario.problem || empty}</p>
                  <p><span className="text-text-weak">{t(key("solution"))}：</span>{scenario.solution || empty}</p>
                </div>
              </div>
            ) : empty}
          </InfoRow>
        </div>
      </section>
    </div>
  )
}

/** 适用人群：外观沿用公共输入框，已填写的人群以标签显示在框内；回车添加，退格删除最后一项 */
function AudienceField({ value, onChange, error }: { value: string[]; onChange: (value: string[]) => void; error?: string }) {
  const t = useT()
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState("")
  const [notice, setNotice] = useState("")
  const full = value.length >= AUDIENCE_LIMIT
  const message = notice || error
  const commit = () => {
    const text = draft.trim()
    if (!text) return setDraft("")
    if (value.includes(text)) return setNotice(t(key("audienceExists")))
    if (full) return
    onChange([...value, text])
    setDraft("")
  }
  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
    setNotice("")
    requestAnimationFrame(() => input.current?.focus())
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === "Enter") {
      event.preventDefault()
      commit()
    } else if (event.key === "Backspace" && !draft && value.length) {
      event.preventDefault()
      remove(value.length - 1)
    }
  }
  const placeholder = full ? "audienceFull" : value.length ? "audienceMore" : "audiencePlaceholder"

  return (
    <div data-component="form-input" className="agent-audience-field">
      <div data-slot="form-input-label-row">
        <label data-slot="form-input-label" htmlFor={id}>{t(key("audience"))}</label>
        <span data-slot="form-input-required">*</span>
        <span className="agent-field-count" aria-hidden="true">{value.length}/{AUDIENCE_LIMIT}</span>
      </div>
      <div data-slot="form-input-wrapper" className="agent-tag-input"
        onMouseDown={(event) => {
          if (event.target !== event.currentTarget) return
          event.preventDefault()
          input.current?.focus()
        }}>
        {value.map((item, index) => (
          <AudienceTag key={`${index}-${item}`} label={item} removeLabel={t(key("removeAudience"), { name: item })} onRemove={() => remove(index)} />
        ))}
        <input ref={input} id={id} data-slot="form-input-field" data-invalid={message ? "" : undefined} aria-invalid={message ? true : undefined}
          value={draft} disabled={full} placeholder={t(key(placeholder))}
          onChange={(event) => { setDraft(event.currentTarget.value); setNotice("") }}
          onKeyDown={onKeyDown} onBlur={commit} />
      </div>
      {message && <div data-slot="form-input-error">{message}</div>}
    </div>
  )
}

/** 带字数的示例问法输入框，字数放在标签行右侧 */
function QuestionInput({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
  const t = useT()
  const size = questionLength(value.trim())
  const over = size > QUESTION_LIMIT
  return (
    <div className="agent-counted-field">
      <Input label={t(key("question"))} required value={value} error={over ? t(key("questionLimit")) : error}
        placeholder={t(key("questionPlaceholder"))} onChange={onChange} />
      <span className="agent-field-count" data-over={over || undefined} aria-hidden="true">{size}/{QUESTION_LIMIT}</span>
    </div>
  )
}

/** 适用人群与示例问法：放进「基本资料」卡片，紧跟功能描述 */
export function AgentAudienceFields({ info, onChange, attempt }: { info: AgentDisplayInfo; onChange: (info: AgentDisplayInfo) => void; attempt: number }) {
  const t = useT()
  const errors = displayInfoErrors(info)
  const error = (name: string) => (attempt > 0 && errors[name] ? t(key(errors[name])) : undefined)
  return (
    <>
      <AudienceField value={info.targetAudience} error={error("audience")} onChange={targetAudience => onChange({ ...info, targetAudience })} />
      <QuestionInput value={info.exampleQuestion} error={error("question")} onChange={exampleQuestion => onChange({ ...info, exampleQuestion })} />
    </>
  )
}

/**
 * 介绍与场景：核心价值、核心优势、业务场景放在同一张卡片。
 * 业务场景用页签切换，每次只显示一个场景；保存校验失败时切到第一个出错的场景。
 */
export function AgentDisplayEditor({ info, onChange, attempt }: {
  info: AgentDisplayInfo
  onChange: (info: AgentDisplayInfo) => void
  /** 保存尝试次数，大于 0 才显示错误 */
  attempt: number
}) {
  const t = useT()
  const id = useId()
  const [active, setActive] = useState(0)
  const errors = displayInfoErrors(info)
  const patch = (value: Partial<AgentDisplayInfo>) => onChange({ ...info, ...value })
  const error = (name: string) => (attempt > 0 && errors[name] ? t(key(errors[name])) : undefined)
  // 历史智能体没有场景时，先给一个空白的「场景 1」直接填写；未输入前不算新增，也不产生修改
  const placeholder = info.businessScenarios.length === 0
  const scenarios = placeholder ? [emptyScenario] : info.businessScenarios
  const current = Math.min(active, scenarios.length - 1)
  const scenario = scenarios[current]
  const fieldError = (index: number, field: ScenarioField) =>
    errors[`scenario-${index}-${field}`] ?? (placeholder && errors.scenarios ? "required" : undefined)
  const scenarioInvalid = (index: number) => attempt > 0 && scenarioFields.some(field => fieldError(index, field))
  const scenariosError = error("scenarios")

  useEffect(() => {
    if (!attempt) return
    const index = scenarios.findIndex((_, i) => scenarioFields.some(field => fieldError(i, field)))
    if (index >= 0) setActive(index)
  }, [attempt])

  const updateScenario = (field: ScenarioField, value: string) =>
    patch({ businessScenarios: scenarios.map((item, i) => (i === current ? { ...item, [field]: value } : item)) })
  const addScenario = () => {
    setActive(scenarios.length)
    patch({ businessScenarios: [...scenarios, { ...emptyScenario }] })
    requestAnimationFrame(() => document.getElementById(`${id}-scenario`)?.querySelector<HTMLInputElement>("input")?.focus())
  }
  const removeScenario = (index: number) => {
    patch({ businessScenarios: scenarios.filter((_, i) => i !== index) })
    setActive(Math.max(0, index - 1))
  }

  return (
    <section className="agent-display-group">
      <h3 className="agent-config-section-title">{t(key("introScenarios"))}</h3>
      <div className="agent-config-surface agent-config-fields">
        {introFields.map(field => (
          <Input key={field} label={t(key(field))} required multiline className="min-h-[56px] max-h-[160px] overflow-y-auto"
            value={info.detailedIntroduction[field]} error={error(field)} placeholder={t(key(`${field}Placeholder`))}
            onChange={value => patch({ detailedIntroduction: { ...info.detailedIntroduction, [field]: value } })} />
        ))}
        <div data-component="form-input">
          <div data-slot="form-input-label-row">
            <span data-slot="form-input-label">{t(key("scenarios"))}</span>
            <span data-slot="form-input-required">*</span>
          </div>
          <div className="agent-scenario-panel agent-scenario-editor" data-display-invalid={scenariosError ? "" : undefined}>
            <ScenarioTabs titles={scenarios.map(item => item.title)} value={current} onChange={setActive} invalid={scenarioInvalid}
              onAdd={addScenario} onRemove={scenarios.length > 1 ? removeScenario : undefined} />
            {scenario ? (
              <div id={`${id}-scenario`} className="agent-config-fields agent-scenario-form" role="tabpanel" aria-label={t(key("scenarioItem"), { index: current + 1 })}>
                {scenarioFields.map(field => (
                  <Input key={`${current}-${field}`} label={t(key(field))} required multiline={field !== "title"} value={scenario[field]}
                    className={field === "title" ? undefined : "min-h-[56px] max-h-[160px] overflow-y-auto"}
                    placeholder={t(key(`${field}Placeholder`))} error={attempt > 0 && fieldError(current, field) ? t(key(fieldError(current, field)!)) : undefined}
                    onChange={value => updateScenario(field, value)} />
                ))}
              </div>
            ) : (
              <p className={`agent-scenario-form ${scenariosError ? "agent-display-error" : "agent-display-hint"}`}>{scenariosError ?? t(key("scenarioEmpty"))}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

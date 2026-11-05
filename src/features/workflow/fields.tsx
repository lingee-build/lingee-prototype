import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { DropdownMenu, Icon, IconButton, Input, Tooltip } from "@/ui"
import { cx } from "@/lib/cx"

/** 表单字段标签：与 Build 的 Input 标签同一层级（14px，text-weak） */
export function FieldLabel(props: { children: ReactNode; hint?: ReactNode; id?: string; required?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span id={props.id} className="text-[14px] leading-5 text-text-weak">
        {props.children}
        {props.required && <span className="ml-0.5 text-[var(--danger-600,#e53535)]">*</span>}
      </span>
      {props.hint && <span className="text-[12px] leading-[18px] text-[var(--text-weaker)]">{props.hint}</span>}
    </div>
  )
}

/** 右栏分组：标题 + 右侧操作，组之间用分隔线，长配置也能一眼看出结构 */
export function Section(props: { title: string; action?: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="workflow-group">
      <div className="workflow-group-head">
        <span className="text-[13px] font-[500] leading-5 text-text-strong">{props.title}</span>
        {props.hint && <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-weaker)]">{props.hint}</span>}
        {props.action}
      </div>
      <div className="flex flex-col gap-3">{props.children}</div>
    </section>
  )
}

export function AddButton(props: { label: string; onClick: () => void; disabled?: boolean; icon?: "plus-16" | "dash" }) {
  return (
    <button type="button" className="workflow-add" disabled={props.disabled} onClick={props.onClick}>
      <Icon name={props.icon ?? "plus-16"} size="small" />
      {props.label}
    </button>
  )
}

export function RemoveButton(props: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Tooltip value={props.label} placement="top" gutter={4}>
      <IconButton icon="close-small" variant="ghost" size="small" aria-label={props.label} disabled={props.disabled} onClick={props.onClick} />
    </Tooltip>
  )
}

export interface SelectOption {
  value: string
  label: string
  desc?: string
}

/** 下拉选择：结构与样式照搬智能体配置里的领域下拉（菜单与触发器等宽，选中项打勾） */
export function Select(props: {
  label?: string
  value: string
  placeholder?: string
  options: SelectOption[]
  onChange: (value: string) => void
  invalid?: boolean
  disabled?: boolean
  size?: "normal" | "small"
  required?: boolean
}) {
  const labelId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const [width, setWidth] = useState(0)
  const current = props.options.find((x) => x.value === props.value)
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {props.label && (
        <FieldLabel id={labelId} required={props.required}>
          {props.label}
        </FieldLabel>
      )}
      <DropdownMenu placement="bottom-start" gutter={4} onOpenChange={(open) => open && trigger.current && setWidth(trigger.current.getBoundingClientRect().width)}>
        <DropdownMenu.Trigger
          ref={trigger}
          disabled={props.disabled}
          aria-labelledby={props.label ? labelId : undefined}
          className={cx(
            "flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 border bg-[var(--input-base)] px-3 transition-colors duration-150 hover:border-[var(--border-base)] disabled:cursor-default disabled:opacity-60 [&[data-expanded]]:border-[var(--border-selected)]",
            props.size === "small" ? "h-8 rounded-xl" : "h-9 rounded-2xl",
            props.invalid ? "border-[var(--danger-600,#e53535)]" : "border-[var(--border-weak-base)]",
          )}
        >
          <span className={cx("truncate leading-5", props.size === "small" ? "text-[13px]" : "text-[14px]", current ? "text-text-strong" : "text-[var(--text-weaker)]")}>{current?.label ?? props.placeholder}</span>
          <Icon name="chevron-down-16" size="small" className="text-text-weak shrink-0" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="!z-[10001] max-h-[320px] overflow-y-auto" style={{ minWidth: Math.max(width, 180) }}>
            {props.options.length === 0 && <div className="px-3 py-2 text-[13px] text-[var(--text-weaker)]">没有可选项</div>}
            {props.options.map((option) => (
              <DropdownMenu.Item key={option.value || "__empty"} onSelect={() => props.onChange(option.value)}>
                <div className="flex min-w-0 flex-1 flex-col">
                  <DropdownMenu.ItemLabel className="truncate text-text-strong">{option.label}</DropdownMenu.ItemLabel>
                  {option.desc && <span className="truncate text-[12px] leading-[18px] text-[var(--text-weaker)]">{option.desc}</span>}
                </div>
                {props.value === option.value && (
                  <DropdownMenu.ItemIndicator>
                    <Icon name="check" size="small" className="text-[var(--neutral-600)]" />
                  </DropdownMenu.ItemIndicator>
                )}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </div>
  )
}

/** 紧凑的单行文本框（列表行内用），失焦时提交 */
export function InlineText(props: { value: string; placeholder?: string; onCommit: (value: string) => void; disabled?: boolean; className?: string; ariaLabel?: string; type?: "text" | "number" }) {
  const [value, setValue] = useState(props.value)
  useEffect(() => setValue(props.value), [props.value])
  return (
    <input
      className={cx("workflow-inline-input", props.className)}
      value={value}
      type={props.type}
      placeholder={props.placeholder}
      aria-label={props.ariaLabel ?? props.placeholder}
      disabled={props.disabled}
      onChange={(e) => setValue(e.currentTarget.value)}
      onBlur={() => value !== props.value && props.onCommit(value)}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
    />
  )
}

/** Build 输入框 + 失焦提交：节点名称、任务说明这类主字段用它 */
export function TextField(props: { label: string; value: string; onCommit: (value: string) => void; multiline?: boolean; required?: boolean; placeholder?: string; readOnly?: boolean; hint?: string }) {
  const [value, setValue] = useState(props.value)
  useEffect(() => setValue(props.value), [props.value])
  return (
    <div className="flex flex-col gap-1.5" onBlur={() => value !== props.value && (!props.required || value.trim()) && props.onCommit(props.required ? value.trim() : value)}>
      <Input
        label={props.label}
        required={props.required}
        multiline={props.multiline}
        className={props.multiline ? "min-h-[72px] max-h-[200px]" : undefined}
        value={value}
        onChange={setValue}
        readOnly={props.readOnly}
        placeholder={props.placeholder}
        error={props.required && !value.trim() ? `${props.label}不能为空` : undefined}
      />
      {props.hint && <p className="workflow-hint">{props.hint}</p>}
    </div>
  )
}

/** 代码 / JSON 编辑区：等宽字体，失焦提交 */
export function CodeField(props: { label?: string; value: string; onCommit: (value: string) => void; readOnly?: boolean; minHeight?: number; hint?: string }) {
  const [value, setValue] = useState(props.value)
  useEffect(() => setValue(props.value), [props.value])
  return (
    <div className="flex flex-col gap-2">
      {props.label && <FieldLabel>{props.label}</FieldLabel>}
      <textarea
        className="workflow-code"
        style={props.minHeight ? { minHeight: props.minHeight } : undefined}
        spellCheck={false}
        value={value}
        readOnly={props.readOnly}
        aria-label={props.label}
        onChange={(e) => setValue(e.currentTarget.value)}
        onBlur={() => value !== props.value && props.onCommit(value)}
      />
      {props.hint && <p className="workflow-hint">{props.hint}</p>}
    </div>
  )
}

/** 勾选框：与原设计器一致的行内勾选 */
export function Check(props: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className="workflow-check">
      <input type="checkbox" checked={props.checked} disabled={props.disabled} onChange={(e) => props.onChange(e.currentTarget.checked)} />
      {props.label}
    </label>
  )
}

/** 只读值：所属并行节点、汇聚策略这类由结构决定、不能直接改的项 */
export function ReadonlyField(props: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>{props.label}</FieldLabel>
      <div className="workflow-readonly">{props.value || "—"}</div>
    </div>
  )
}

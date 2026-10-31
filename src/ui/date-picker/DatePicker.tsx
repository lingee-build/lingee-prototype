import { useState } from "react"
import { Popover } from "radix-ui"

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const parse = (value: string) => new Date(`${value}T12:00:00`)

/** React adapter for Build's shared date-picker slots and theme styles. */
export function DatePicker({ value, onChange, label, min, max }: {
  value: string; onChange: (value: string) => void; label: string; min?: string; max?: string
}) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(new Date())
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
  const days = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay() + i, 12))
  const disabled = (date: string) => !!((min && date < min) || (max && date > max))
  const pick = (date: string) => { if (!disabled(date)) { onChange(date); setOpen(false) } }
  const today = key(new Date())
  return <Popover.Root open={open} onOpenChange={next => { setOpen(next); if (next) setMonth(value ? parse(value) : new Date()) }}>
    <Popover.Trigger className="kui-datetime-trigger" aria-label={label} data-expanded={open ? "" : undefined}>
      <svg data-slot="date-picker-trigger-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/></svg>
      <span data-slot="date-picker-trigger-value" data-placeholder={!value ? "" : undefined}>{value || label}</span>
    </Popover.Trigger>
    <Popover.Portal><Popover.Content className="date-picker-panel z-50" data-component="popover-content" align="start" sideOffset={4} collisionPadding={8} aria-label={label}>
      <div data-slot="popover-body"><div data-component="date-picker">
        <div data-slot="date-picker-body">
          <div data-slot="date-picker-header">
            <button type="button" data-slot="date-picker-nav" aria-label="上个月" onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() - 1, 1))}>‹</button>
            <span data-slot="date-picker-title">{first.getFullYear()}年{first.getMonth() + 1}月</span>
            <button type="button" data-slot="date-picker-nav" aria-label="下个月" onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() + 1, 1))}>›</button>
          </div>
          <div data-slot="date-picker-weekdays">{[..."日一二三四五六"].map(d => <span key={d} data-slot="date-picker-weekday">{d}</span>)}</div>
          <div data-slot="date-picker-grid">{days.map(d => {
            const date = key(d)
            return <button key={date} type="button" data-slot="date-picker-day" aria-label={date} aria-pressed={date === value} disabled={disabled(date)} data-selected={date === value ? "" : undefined} data-today={date === today ? "" : undefined} data-outside={d.getMonth() !== first.getMonth() ? "" : undefined} onClick={() => pick(date)}>{d.getDate()}</button>
          })}</div>
        </div>
        <div data-slot="date-picker-footer"><button type="button" data-slot="date-picker-today" disabled={disabled(today)} onClick={() => pick(today)}>今天</button></div>
      </div></div>
    </Popover.Content></Popover.Portal>
  </Popover.Root>
}

import { DropdownMenu as Radix } from "radix-ui"
import { DropdownMenu, Icon } from "@/ui"

/** Shared selection control using the same menu surface as agent configuration. */
export function EvaluationSelect({ id, label, value, options, onChange, disabled, title }: {
  title?: string
  disabled?: boolean
  id?: string
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return <DropdownMenu placement="bottom-start" gutter={4}>
    <DropdownMenu.Trigger disabled={disabled} title={title} id={id} className="eval-select" aria-label={label}>
      <span>{options.find(option => option.value === value)?.label || value}</span>
      <Icon name="chevron-down-16" size="small" />
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal><DropdownMenu.Content className="eval-select-menu">
      <Radix.RadioGroup value={value} onValueChange={onChange} aria-label={label}>
        {options.map(option => <Radix.RadioItem key={option.value} value={option.value} data-slot="dropdown-menu-item">
          <DropdownMenu.ItemLabel>{option.label}</DropdownMenu.ItemLabel>
          <Radix.ItemIndicator className="eval-select-indicator" aria-hidden="true"><Icon name="check" size="small" /></Radix.ItemIndicator>
        </Radix.RadioItem>)}
      </Radix.RadioGroup>
    </DropdownMenu.Content></DropdownMenu.Portal>
  </DropdownMenu>
}

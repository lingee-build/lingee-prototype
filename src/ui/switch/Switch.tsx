import { useId, useState, type ReactNode } from "react"
import { cx } from "@/lib/cx"

export interface SwitchProps {
  checked: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  /** 只读：禁用交互但保留开关的真实状态色（详情弹窗里用） */
  readOnly?: boolean
  hideLabel?: boolean
  className?: string
  children?: ReactNode
}

/** 开关。DOM 结构与 data 属性对齐 kcode-ui 的 Switch，样式来自同步的 switch.css */
export function Switch(props: SwitchProps) {
  const id = useId()
  // 鼠标点出来的聚焦不画 focus ring，键盘 Tab 进来的才画
  const [pointer, setPointer] = useState(false)
  return (
    <div
      data-component="switch"
      className={props.className}
      data-checked={props.checked ? "" : undefined}
      data-disabled={props.disabled ? "" : undefined}
      data-readonly={props.readOnly ? "" : undefined}
      data-pointer-interaction={pointer ? "" : undefined}
      onPointerDown={() => setPointer(true)}
      onKeyDown={() => setPointer(false)}
      onBlur={() => setPointer(false)}
      onClick={() => !props.disabled && !props.readOnly && props.onChange?.(!props.checked)}
    >
      <input
        id={id}
        type="checkbox"
        role="switch"
        data-slot="switch-input"
        checked={props.checked}
        disabled={props.disabled}
        readOnly
        aria-readonly={props.readOnly}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => !props.readOnly && props.onChange?.(e.currentTarget.checked)}
      />
      {props.children && (
        <label data-slot="switch-label" htmlFor={id} className={cx(props.hideLabel && "sr-only")} onClick={(e) => e.preventDefault()}>
          {props.children}
        </label>
      )}
      <div data-slot="switch-control">
        <div data-slot="switch-thumb" data-checked={props.checked ? "" : undefined} />
      </div>
    </div>
  )
}

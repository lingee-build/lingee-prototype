import { useId, useLayoutEffect, useRef } from "react"

export interface InputProps {
  label?: string
  required?: boolean
  readOnly?: boolean
  disabled?: boolean
  multiline?: boolean
  value: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  error?: string
  /** 只对单行输入框生效 */
  type?: "text" | "password"
  name?: string
  autoComplete?: string
  autoFocus?: boolean
}

/** 带标签的表单输入框（单行 / 多行自适应高度）。结构对齐 kcode-ui 的 Input */
export function Input(props: InputProps) {
  const id = useId()
  const area = useRef<HTMLTextAreaElement>(null)

  // 多行：高度跟着内容走（上限由调用方的 max-h 类控制）
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    const resize = () => {
      el.style.height = "0px"
      el.style.height = `${el.scrollHeight}px`
    }
    resize()
    let width = el.getBoundingClientRect().width
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === width) return
      width = entry.contentRect.width
      resize()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [props.value, props.multiline])

  const shared = {
    id,
    "data-slot": "form-input-field",
    "data-readonly": props.readOnly ? "" : undefined,
    "data-disabled": props.disabled ? "" : undefined,
    className: props.className,
    value: props.value,
    readOnly: props.readOnly,
    disabled: props.disabled,
    placeholder: props.placeholder,
    name: props.name,
    autoComplete: props.autoComplete,
    autoFocus: props.autoFocus,
    "data-invalid": props.error ? "" : undefined,
  }

  return (
    <div
      data-component="form-input"
      data-multiline={props.multiline || undefined}
      data-readonly={props.readOnly ? "" : undefined}
      data-disabled={props.disabled ? "" : undefined}
    >
      {props.label && (
        <div data-slot="form-input-label-row">
          <label data-slot="form-input-label" htmlFor={id}>
            {props.label}
          </label>
          {props.required && <span data-slot="form-input-required">*</span>}
        </div>
      )}
      <div data-slot="form-input-wrapper">
        {props.multiline ? (
          <textarea {...shared} ref={area} onChange={(e) => props.onChange?.(e.currentTarget.value)} />
        ) : (
          <input {...shared} type={props.type} onChange={(e) => props.onChange?.(e.currentTarget.value)} />
        )}
      </div>
      {props.error && <div data-slot="form-input-error">{props.error}</div>}
    </div>
  )
}

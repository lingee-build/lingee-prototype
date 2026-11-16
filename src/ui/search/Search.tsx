import { forwardRef, type CSSProperties, type InputHTMLAttributes } from "react"
import { Icon } from "../icon/Icon"

export interface SearchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  wrapperStyle?: CSSProperties
}

/** 搜索框：有值时放大镜切换为清除按钮（切换由 CSS 的 data-has-value 控制） */
export const Search = forwardRef<HTMLInputElement, SearchProps>(function Search(
  { value, onChange, onClear, wrapperStyle, style, className, ...rest },
  ref,
) {
  return (
    <div data-component="form-search" style={style}>
      <div data-slot="form-search-wrapper" style={wrapperStyle}>
        <input
          {...rest}
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          data-slot="form-search-field"
          className={className}
        />
        <span data-slot="form-search-suffix" data-has-value={value ? "" : undefined}>
          <Icon data-slot="form-search-icon" name="search-16" size="small" />
          <button
            type="button"
            data-slot="form-search-clear"
            onClick={() => {
              onChange("")
              onClear?.()
            }}
          >
            <Icon name="search-clear-16" size="small" />
          </button>
        </span>
      </div>
    </div>
  )
})

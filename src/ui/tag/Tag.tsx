import type { HTMLAttributes } from "react"

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  size?: "normal" | "large"
  type?: "success" | "normal" | "primary" | "warning" | "error" | "disable"
}

export function Tag({ size, type, ...rest }: TagProps) {
  return <span {...rest} data-component="tag" data-size={size || "normal"} data-type={type || "success"} />
}

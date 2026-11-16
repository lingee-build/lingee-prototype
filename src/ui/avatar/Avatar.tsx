import type { CSSProperties, HTMLAttributes } from "react"
import { publicUrl } from "@/lib/public-url"

const segmenter = "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : undefined

function first(value: string) {
  if (!value) return ""
  if (!segmenter) return Array.from(value)[0] ?? ""
  return segmenter.segment(value)[Symbol.iterator]().next().value?.segment ?? Array.from(value)[0] ?? ""
}

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  fallback: string
  src?: string
  background?: string
  foreground?: string
  size?: "small" | "normal" | "large"
}

export function Avatar({ fallback, src, background, foreground, size, style, ...rest }: AvatarProps) {
  return (
    <div
      {...rest}
      data-component="avatar"
      data-size={size || "normal"}
      data-has-image={src ? "" : undefined}
      style={
        {
          ...style,
          ...(!src && background ? { "--avatar-bg": background } : {}),
          ...(!src && foreground ? { "--avatar-fg": foreground } : {}),
        } as CSSProperties
      }
    >
      {src ? <img src={publicUrl(src)} draggable={false} data-slot="avatar-image" /> : first(fallback)}
    </div>
  )
}

import { useId, type CSSProperties } from "react"
import { publicUrl } from "@/lib/public-url"
import { BITMAP_ICONS, chooseIconName } from "./file-icon-names.gen"

const SPRITE = publicUrl("/file-icons/sprite.svg")

export interface FileIconProps {
  node: { path: string; type: "file" | "directory" }
  expanded?: boolean
  /** 单色模式：用图标形状做蒙版、填 currentColor，文件树里未悬停时用它 */
  mono?: boolean
  className?: string
  style?: CSSProperties
}

/** 按文件名 / 扩展名选图标，映射规则与线上一致 */
export function FileIcon(props: FileIconProps) {
  const id = useId()
  const name = chooseIconName(props.node.path, props.node.type, props.expanded ?? false)
  const bitmap = !props.mono && BITMAP_ICONS[name]
  if (bitmap) return <img src={publicUrl(bitmap)} data-component="file-icon" className={props.className} style={props.style} />
  return (
    <svg data-component="file-icon" className={props.className} style={props.style}>
      {props.mono ? (
        <>
          <defs>
            <mask id={id} mask-type="alpha">
              <use href={`${SPRITE}#${name}`} />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="currentColor" mask={`url(#${id})`} />
        </>
      ) : (
        <use href={`${SPRITE}#${name}`} />
      )}
    </svg>
  )
}

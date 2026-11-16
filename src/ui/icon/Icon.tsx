import type { CSSProperties, SVGAttributes } from "react"
import { icons, iconViewBox, type IconName } from "./icons.gen"

export type { IconName }

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, "name"> {
  name: IconName
  size?: "xs" | "small" | "normal" | "medium" | "large"
  containerClass?: string
  style?: CSSProperties
}

export function Icon({ name, size, className, containerClass, ...rest }: IconProps) {
  return (
    <div data-component="icon" data-size={size || "normal"} className={containerClass}>
      <svg
        data-slot="icon-svg"
        className={className}
        fill="none"
        viewBox={iconViewBox(name)}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: icons[name] }}
        {...rest}
      />
    </div>
  )
}

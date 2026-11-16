import { forwardRef, type ButtonHTMLAttributes } from "react"
import { Icon, type IconName, type IconProps } from "../icon/Icon"

type Base = ButtonHTMLAttributes<HTMLButtonElement>

export interface ButtonProps extends Base {
  size?: "small" | "normal" | "large"
  variant?: "primary" | "secondary" | "ghost" | "tertiary" | "text"
  icon?: IconName
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { size, variant, icon, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      data-component="button"
      data-size={size || "normal"}
      data-variant={variant || "secondary"}
      data-icon={icon}
    >
      {icon && <Icon name={icon} size="small" />}
      {children}
    </button>
  )
})

export interface IconButtonProps extends Base {
  icon: IconName
  size?: "small" | "normal" | "large"
  iconSize?: IconProps["size"]
  variant?: "primary" | "secondary" | "ghost"
  iconClass?: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, size, iconSize, variant, iconClass, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      data-component="icon-button"
      data-icon={icon}
      data-size={size || "normal"}
      data-variant={variant || "secondary"}
    >
      <Icon name={icon} size={iconSize ?? (size === "large" ? "normal" : "small")} className={iconClass} />
    </button>
  )
})

export interface BrandButtonProps extends Base {
  size?: "small" | "normal" | "large"
  variant?: "primary" | "secondary" | "ghost" | "auxiliary" | "text"
  icon?: IconName
  iconSize?: IconProps["size"]
}

export const BrandButton = forwardRef<HTMLButtonElement, BrandButtonProps>(function BrandButton(
  { size, variant, icon, iconSize, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      data-component="brand-button"
      data-size={size || "normal"}
      data-variant={variant || "secondary"}
      data-icon={icon}
    >
      {icon && <Icon name={icon} size={iconSize || "small"} />}
      {children}
    </button>
  )
})

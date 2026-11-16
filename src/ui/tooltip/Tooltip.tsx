import type { CSSProperties, ReactNode } from "react"
import { Tooltip as Radix } from "radix-ui"
import { splitPlacement, useKobalteState, type Placement } from "@/lib/kobalte-state"

export interface TooltipProps {
  value: ReactNode
  children: ReactNode
  placement?: Placement
  gutter?: number
  openDelay?: number
  className?: string
  contentClass?: string
  contentStyle?: CSSProperties
  inactive?: boolean
  forceOpen?: boolean
}

export function Tooltip(props: TooltipProps) {
  const ref = useKobalteState<HTMLDivElement>()
  const { side, align } = splitPlacement(props.placement ?? "top")
  if (props.inactive) return <>{props.children}</>
  return (
    <Radix.Root delayDuration={props.openDelay ?? 400} open={props.forceOpen || undefined}>
      <Radix.Trigger asChild>
        <div data-component="tooltip-trigger" className={props.className}>
          {props.children}
        </div>
      </Radix.Trigger>
      <Radix.Portal>
        <Radix.Content
          ref={ref}
          side={side}
          align={align}
          sideOffset={props.gutter ?? 4}
          collisionPadding={8}
          data-component="tooltip"
          data-placement={props.placement ?? "top"}
          data-force-open={props.forceOpen}
          className={props.contentClass}
          style={props.contentStyle}
        >
          {props.value}
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  )
}

export function TooltipKeybind({ title, keybind, ...rest }: Omit<TooltipProps, "value"> & { title: string; keybind?: string }) {
  return (
    <Tooltip
      {...rest}
      value={
        <div data-slot="tooltip-keybind">
          <span>{title}</span>
          {keybind && <span data-slot="tooltip-keybind-key">{keybind}</span>}
        </div>
      }
    />
  )
}

export const TooltipProvider = Radix.Provider

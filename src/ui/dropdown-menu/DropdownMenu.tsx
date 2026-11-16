import { createContext, useContext, type ComponentProps, type CSSProperties } from "react"
import { DropdownMenu as Radix } from "radix-ui"
import { splitPlacement, useKobalteState, type Placement } from "@/lib/kobalte-state"

const PlacementContext = createContext<{ placement?: Placement; gutter?: number }>({})
const SubContext = createContext<{ gutter?: number }>({})

interface RootProps extends ComponentProps<typeof Radix.Root> {
  placement?: Placement
  gutter?: number
}

function Root({ placement, gutter, ...rest }: RootProps) {
  return (
    <PlacementContext.Provider value={{ placement, gutter }}>
      <Radix.Root {...rest} />
    </PlacementContext.Provider>
  )
}

function Trigger(props: ComponentProps<typeof Radix.Trigger>) {
  const ref = useKobalteState<HTMLButtonElement>()
  return <Radix.Trigger type="button" {...props} ref={ref} data-slot="dropdown-menu-trigger" />
}

function Content({ style, ...rest }: ComponentProps<typeof Radix.Content>) {
  const ref = useKobalteState<HTMLDivElement>()
  const ctx = useContext(PlacementContext)
  const { side, align } = splitPlacement(ctx.placement)
  return (
    <Radix.Content
      side={side}
      align={align}
      sideOffset={ctx.gutter ?? 8}
      collisionPadding={8}
      {...rest}
      ref={ref}
      data-component="dropdown-menu-content"
      style={
        {
          "--kb-menu-content-transform-origin": "var(--radix-dropdown-menu-content-transform-origin)",
          ...style,
        } as CSSProperties
      }
    />
  )
}

function Item({ variant, ...rest }: ComponentProps<typeof Radix.Item> & { variant?: "destructive" }) {
  return <Radix.Item {...rest} data-slot="dropdown-menu-item" data-variant={variant} />
}

function Separator(props: ComponentProps<typeof Radix.Separator>) {
  return <Radix.Separator {...props} data-slot="dropdown-menu-separator" />
}

function Group(props: ComponentProps<typeof Radix.Group>) {
  return <Radix.Group {...props} data-slot="dropdown-menu-group" />
}

function GroupLabel(props: ComponentProps<typeof Radix.Label>) {
  return <Radix.Label {...props} data-slot="dropdown-menu-group-label" />
}

function ItemLabel(props: ComponentProps<"div">) {
  return <div {...props} data-slot="dropdown-menu-item-label" />
}

/** 选中项右侧的对勾槽位 */
function ItemIndicator(props: ComponentProps<"div">) {
  return <div {...props} data-slot="dropdown-menu-item-indicator" />
}

function Sub({ gutter, ...rest }: ComponentProps<typeof Radix.Sub> & { placement?: Placement; gutter?: number }) {
  // Radix 的子菜单固定向侧边展开，placement 仅保留签名与原组件一致
  delete (rest as { placement?: Placement }).placement
  return (
    <SubContext.Provider value={{ gutter }}>
      <Radix.Sub {...rest} />
    </SubContext.Provider>
  )
}

function SubTrigger(props: ComponentProps<typeof Radix.SubTrigger>) {
  const ref = useKobalteState<HTMLDivElement>()
  return <Radix.SubTrigger {...props} ref={ref} data-slot="dropdown-menu-sub-trigger" />
}

function SubContent({ style, ...rest }: ComponentProps<typeof Radix.SubContent>) {
  const ref = useKobalteState<HTMLDivElement>()
  const ctx = useContext(SubContext)
  return (
    <Radix.SubContent
      sideOffset={ctx.gutter ?? 4}
      collisionPadding={8}
      {...rest}
      ref={ref}
      data-component="dropdown-menu-sub-content"
      style={
        {
          "--kb-menu-content-transform-origin": "var(--radix-dropdown-menu-content-transform-origin)",
          ...style,
        } as CSSProperties
      }
    />
  )
}

export const DropdownMenu = Object.assign(Root, {
  Trigger,
  Portal: Radix.Portal,
  Content,
  Item,
  Separator,
  Group,
  GroupLabel,
  ItemLabel,
  ItemIndicator,
  Sub,
  SubTrigger,
  SubContent,
})

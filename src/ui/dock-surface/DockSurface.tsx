import { forwardRef, type FormHTMLAttributes, type HTMLAttributes } from "react"

export const DockContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function DockContainer(props, ref) {
  return <div ref={ref} {...props} data-dock-surface="container" />
})

export function DockShell(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} data-dock-surface="shell" />
}

export function DockShellForm(props: FormHTMLAttributes<HTMLFormElement>) {
  return <form {...props} data-dock-surface="shell" />
}

export function DockTray({ attach, ...rest }: HTMLAttributes<HTMLDivElement> & { attach?: "none" | "top" }) {
  return <div {...rest} data-dock-surface="tray" data-dock-attach={attach || "none"} />
}

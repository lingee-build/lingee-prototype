import type { ReactNode } from "react"
import { cx } from "@/lib/cx"

/** 开发与评测会话共用输入区的宽度、边距和交互容器。 */
export function SessionPromptDock({ children, inSession = true }: { children: ReactNode; inSession?: boolean }) {
  return <div data-component="session-prompt-dock" className="shrink-0 w-full flex flex-col justify-center items-center pointer-events-none">
    <div className={cx("w-full pointer-events-auto px-6 md:px-0 md:mx-auto", inSession ? "md:max-w-[800px]" : "md:max-w-[710px]")}>{children}</div>
  </div>
}

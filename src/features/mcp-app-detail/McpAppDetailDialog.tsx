import { Dialog } from "@/ui"
import { useT } from "@/i18n"
import type { McpApp } from "@/mock/fixtures/dev"
import { McpAppOverview } from "./McpAppOverview"

const FADE = "linear-gradient(to bottom, transparent 0, black 24px, black 100%)"

/** 业务组件详情弹窗：只有概览内容（关联工具、基本信息、更新日志） */
export function McpAppDetailDialog(props: { app: McpApp }) {
  const t = useT()
  return (
    <Dialog title={t("kcode.mcpApp.title")} fit className="w-[640px] !rounded-[24px] overflow-hidden shadow-[0px_6px_12px_rgba(0,0,0,0.08)]">
      <div className="relative flex flex-col max-h-[80vh]">
        <div className="flex-1 overflow-y-auto no-scrollbar px-7 py-6" style={{ maskImage: FADE, WebkitMaskImage: FADE }}>
          <McpAppOverview app={props.app} />
        </div>
      </div>
    </Dialog>
  )
}

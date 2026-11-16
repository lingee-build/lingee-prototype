import { useState } from "react"
import { ControlledConfirmDialog } from "@/ui/dialog/ConfirmDialog"
import { showToast, useDialog } from "@/ui"
import { useEditSession } from "@/features/dev-page/use-edit-session"
import { useArtifactConfig } from "./config-state"

export function ConfigPreparationHost() {
  const pending = useArtifactConfig(s => s.pending)
  const edit = useEditSession()
  const dialog = useDialog()
  const [busy, setBusy] = useState(false)
  const close = () => useArtifactConfig.setState({ pending: undefined })
  const goPrepare = async () => {
    if (!pending || busy) return
    setBusy(true)
    try {
      dialog.close()
      const creator = pending.kind === "agent" ? "ai-partner-creator" : pending.kind === "skill" ? "kingdee-skill-creator" : "mcp-apps-builder"
      const target = pending.kind === "agent" ? { agent: pending.id } : pending.kind === "skill" ? { kdskill: pending.id } : { mcpapp: pending.id }
      const session = await edit({
        title: `修复「${pending.name}」产物配置`, projectId: pending.projectId, target, requireProject: true,
        draft: `/${creator} 修复【${pending.name}】的产物配置：检查现有包结构，按现有内容双向同步配置并生成缺失文件，保留已有能力和业务逻辑。`,
      })
      if (!session) throw new Error("未找到产物所属项目，请重新打开项目后重试")
      useArtifactConfig.setState(s => ({ sessions: { ...s.sessions, [session.id]: pending } }))
    } catch (error) {
      showToast({ variant: "error", title: "无法打开修复会话", description: error instanceof Error ? error.message : "请重试" })
    } finally { setBusy(false) }
  }
  return <ControlledConfirmDialog open={!!pending} onClose={close} tone="info"
    title="产物待修复"
    description={`当前${pending?.kind === "agent" ? "智能体" : pending?.kind === "skill" ? "技能" : "业务组件"}产物缺少必要的配置文件，修复后即可测试、提交或导出，不影响原有能力。`}
    cancelText="取消" confirmText="去修复" onConfirm={() => void goPrepare()} />
}

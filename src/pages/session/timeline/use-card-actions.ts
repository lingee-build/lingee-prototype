import { useNavigate } from "react-router"
import { showToast, type CardClick } from "@/ui"
import { useT } from "@/i18n"
import { devStore } from "@/mock/dev-store"
import { sessionService } from "@/services"
import { usePanel } from "@/stores/panel"
import { usePrompt } from "@/stores/prompt"
import { useSync } from "@/stores/sync"
import { workflowService } from "@/services/workflow"
import { collapseSidebarForCanvas } from "@/features/workflow/open-canvas"

/**
 * 会话里产物卡片的点击行为（对应原工程 session.tsx 的 onCardClick）：
 * - 点卡片主体：在右侧面板打开对应的抽屉（技能预览 / 智能体配置 / 业务组件详情），再点一次收起
 * - 「本地测试」：技能跳到新任务页并带上 /技能名；智能体新建一个测试会话
 * - 工作流卡片：在右侧打开工作流画布，并收起最左侧边栏
 * - 业务组件的「预览」：原型里没有真的开发服务器，给一条提示
 */
export function useCardActions(projectId: string): CardClick {
  const t = useT()
  const navigate = useNavigate()
  const toggleDrawer = usePanel((s) => s.toggleDrawer)

  return (kind, config) => {
    if (kind === "evaluation-cases") {
      const [type, id] = (config.id || "").split(":")
      const target = type === "skill" ? devStore.skills.find(s => s.id === id && s.projectId === projectId) : type === "agent" ? devStore.agents.find(a => a.id === id && a.projectId === projectId) : undefined
      if (!target) return showToast({ variant: "error", title: "评测对象不可用" })
      return navigate(`/dev/${type}/${id}/evaluation`)
    }
    if (kind === "kdskill" || kind === "kdskill-local-test") {
      const id = config.id || (config.directory ?? "").split("/").pop() || ""
      const skill = devStore.skills.find((x) => x.name === id || x.id === id)
      if (!skill) return showToast({ variant: "error", title: t("kcode.skillDev.notFound") })
      if (kind === "kdskill") return toggleDrawer({ kind: "kdskill", id: skill.id, title: skill.displayName })
      usePrompt.getState().setDraft(`/${skill.name} `)
      return navigate(`/p/${projectId}/session`)
    }
    if (kind === "ai-partner" || kind === "ai-partner-local-test") {
      const agent = devStore.agents.find((x) => x.id === config.id)
      if (!agent) return showToast({ variant: "error", title: t("kcode.agentDev.notFound") })
      if (kind === "ai-partner") return toggleDrawer({ kind: "agentConfig", id: agent.id, title: agent.name })
      return void sessionService.create(projectId, `${t("kcode.localTest.sessionTitlePrefix")}${agent.name}`).then((session) => {
        useSync.getState().apply({ type: "session.updated", session })
        useSync.setState((s) => ({ messages: { ...s.messages, [session.id]: [] } }))
        navigate(`/p/${projectId}/session/${session.id}`)
      })
    }
    if (kind === "kdapp-artifact") {
      const app = devStore.mcpApps.find((x) => x.appCode === config.appCode)
      if (!app) return showToast({ variant: "error", title: t("kcode.mcpApp.empty.noMatch") })
      return toggleDrawer({ kind: "kdapp-artifact", id: app.appCode, title: app.appName })
    }
    if (kind === "kd-workflow") {
      const id = config.id ?? ""
      if (!workflowService.exists(id)) return showToast({ variant: "error", title: t("proto.workflow.notFound") })
      // 打开画布时收起最左侧边栏，给画布留出宽度
      const opening = !(usePanel.getState().view === "drawer" && usePanel.getState().drawer?.id === id)
      if (opening) collapseSidebarForCanvas()
      return toggleDrawer({ kind: "workflow", id, title: config.title ?? "" })
    }
    if (kind === "kdapp-preview-start") return showToast({ description: `${t("kcode.mcpApp.action.preview")}：${config.url ?? ""}` })
  }
}

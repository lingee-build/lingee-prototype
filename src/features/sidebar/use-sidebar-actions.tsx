import { devStore } from "@/mock/dev-store"
import { useUpgradeStore } from "@/features/artifact-upgrade/UpgradeGate"
import { useNavigate, useParams } from "react-router"
import { ConfirmDialog, showToast, useDialog } from "@/ui"
import { useT } from "@/i18n"
import { projectService, sessionService } from "@/services"
import { useLayout } from "@/stores/layout"
import { useSync } from "@/stores/sync"
import { RenameDialog } from "@/features/dialogs/RenameDialog"

/** 侧边栏里项目 / 会话的所有写操作：重命名、置顶、移动、归档、删除、新建 */
export function useSidebarActions() {
  const t = useT()
  const dialog = useDialog()
  const navigate = useNavigate()
  const params = useParams()
  const sync = useSync
  const leaveIfActive = (sessionId: string, projectId: string) => {
    if (params.sessionId === sessionId) navigate(`/p/${projectId}/session`)
  }

  return {
    renameSession(sessionId: string) {
      const session = sync.getState().sessions.find((x) => x.id === sessionId)
      if (!session) return
      dialog.show(() => (
        <RenameDialog
          title={t("kcode.session.rename.title")}
          label={t("kcode.session.rename.label")}
          value={session.title}
          onSubmit={(title) => {
            sync.getState().setSessions((list) => list.map((x) => (x.id === sessionId ? { ...x, title } : x)))
            void sessionService.update(sessionId, { title })
          }}
        />
      ))
    },

    pinSession: (sessionId: string) => useLayout.getState().togglePinned(sessionId),

    moveSession(sessionId: string, projectId: string) {
      sync.getState().setSessions((list) => list.map((x) => (x.id === sessionId ? { ...x, projectId } : x)))
      useLayout.getState().expandGroup(projectId)
      void sessionService.update(sessionId, { projectId })
      if (params.sessionId === sessionId) navigate(`/p/${projectId}/session/${sessionId}`, { replace: true })
    },

    archiveSession(sessionId: string) {
      const session = sync.getState().sessions.find((x) => x.id === sessionId)
      if (!session) return
      sync.getState().setSessions((list) => list.filter((x) => x.id !== sessionId))
      void sessionService.archive(sessionId)
      showToast({ variant: "success", title: t("kcode.session.archive.success") })
      leaveIfActive(sessionId, session.projectId)
    },

    deleteSession(sessionId: string) {
      const session = sync.getState().sessions.find((x) => x.id === sessionId)
      if (!session) return
      dialog.show(() => (
        <ConfirmDialog
          variant="danger"
          title={t("kcode.session.delete.title")}
          description={t("kcode.session.delete.confirm")}
          cancelText={t("common.cancel")}
          confirmText={t("kcode.session.delete.button")}
          onConfirm={() => {
            sessionService.abort(sessionId)
            sync.getState().setSessions((list) => list.filter((x) => x.id !== sessionId))
            void sessionService.remove(sessionId)
            showToast({ variant: "success", title: t("kcode.session.delete.success") })
            leaveIfActive(sessionId, session.projectId)
          }}
        />
      ))
    },

    renameProject(projectId: string) {
      const project = sync.getState().projects.find((x) => x.id === projectId)
      if (!project) return
      dialog.show(() => (
        <RenameDialog
          title={t("kcode.project.rename.title")}
          label={t("kcode.project.rename.label")}
          value={project.name}
          onSubmit={(name) => {
            sync.getState().setProjects(sync.getState().projects.map((x) => (x.id === projectId ? { ...x, name } : x)))
            void projectService.rename(projectId, name)
          }}
        />
      ))
    },

    deleteProject(projectId: string) {
      const project = sync.getState().projects.find((x) => x.id === projectId)
      if (!project) return
      dialog.show(() => (
        <ConfirmDialog
          variant="danger"
          title={t("kcode.project.delete.title")}
          description={t("kcode.project.delete.confirm", { name: project.name })}
          cancelText={t("common.cancel")}
          confirmText={t("kcode.project.delete.button")}
          onConfirm={() => {
            const rest = sync.getState().projects.filter((x) => x.id !== projectId)
            sync.getState().setProjects(rest)
            sync.getState().setSessions((list) => list.filter((x) => x.projectId !== projectId))
            void projectService.remove(projectId)
            if (params.projectId === projectId) navigate(rest[0] ? `/p/${rest[0].id}/session` : "/")
          }}
        />
      ))
    },

    async importProject() {
      const project = await projectService.create(`已有产物示例项目 ${sync.getState().projects.length + 1}`)
      const suffix = project.id
      const skill = structuredClone(devStore.skills.find((x) => x.id === "sk_stock")!)
      const agent = structuredClone(devStore.agents.find((x) => x.id === "supplier-access-review")!)
      const app = structuredClone(devStore.mcpApps.find((x) => x.appCode === "kdcloud_fin_expense_claim_card")!)
      Object.assign(skill, { id: `skill_${suffix}`, name: `inventory-${suffix}`, projectId: project.id, displayName: "库存查询（导入示例）" })
      Object.assign(agent, { id: `agent_${suffix}`, projectId: project.id, name: "供应商评估（导入示例）" })
      Object.assign(app, { appCode: `component_${suffix}`, projectId: project.id, appName: "报销卡片（导入示例）" })
      devStore.skills.push(skill)
      devStore.agents.push(agent)
      devStore.mcpApps.push(app)
      useUpgradeStore.setState((s) => ({ addedLegacy: [...s.addedLegacy, skill.name, agent.id, app.appCode] }))
      sync.getState().setProjects([...sync.getState().projects, project])
      useLayout.getState().expandGroup(project.id)
      navigate(`/p/${project.id}/session`)
    },

    async createProject() {
      const existing = sync.getState().projects
      const project = await projectService.create(`新项目 ${existing.length + 1}`)
      sync.getState().setProjects([...sync.getState().projects, project])
      useLayout.getState().expandGroup(project.id)
      navigate(`/p/${project.id}/session`)
    },

    newTask(projectId?: string) {
      const target = projectId ?? params.projectId ?? sync.getState().projects[0]?.id
      navigate(target ? `/p/${target}/session` : "/")
    },
  }
}

export type SidebarActions = ReturnType<typeof useSidebarActions>

import { displayInfoErrors } from "@/features/agent-config/display-info"
import { exportArtifactPackage } from "@/features/artifact-config/package-export"
import { guardArtifactConfig } from "@/features/artifact-config/config-state"
import { evaluationDeletionNotice } from "@/services/evaluation-deletion"
import { guardUpgrade } from "@/features/artifact-upgrade/UpgradeGate"
import { useState } from "react"
import { useNavigate } from "react-router"
import { ConfirmDialog, showToast, useDialog } from "@/ui"
import { useT } from "@/i18n"
import { AgentSubmitCheckDialog } from "@/features/skill-publish-scope/SkillPublishScopeDialog"
import type { Agent, Skill } from "@/mock/fixtures/dev"
import { sleep } from "@/mock/latency"
import { agentService, sessionService, skillService } from "@/services"
import { useSync } from "@/stores/sync"
import { useEditSession } from "@/features/dev-page/use-edit-session"

export type AgentBusy = "localTest" | "test" | "submit" | "withdraw"

/**
 * 智能体的各种操作：编辑、本地测试、云端测试、提交审核、撤回、删除。
 * 开发页的卡片菜单和会话里的配置抽屉共用，onChanged 在数据变化后触发（用来刷新列表 / 抽屉）。
 */
export function useAgentActions(onChanged: () => void) {
  const t = useT()
  const dialog = useDialog()
  const navigate = useNavigate()
  const editSession = useEditSession()
  const [busy, setBusy] = useState<AgentBusy>()

  const run = async (kind: AgentBusy, task: () => Promise<unknown>) => {
    if (busy) return
    setBusy(kind)
    await task()
    setBusy(undefined)
  }

  /** 进入编辑：建一个会话直接进去，输入框带上「编辑【名称】：」，右侧打开配置抽屉 */
  const startEdit = (agent: Agent) => {
    const draft = t("kcode.agentDev.edit.draft", { name: agent.name })
    return void editSession({ title: draft.replace(/[:：]\s*$/, ""), draft: `/ai-partner-creator ${draft}`, projectId: agent.projectId, target: { agent: agent.id } })
  }

  const actions = {
    busy,
    export: (agent: Agent) => exportArtifactPackage("agent", agent.id),

    /** 已发布 / 已提交的智能体，编辑前先确认（编辑后需要重新提交审核） */
    edit(agent: Agent) {
      if (agent.status !== "published" && agent.status !== "submitted") return startEdit(agent)
      dialog.show(() => (
        <ConfirmDialog
          tone="info"
          title={t("kcode.agentDev.edit.confirmTitle")}
          description={t(agent.status === "submitted" ? "kcode.agentDev.edit.confirmContent.submitted" : "kcode.agentDev.edit.confirmContent")}
          cancelText={t("kcode.agentDev.delete.cancel")}
          confirmText={t("kcode.agentDev.edit.confirmBtn")}
          onConfirm={() => startEdit(agent)}
        />
      ))
    },

    /** 本地测试：新建一个「测试 · 名称」会话并跳过去 */
    localTest: (agent: Agent) =>
      run("localTest", async () => {
        const projects = useSync.getState().projects
        const projectId = projects.find((x) => x.id === agent.projectId)?.id ?? projects[0]?.id
        if (!projectId) return
        const session = await sessionService.create(projectId, `${t("kcode.localTest.sessionTitlePrefix")}${agent.name}`)
        useSync.getState().apply({ type: "session.updated", session })
        useSync.setState((s) => ({ messages: { ...s.messages, [session.id]: [] } }))
        navigate(`/p/${projectId}/session/${session.id}`)
      }),

    /** 云端测试：推到沙箱。挂了待审核的个人知识时先提示一次 */
    cloudTest(agent: Agent) {
      const push = () =>
        run("test", async () => {
          await sleep(1500)
          showToast({ variant: "success", title: `${agent.name}：${t("kcode.agentConfig.test")}`, description: t("kcode.localTest.consoleSandboxBadge") })
        })
      if (!agent.knowledge.some((x) => x.scope === "personal" && x.status !== 2)) return void push()
      dialog.show(() => (
        <ConfirmDialog
          tone="info"
          title={t("kcode.agentConfig.test.knowledgeConfirmTitle")}
          description={t("kcode.agentConfig.test.knowledgeConfirmContent")}
          confirmText={t("kcode.agentConfig.test.knowledgeConfirmBtn")}
          onConfirm={() => void push()}
        />
      ))
    },

    submit(agent: Agent) {
      if (Object.keys(displayInfoErrors(agent.displayInfo)).length) {
        showToast({ variant: "error", title: t("proto.agentDisplay.submitMissing") })
        return
      }
      // 只提交智能体本身；引用的技能须全部已发布且无未提交修改
      const submitAgent = () => void run("submit", async () => {
        await agentService.submit(agent.id)
        showToast({ variant: "success", title: t("kcode.agentConfig.submitReviewSuccess") })
        onChanged()
      })
      const goSubmitSkill = (skill: Skill) => {
        const draft = t("kcode.skillDev.edit.draft", { name: skill.displayName })
        void editSession({ title: draft.replace(/[:：]\s*$/, ""), draft: `/kingdee-skill-creator ${draft}`, projectId: skill.projectId, target: { kdskill: skill.id } })
      }
      void Promise.all(agent.skills.map((item) => skillService.get(item.skillName))).then((found) => {
        const linked = found.filter((skill): skill is NonNullable<typeof skill> => !!skill)
        if (linked.length) dialog.show(() => <AgentSubmitCheckDialog agent={agent} skills={linked} onConfirm={submitAgent} onGoSubmit={goSubmitSkill} />)
        else dialog.show(() => <ConfirmDialog tone="info" title={t("kcode.agentDev.submit.confirmTitle")} description={t("kcode.agentDev.submit.confirmContent")} cancelText={t("kcode.agentDev.delete.cancel")} confirmText={t("kcode.agentDev.submit.confirmBtn")} onConfirm={submitAgent} />)
      })
    },
    withdraw(agent: Agent) {
      dialog.show(() => (
        <ConfirmDialog
          variant="primary"
          title={t("kcode.agentConfig.withdraw.confirmTitle")}
          description={t("kcode.agentConfig.withdraw.confirmContent", { name: agent.name })}
          cancelText={t("kcode.agentDev.delete.cancel")}
          confirmText={t("kcode.agentConfig.withdraw.confirmBtn")}
          onConfirm={() =>
            void run("withdraw", async () => {
              await agentService.withdraw(agent.id)
              showToast({ variant: "success", description: t("kcode.agentDev.withdraw.success") })
              onChanged()
            })
          }
        />
      ))
    },

    remove(agent: Agent) {
      // 本地改过但云端还有记录时，删除提示前先说明云端状态
      const tip = agent.isChanged && agent.backendStatus ? t(`kcode.agentDev.changedTip.${agent.backendStatus}`) : ""
      const reason = tip && agent.backendStatus === "rejected" && agent.rejectionRemark ? t("ui.tile.rejectionReason", { reason: agent.rejectionRemark }) : ""
      dialog.show(() => (
        <ConfirmDialog
          variant="danger"
          title={t("kcode.agentDev.delete.title")}
          description={`${tip}${reason}${t("kcode.agentDev.delete.content")}\n${evaluationDeletionNotice}`}
          cancelText={t("kcode.agentDev.delete.cancel")}
          confirmText={t("kcode.agentDev.delete.confirm")}
          onConfirm={() => {
            void agentService.remove(agent.id).then(() => {
              onChanged()
              showToast({ variant: "success", title: t("kcode.agentDev.delete.success") })
            }).catch(error => showToast({ variant: "error", title: "删除失败", description: error instanceof Error ? error.message : "请恢复存储后重试" }))
          }}
        />
      ))
    },
  }
  return { ...actions, ...Object.fromEntries(
    Object.entries(actions).filter(([key]) => key !== "busy").map(([key, action]) => [key, (agent: Agent) => {
      if (["localTest", "cloudTest", "submit"].includes(key) && guardArtifactConfig("agent", agent.id)) return
      const run = () => (action as (agent: Agent) => unknown)(agent)
      if (!guardUpgrade([agent.id], run)) return run()
    }]),
  ) } as typeof actions
}

/** 能否提交：状态是已保存或已驳回 */
export const canSubmit = (agent: Agent) => (agent.status === "saved" || agent.status === "rejected")
/** 能否撤回：云端正在审核中 */
export const canWithdraw = (agent: Agent) => agent.backendStatus === "submitted"
/** 能否删除：云端审核中或已发布时不允许删 */
export const canRemove = (agent: Agent) => canSubmit(agent) && agent.backendStatus !== "submitted" && agent.backendStatus !== "published"

import { guardArtifactConfig } from "@/features/artifact-config/config-state"
import { useState } from "react"
import { ConfirmDialog, showToast, useDialog } from "@/ui"
import { useT } from "@/i18n"
import type { McpApp } from "@/mock/fixtures/dev"
import { sleep } from "@/mock/latency"
import { mcpAppService } from "@/services"
import { useEditSession } from "@/features/dev-page/use-edit-session"
import { useStartSession } from "@/features/dev-page/use-start-session"
import { missingRequired, submitConfirmKey } from "./status"

export type McpAppBusy = "preview" | "edit" | "package" | "test" | "submit"

/**
 * 业务组件的各种操作：预览、编辑、构建打包、测试、提交、删除。
 * 卡片菜单与会话里的详情抽屉共用。测试 / 提交前会校验「已构建」和 info.json 必填项。
 */
export function useMcpAppActions(onChanged: () => void) {
  const t = useT()
  const dialog = useDialog()
  const startSession = useStartSession()
  const editSession = useEditSession()
  const [busy, setBusy] = useState<McpAppBusy>()

  const run = async (kind: McpAppBusy, task: () => Promise<unknown>) => {
    if (busy) return
    setBusy(kind)
    await task()
    setBusy(undefined)
  }

  /** 上传前校验：没构建、必填缺失都拦下并提示 */
  const ready = (app: McpApp, buildFirstKey: string) => {
    if (app.buildStatus !== "success") return showToast({ variant: "warning", description: t(buildFirstKey) }), false
    const missing = missingRequired(app)
    if (missing.length === 0) return true
    showToast({ variant: "warning", description: t("kcode.mcpApp.preview.toast.missingRequired", { count: missing.length, fields: missing.join(", ") }) })
    return false
  }

  const actions = {
    busy,

    /** 预览：到新任务页让模型启动开发服务器。编辑：建一个会话直接进去，右侧打开组件详情 */
    preview: (app: McpApp) => startSession(`/mcp-apps-builder ${t("kcode.mcpApp.preview.draft", { name: app.appName })}`, app.projectId),
    edit(app: McpApp) {
      const draft = t("kcode.mcpApp.edit.draft", { name: app.appName })
      return void editSession({ title: draft.replace(/[:：]\s*$/, ""), draft: `/mcp-apps-builder ${draft}`, projectId: app.projectId, target: { mcpapp: app.appCode } })
    },

    package: (app: McpApp) =>
      run("package", async () => {
        const next = await mcpAppService.package(app.appCode, t("kcode.mcpApp.preview.package.changeDesc"))
        if (!next) return showToast({ variant: "error", description: t("kcode.mcpApp.preview.toast.packageFailed") })
        showToast({ variant: "success", description: t("kcode.mcpApp.preview.toast.packageSuccess", { version: next.version }) })
        onChanged()
      }),

    test: (app: McpApp) =>
      run("test", async () => {
        if (!ready(app, "kcode.mcpApp.preview.toast.buildFirstTest")) return
        await sleep(1400)
        await mcpAppService.patch(app.appCode, { tested: true })
        showToast({ variant: "success", description: t("kcode.mcpApp.action.testSandboxSuccess") })
        onChanged()
      }),

    submit(app: McpApp) {
      dialog.show(() => (
        <ConfirmDialog
          title={t("kcode.mcpApp.submit.confirmTitle")}
          description={t(submitConfirmKey(app.mcpStatus))}
          cancelText={t("kcode.mcpApp.delete.cancel")}
          confirmText={t("kcode.mcpApp.submit.confirmBtn")}
          onConfirm={() =>
            void run("submit", async () => {
              if (!ready(app, "kcode.mcpApp.preview.toast.buildFirst")) return
              await sleep(1400)
              await mcpAppService.patch(app.appCode, { mcpStatus: "PENDING_REVIEW", reviewRemark: undefined })
              showToast({ variant: "success", description: t("kcode.mcpApp.action.submitSuccess") })
              onChanged()
            })
          }
        />
      ))
    },

    remove(app: McpApp) {
      dialog.show(() => (
        <ConfirmDialog
          variant="danger"
          title={t("kcode.mcpApp.delete.title")}
          description={t("kcode.mcpApp.delete.confirm.uploaded")}
          cancelText={t("kcode.mcpApp.delete.cancel")}
          confirmText={t("kcode.mcpApp.action.delete")}
          onConfirm={() => {
            void mcpAppService.remove(app.appCode).then(onChanged)
            showToast({ variant: "success", title: t("kcode.mcpApp.delete.success") })
          }}
        />
      ))
    },
  }
  return { ...actions,
    preview: (app: McpApp) => { if (!guardArtifactConfig("mcpapp", app.appCode)) return actions.preview(app) },
    test: (app: McpApp) => { if (!guardArtifactConfig("mcpapp", app.appCode)) return actions.test(app) },
    submit: (app: McpApp) => { if (!guardArtifactConfig("mcpapp", app.appCode)) return actions.submit(app) },
  }
}

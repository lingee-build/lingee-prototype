import { ConfigPreparationHost } from "@/features/artifact-config/ConfigPreparationHost"
import { UpgradeHost } from "@/features/artifact-upgrade/UpgradeGate"
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router"
import { AppShell } from "./AppShell"
import { ScenarioDock } from "@/features/env-source/ScenarioDock"
import { Providers } from "./providers"
import { useAuth } from "@/stores/auth"
import { useSync } from "@/stores/sync"

function Root() {
  return (
    <Providers>
      <Outlet />
      <ScenarioDock />
      <UpgradeHost />
      <ConfigPreparationHost />
    </Providers>
  )
}

/** 未登录时一律先去登录页，登录后回到原来要去的地址 */
function RequireAuth() {
  const account = useAuth((s) => s.account)
  const location = useLocation()
  if (!account) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <AppShell />
}

/** 全屏页（设置页）的鉴权壳：不套 AppShell——线上设置页以 webview 全屏挂载、盖掉应用侧栏 */
function RequireAuthBare() {
  const account = useAuth((s) => s.account)
  const location = useLocation()
  if (!account) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

/** 首页：线上没有项目时才停留在 "/"，有项目则直接进入第一个项目的新任务页 */
function HomeRedirect() {
  const { ready, projects } = useSync()
  if (!ready) return <div className="size-full" />
  if (projects[0]) return <Navigate to={`/p/${projects[0].id}/session`} replace />
  return <Navigate to="/dev/skill" replace />
}

export const router = createBrowserRouter([
  {
    Component: Root,
    children: [
      { path: "login", lazy: () => import("@/pages/login/LoginPage") },
      {
        Component: RequireAuth,
        children: [
          { index: true, Component: HomeRedirect },
          { path: "p/:projectId/session/:sessionId?", lazy: () => import("@/pages/session/SessionPage") },
          { path: "dev/:mode/:objectId/evaluation/execution/:runId/:sessionId", lazy: () => import("@/pages/dev/EvaluationExecutionPage") },
          { path: "dev/:mode/:objectId/evaluation", lazy: () => import("@/pages/dev/EvaluationPage") },
          { path: "dev/:mode", lazy: () => import("@/pages/dev/DevPage") },
          // 工作流设计页：/dev/workflow/:itemId（其他开发入口带二级路径时回到对应列表）
          { path: "dev/:mode/:itemId", lazy: () => import("@/pages/dev/workflow/WorkflowDesignerPage") },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
      // 设置页：全屏路由（不嵌应用侧栏，左导航为设置专属菜单）
      {
        Component: RequireAuthBare,
        children: [{ path: "settings/:section?", lazy: () => import("@/pages/settings/SettingsPage") }],
      },
    ],
  },
], { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" })

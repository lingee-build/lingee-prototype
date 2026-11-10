import { ConfigPreparationHost } from "@/features/artifact-config/ConfigPreparationHost"
import { UpgradeHost } from "@/features/artifact-upgrade/UpgradeGate"
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router"
import { AppShell } from "./AppShell"
import { Providers } from "./providers"
import { useAuth } from "@/stores/auth"
import { useSync } from "@/stores/sync"

function Root() {
  return (
    <Providers>
      <Outlet />
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
          { path: "dev/:mode/:objectId/evaluation", lazy: () => import("@/pages/dev/EvaluationPage") },
          { path: "dev/:mode", lazy: () => import("@/pages/dev/DevPage") },
          // 工作流设计页：/dev/workflow/:itemId（其他开发入口带二级路径时回到对应列表）
          { path: "dev/:mode/:itemId", lazy: () => import("@/pages/dev/workflow/WorkflowDesignerPage") },
          { path: "settings/:section?", lazy: () => import("@/pages/settings/SettingsPage") },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
], { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" })

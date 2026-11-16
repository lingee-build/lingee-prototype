import { useEffect, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { DialogHost, ToastRegion, TooltipProvider } from "@/ui"
import { useAuth } from "@/stores/auth"
import { useSync } from "@/stores/sync"

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } })

/** 全局 Provider：数据请求、提示气泡、全局弹窗、Toast；并在登录后拉一次基础数据 */
export function Providers(props: { children: ReactNode }) {
  const bootstrap = useSync((s) => s.bootstrap)
  const account = useAuth((s) => s.account)
  // 登录后（或换了账号）再拉：当前用户跟着登录人走
  useEffect(() => {
    if (account) void bootstrap()
  }, [bootstrap, account])

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={400} skipDelayDuration={0}>
        {props.children}
        <DialogHost />
        <ToastRegion />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

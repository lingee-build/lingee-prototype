import { useEffect } from "react"
import { Navigate, useNavigate, useParams } from "react-router"
import { useSync } from "@/stores/sync"
import { workflowService } from "@/services/workflow"
import { useOpenWorkflow } from "@/features/workflow/use-open-workflow"

/**
 * /dev/workflow/:itemId —— 兼容直接访问的地址：工作流详情就是「关联会话 + 右侧画布」，这里只做跳转。
 */
export function Component() {
  const { mode, itemId } = useParams()
  const navigate = useNavigate()
  const ready = useSync((s) => s.ready)
  const open = useOpenWorkflow()
  useEffect(() => {
    if (!ready || mode !== "workflow" || !itemId) return
    const workflow = workflowService.find(itemId)
    if (workflow) void open(workflow, { replace: true })
    else navigate("/dev/workflow", { replace: true })
  }, [ready, mode, itemId])
  if (mode !== "workflow" || !itemId) return <Navigate to={`/dev/${mode ?? "skill"}`} replace />
  return <div className="size-full" />
}

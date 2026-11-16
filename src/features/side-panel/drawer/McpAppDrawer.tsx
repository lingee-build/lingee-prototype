import { useState } from "react"
import { useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { BrandButton, Icon, SegmentedControl, Tooltip } from "@/ui"
import { useT } from "@/i18n"
import { mcpAppService } from "@/services"
import { usePrompt } from "@/stores/prompt"
import { McpAppCheck } from "@/features/mcp-app-detail/McpAppCheck"
import { McpAppOverview } from "@/features/mcp-app-detail/McpAppOverview"
import { missingRequired } from "@/features/mcp-app-detail/status"
import { useMcpAppActions } from "@/features/mcp-app-detail/use-mcp-app-actions"

type Tab = "overview" | "check"

const FADE = "linear-gradient(to bottom, transparent 0, black 24px, black 100%)"
const Spinner = () => (
  <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
)

/**
 * 业务组件产物抽屉：点会话里的组件卡片、或从业务组件页点「编辑」时打开。结构对齐线上的 kdapp-artifact-preview：
 * - 头部：标题；右侧 构建打包 / 测试 / 提交 / 修复
 * - 页签：概览 / 检查（info.json 完整性），右侧刷新
 * 「修复」平时置灰：测试或提交被校验拦下（info.json 必填项缺失）后才可点，点了把修复说明填进当前会话的输入框。
 */
export function McpAppDrawer(props: { id: string; working: boolean }) {
  const t = useT()
  const { sessionId } = useParams()
  const [tab, setTab] = useState<Tab>("overview")
  const [refreshing, setRefreshing] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const query = useQuery({ queryKey: ["mcp-app", props.id, props.working], queryFn: () => mcpAppService.get(props.id), staleTime: 0, placeholderData: (prev) => prev })
  const actions = useMcpAppActions(() => void query.refetch())
  const app = query.data
  if (!app) return null
  const busy = actions.busy
  const missing = missingRequired(app)
  const fixable = blocked && missing.length > 0 && !props.working

  /** 测试 / 提交前记一下会不会被拦：被拦了就切到检查页签，并点亮「修复」 */
  const guarded = (run: () => void) => {
    const willBlock = app.buildStatus === "success" && missing.length > 0
    setBlocked(willBlock)
    if (willBlock) setTab("check")
    run()
  }
  const refresh = async () => {
    setRefreshing(true)
    await query.refetch()
    setRefreshing(false)
  }
  const fix = () => {
    usePrompt.getState().setDraft(t("kcode.mcpApp.action.fixMessage.missingRequired", { appCode: app.appCode, count: missing.length, fields: missing.join(", ") }), sessionId)
    setBlocked(false)
  }
  const fixButton = (
    <BrandButton variant="secondary" size="normal" icon="edit" disabled={!fixable} onClick={fix}>
      {t("kcode.mcpApp.action.fix")}
    </BrandButton>
  )

  return (
    <div className="flex h-full flex-col">
      <div className="pt-3 pb-6 text-[16px] font-[600] leading-[24px] text-text-strong flex items-center justify-between px-6 shrink-0 gap-3">
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="text-[20px] min-w-0 truncate">{t("kcode.mcpApp.title")}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <BrandButton
            variant="secondary"
            size="normal"
            disabled={!!busy || props.working || app.packageKind === "dist"}
            title={app.packageKind === "dist" ? t("kcode.mcpApp.action.packageTooltipDist") : undefined}
            onClick={() => void actions.package(app)}
          >
            {busy === "package" && <Spinner />}
            {t("kcode.mcpApp.action.package")}
          </BrandButton>
          <BrandButton variant="secondary" size="normal" disabled={busy === "test" || busy === "submit" || props.working} onClick={() => guarded(() => void actions.test(app))}>
            {busy === "test" && <Spinner />}
            {t("kcode.mcpApp.action.test")}
          </BrandButton>
          <BrandButton
            variant="primary"
            size="normal"
            icon={busy === "submit" ? undefined : "submit-upload"}
            disabled={busy === "test" || busy === "submit" || props.working}
            onClick={() => guarded(() => actions.submit(app))}
          >
            {busy === "submit" && <Spinner />}
            {t("kcode.mcpApp.action.submit")}
          </BrandButton>
          {fixable ? (
            fixButton
          ) : (
            <Tooltip value={t(props.working ? "kcode.mcpApp.action.fixTooltipBusy" : "kcode.mcpApp.action.fixTooltip")} placement="bottom">
              {fixButton}
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex items-center px-6 h-10 shrink-0">
        <SegmentedControl
          value={tab}
          onChange={(value) => setTab(value as Tab)}
          items={(["overview", "check"] as const).map((value) => ({ value, label: t(`kcode.mcpApp.preview.tab.${value}`) }))}
        />
        <button
          type="button"
          aria-label={t("session.files.refresh")}
          title={t("session.files.refresh")}
          onClick={() => void refresh()}
          disabled={refreshing}
          className="ml-auto flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[8px] border-none bg-transparent text-[var(--icon-weak-base,var(--text-weak))] transition-colors hover:bg-surface-base-hover"
        >
          <span className="inline-flex items-center justify-center" style={refreshing ? { animation: "spin 1s linear infinite" } : undefined}>
            <Icon name="refresh" size="small" />
          </span>
        </button>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto no-scrollbar px-7 py-6" style={{ maskImage: FADE, WebkitMaskImage: FADE }}>
          {tab === "overview" ? <McpAppOverview app={app} /> : <McpAppCheck app={app} />}
        </div>
      </div>
    </div>
  )
}

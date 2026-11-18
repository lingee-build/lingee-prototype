import { useLocation, useNavigate, useParams } from "react-router"
import { Icon, type IconName } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { NAV_ITEMS, PLUGIN_NAV, TOP_TABS, isArtifactMode, loadArtifactOrder, type TopTab } from "./nav-config"

function NavButton(props: { icon: IconName; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cx(
        "w-full flex items-center transition-all cursor-pointer active:bg-[var(--neutral-0)] rounded-[20px] h-10 gap-1.5 px-2.5 py-2.5 align-items-center align-sel-stretch",
        props.active
          ? "text-[var(--neutral-900)] shadow-[0_2px_6px_0_rgba(0,0,0,0.04)] bg-[var(--neutral-100)] [--icon-fill:var(--neutral-900))]"
          : "text-[var(--neutral-700)] [--icon-fill:var(--neutral-600))] hover:bg-[var(--neutral-100)]",
      )}
      onClick={props.onClick}
    >
      <Icon name={props.icon} className="shrink-0" />
      <span
        className={cx(
          "overflow-hidden text-ellipsis whitespace-nowrap leading-[20px] text-[14px]",
          props.active ? "text-[var(--neutral-900)] font-[500]" : "text-[var(--neutral-700)] font-[400]",
        )}
        title={props.label}
      >
        {props.label}
      </span>
    </button>
  )
}

/** 侧边栏上半部分：对话/工作/开发 页签 + 新任务 / 协作 / 产物 / 插件中心 */
export function NavSection(props: { onNewTask: () => void }) {
  const t = useT()
  const navigate = useNavigate()
  const params = useParams()
  const location = useLocation()
  // 工作页签（原型）：只开放 Work 智能体页，承接 Build 智能体「个人自用」；对话页签仍未开放
  const activeTab: TopTab = location.pathname.startsWith("/work") ? "work" : "dev"
  const goTab = (id: TopTab) => {
    if (id === "work") navigate("/work/agent")
    else if (id === "dev" && activeTab !== "dev") navigate("/")
  }
  const newTaskActive = !params.mode && !params.sessionId

  return (
    <div className="px-2 mt-13 pb-0 shrink-0">
      <div className="flex h-[32px] items-center mb-4">
        <div className="inline-flex items-center gap-1 rounded-[20px] flex-1">
          {TOP_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={activeTab === item.id}
              onClick={() => goTab(item.id)}
              // 对话页签暂未开放，和线上一样点击无反应
              className={cx(
                "flex flex-1 h-8 items-center justify-center gap-1 rounded-[16px] border-none px-[10px] py-[6px] transition-colors cursor-pointer",
                activeTab === item.id
                  ? "bg-[var(--neutral-100)] text-[var(--neutral-900)] [--icon-fill:var(--neutral-900)]"
                  : "bg-transparent text-[var(--neutral-700)] [--icon-fill:var(--neutral-600)] hover:bg-[var(--neutral-100)]",
              )}
            >
              <Icon name={item.icon} size="small" className="shrink-0" />
              <span className={cx("text-[14px] leading-[20px] tracking-[-0.01em]", activeTab === item.id ? "font-[600]" : "font-[400]")}>
                {t(item.labelKey)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === "work" ? (
        <div className="flex flex-col gap-0.5">
          <NavButton icon="ai-partner" label={t("proto.work.nav.agent")} active={location.pathname.startsWith("/work/agent")} onClick={() => navigate("/work/agent")} />
        </div>
      ) : (
      <div className="flex flex-col gap-0.5">
        <NavButton icon="play-circle" label={t("kcode.nav.newTask")} active={newTaskActive} onClick={props.onNewTask} />
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            icon={item.icon}
            label={t(item.labelKey)}
            active={item.id === "artifacts" ? isArtifactMode(params.mode) : params.mode === item.id}
            // 产物：进入用户排在第一位的类型页签
            onClick={() => navigate(`/dev/${item.id === "artifacts" ? loadArtifactOrder()[0] : item.id}`)}
          />
        ))}
        <div className="mx-2.5 my-2 h-px bg-border-weak-base" role="separator" />
        <NavButton
          icon={PLUGIN_NAV.icon}
          label={t(PLUGIN_NAV.labelKey)}
          active={params.mode === PLUGIN_NAV.id}
          onClick={() => navigate(`/dev/${PLUGIN_NAV.id}`)}
        />
      </div>
      )}
    </div>
  )
}

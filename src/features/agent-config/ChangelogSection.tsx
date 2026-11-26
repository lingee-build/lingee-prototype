import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { Agent } from "@/mock/fixtures/dev"

type Version = Agent["changelog"]["versions"][number]

const formatTime = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date)
}

function Chevron() {
  return <svg aria-hidden="true" className="changelog-chevron shrink-0 text-text-weak" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7" /></svg>
}

/** 版本渠道标签：企业提交（蓝描边）/ 个人安装（绿描边）；仅技能版本携带，智能体不传不显示 */
function ChannelTag(props: { channel: NonNullable<Version["channel"]> }) {
  const t = useT()
  return <span className={cx("changelog-channel", `changelog-channel-${props.channel}`)}>{t(`kcode.changelog.channel.${props.channel}`)}</span>
}

function VersionEntry(props: { entry: Version; latest?: boolean }) {
  const t = useT()
  const { entry } = props
  const rejected = entry.status === "rejected"
  return (
    <details open={props.latest} className={cx("changelog-entry", props.latest && "changelog-entry-latest", rejected && "changelog-entry-dead")}>
      <summary className="changelog-version-heading flex items-center justify-between gap-3 cursor-pointer select-none">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={cx("text-[14px] font-medium leading-[22px]", rejected ? "text-text-weak line-through" : "text-text-strong")}>v{entry.version}</span>
          {props.latest && <span className="changelog-badge">{t("kcode.agentChangelog.publishedTag")}</span>}
          {entry.status === "submitted" && <span className="changelog-tag">{t("kcode.changelog.status.submitted")}</span>}
          {rejected && <span className="changelog-tag-dead">{t("kcode.changelog.status.rejected")}</span>}
          {entry.channel && <ChannelTag channel={entry.channel} />}
        </span>
        <span className="flex flex-none items-center gap-2">
          <span className="text-[12px] leading-[18px] text-text-weak">
            {formatTime(entry.releasedAt)} · {entry.operator}
          </span>
          <Chevron />
        </span>
      </summary>
      {entry.summary && <p className="mt-2 text-[13px] font-medium leading-[21px] text-text-strong">{entry.summary}</p>}
      <ul className="mt-2 list-disc pl-4 space-y-1 text-[13px] leading-[21px] text-text-base">
        {(entry.lines.length ? entry.lines : [t("kcode.agentChangelog.noChanges")]).map((line, i) => <li key={i} className="break-words">{line}</li>)}
      </ul>
      {entry.withdrawnAt && (
        <p className="mt-2 text-[12px] leading-4 text-text-weak">{t("kcode.changelog.withdrawNote", { time: formatTime(entry.withdrawnAt) })}</p>
      )}
    </details>
  )
}

/** 版本时间线（PRD-技能版本记录与变更优化 功能点4）：本地修改置顶逐条展示，发布后归属版本号只展示版本摘要；
 * 版本节点带发布通道与状态，驳回版本删除线标记，撤回版本留痕且变更记录回到本地修改。 */
export function ChangelogSection(props: { changelog: Agent["changelog"]; embedded?: boolean; pendingLabel?: string }) {
  const t = useT()
  const pending = [...props.changelog.pending].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const versions = [...props.changelog.versions].reverse()

  return (
    <section aria-label={t("kcode.agentChangelog.title")}>
      {!props.embedded && <h3 className="agent-config-section-title mb-3">{t("kcode.agentChangelog.title")}</h3>}
      <div className={cx("agent-changelog", !props.embedded && "agent-config-surface")}>
        {!pending.length && !versions.length && <div className="py-2 text-[13px] text-text-weak">{t("kcode.agentChangelog.empty")}</div>}
        {pending.length > 0 && (
          <div className="changelog-entry changelog-entry-pending">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-medium leading-[22px] text-text-strong">{props.pendingLabel ?? t("kcode.agentChangelog.pendingLabel")}</span>
              <span className="text-[12px] leading-[18px] text-text-weak">{t("kcode.agentChangelog.pendingCount", { count: pending.length })}</span>
            </div>
            <div className="mt-2 flex flex-col gap-3">
              {pending.map((record, index) => (
                <div key={`${record.createdAt}-${index}`}>
                  <p className="flex flex-wrap items-center gap-1.5 text-[13px] leading-[21px] text-text-base">
                    {record.kind && <span className="changelog-kind">{t(`kcode.changelog.kind.${record.kind}`)}</span>}
                    <span className="break-words">{record.summary}</span>
                  </p>
                  <div className="mt-1 text-[12px] leading-4 text-text-weak">{formatTime(record.createdAt)} · {record.operator}</div>
                </div>
              ))}
            </div>

          </div>
        )}
        {versions.map((entry, index) => <VersionEntry key={entry.version} entry={entry} latest={index === 0} />)}
      </div>
    </section>
  )
}

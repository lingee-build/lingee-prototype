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

function VersionEntry(props: { entry: Version; latest?: boolean }) {
  const t = useT()
  const { entry } = props
  return (
    <details open={props.latest} className={cx("changelog-entry", props.latest && "changelog-entry-latest")}>
      <summary className="changelog-version-heading flex items-center justify-between gap-3 cursor-pointer select-none text-[14px] text-text-base">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-medium text-text-strong">v{entry.version}</span>
            {props.latest && <span className="changelog-badge">{t("kcode.agentChangelog.publishedTag")}</span>}
            <span className="text-[12px] text-text-weak">{formatTime(entry.releasedAt)} · {entry.operator}</span>
          </span>
        </span>
        <Chevron />
      </summary>
      {entry.summary && <p className="mt-2 text-[13px] font-medium leading-[21px] text-text-strong">{entry.summary}</p>}
      <ul className="mt-2 list-disc pl-4 space-y-1 text-[13px] leading-[21px] text-text-base">
        {(entry.lines.length ? entry.lines : [t("kcode.agentChangelog.noChanges")]).map((line, i) => <li key={i} className="break-words">{line}</li>)}
      </ul>
    </details>
  )
}

/** 版本时间线：展示待发布修改与各版本，最新版本展开，旧版本可展开查看。 */
export function ChangelogSection(props: { changelog: Agent["changelog"]; compact?: boolean }) {
  const t = useT()
  const pending = [...props.changelog.pending].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const versions = [...props.changelog.versions].reverse()

  return (
    <section aria-label={t("kcode.agentChangelog.title")}>
      <h3 className="agent-config-section-title mb-3">{t("kcode.agentChangelog.title")}</h3>
      <div className="agent-changelog agent-config-surface">
        {!pending.length && !versions.length && <div className="py-2 text-[13px] text-text-weak">{t("kcode.agentChangelog.empty")}</div>}
        {pending.length > 0 && (
          <div className="changelog-entry changelog-entry-pending">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-medium text-[14px] text-text-strong">{t("kcode.agentChangelog.pendingLabel")}</span>
              <span className="text-[12px] text-text-weak">{t("kcode.agentChangelog.pendingCount", { count: pending.length })}</span>
            </div>
            <div className="flex flex-col gap-3">
              {pending.map((record, index) => (
                <div key={`${record.createdAt}-${index}`}>
                  <p className="text-[13px] leading-[21px] text-text-base break-words">{record.summary}</p>
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

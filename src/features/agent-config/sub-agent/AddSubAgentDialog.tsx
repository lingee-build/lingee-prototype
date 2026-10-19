import { useState } from "react"
import { publicUrl } from "@/lib/public-url"
import { useQuery } from "@tanstack/react-query"
import { Dialog, Icon, SegmentedControl, useDialog } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { agentService } from "@/services"
import { domainI18nKeys, pickAvatar } from "../form"
import { PublishTag, SourceTag } from "./SubAgentTag"

type Source = "local" | "mall"

/**
 * 添加子智能体弹窗：来源分「本地智能体」（本企业开发列表里的，任意状态都能引用）和「更多智能体」（官方 / Beta / 其它企业共享）。
 * 多选；自己和已经添加过的不会出现在列表里。
 */
export function AddSubAgentDialog(props: { hostId: string; existing: string[]; onConfirm: (ids: string[]) => void }) {
  const t = useT()
  const dialog = useDialog()
  const [source, setSource] = useState<Source>("local")
  const [query, setQuery] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const local = useQuery({ queryKey: ["agents"], queryFn: agentService.list, staleTime: 0 })
  const mall = useQuery({ queryKey: ["mall-agents"], queryFn: agentService.mall })
  const pool = source === "mall" ? mall : local
  const keyword = query.trim().toLowerCase()
  const domainName = (value: string) => (domainI18nKeys[value] ? t(domainI18nKeys[value]) : value)
  const rows = (pool.data ?? []).filter(
    (agent) =>
      agent.id !== props.hostId &&
      !props.existing.includes(agent.id) &&
      (!keyword || `${agent.name} ${domainName(agent.domain)} ${agent.desc}`.toLowerCase().includes(keyword)),
  )
  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <Dialog fit title={t("proto.subAgent.addTitle")} className="w-[600px] max-w-[calc(100vw-32px)] overflow-hidden">
      <div className="flex flex-col" style={{ height: "min(600px, 72vh)" }}>
        <div className="shrink-0 px-6">
          <SegmentedControl
            className="w-full [&_[data-slot=segmented-control-list]]:w-full [&_[data-slot=segmented-control-item]]:flex-1"
            value={source}
            onChange={(value) => setSource(value as Source)}
            items={(["local", "mall"] as const).map((value) => ({ value, label: t(`proto.subAgent.source.${value}`) }))}
          />
          <div className="flex items-center gap-2 rounded-[9px] border border-[var(--border-weak-base)] my-3" style={{ height: 36, padding: "0 12px" }}>
            <Icon name="search-16" size="small" className="shrink-0 text-text-weak" />
            <input
              type="text"
              data-autofocus
              className="flex-1 min-w-0 border-0 outline-none text-[13px] bg-transparent text-text-strong placeholder:text-text-weak"
              placeholder={t("proto.subAgent.search")}
              title={t("proto.subAgent.search")}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 flex flex-col gap-4">
          {pool.isPending && <div role="status" className="text-[13px] text-text-weak py-4">{t("proto.subAgent.loading")}</div>}
          {pool.isError && <button type="button" className="text-[13px] text-text-weak py-4 cursor-pointer" onClick={() => void pool.refetch()}>{t("proto.subAgent.retry")}</button>}
          {!pool.isPending && !pool.isError && rows.length === 0 && <div className="text-[12px] text-text-weak pt-0.5">{t(`proto.subAgent.noCandidate.${source}`)}</div>}
          {rows.map((agent) => {
            const on = picked.includes(agent.id)
            return (
              <div
                key={agent.id}
                role="checkbox"
                aria-checked={on}
                aria-label={agent.name}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === " " || event.key === "Enter") {
                    event.preventDefault()
                    toggle(agent.id)
                  }
                }}
                className={cx(
                  "shrink-0 flex items-center gap-2.5 rounded-[10px] border px-3 py-3.5 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand-button-primary-base)]",
                  on ? "border-[var(--brand-button-primary-base)] bg-[var(--brand-button-ghost-base)]" : "border-[var(--border-weak-base)]",
                )}
                onClick={() => toggle(agent.id)}
              >
                <span
                  className={cx(
                    "flex size-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px]",
                    on ? "bg-[var(--brand-button-primary-base)] border-[var(--brand-button-primary-base)] text-[#fff]" : "border-[var(--border-weak-base)]",
                  )}
                >
                  {on && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <img src={publicUrl(agent.avatar || pickAvatar(agent.id))} alt="" className="size-7 shrink-0 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-[7px] min-w-0">
                    <span className="truncate text-[14px] font-semibold text-text-strong" title={agent.name}>
                      {agent.name}
                    </span>
                    <SourceTag agent={agent} />
                    <PublishTag agent={agent} />
                  </div>
                  <div className="mt-[3px] truncate text-[12px] text-text-weak" title={agent.desc}>
                    {domainName(agent.domain)} · {agent.desc}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-end shrink-0" style={{ padding: "16px 24px 20px", gap: 12 }}>
          <span aria-live="polite" className="mr-auto text-[13px] text-text-weak">{picked.length ? t("proto.subAgent.selected", { count: picked.length }) : t("proto.subAgent.noneSelected")}</span>
          <button
            type="button"
            className="h-9 rounded-[12px] text-[14px] font-semibold cursor-pointer bg-[var(--surface-raised-stronger-non-alpha)] text-text-base border border-[var(--border-base)] hover:bg-surface-base-hover"
            style={{ padding: "0 22px" }}
            onClick={dialog.close}
          >
            {t("kcode.agentKnowledge.cancel")}
          </button>
          <button
            type="button"
            disabled={!picked.length}
            className={cx(
              "h-9 rounded-[12px] text-[14px] font-semibold bg-[var(--brand-button-primary-base)] [color:#fff] border border-[var(--brand-button-primary-base)]",
              picked.length ? "cursor-pointer hover:opacity-90" : "opacity-50 cursor-default",
            )}
            style={{ padding: "0 22px" }}
            onClick={() => {
              props.onConfirm(picked)
              dialog.close()
            }}
          >
            {t("kcode.agentKnowledge.confirm")}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

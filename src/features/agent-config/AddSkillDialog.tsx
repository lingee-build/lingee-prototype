import { useMemo, useState, type CSSProperties } from "react"
import { useQuery } from "@tanstack/react-query"
import { BrandButton, Dialog, Empty, Icon, Search, SegmentedControl, useDialog } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { AgentSkill, Skill } from "@/mock/fixtures/dev"
import { consoleScopeService, skillService } from "@/services"
import { DynamicSkillIcon } from "@/features/dev-page/DynamicSkillIcon"
import { SkillTags } from "./SkillConfigTab"
import { marketLocalState } from "@/features/skill-publish-scope/SkillPublishScopeDialog"

type SkillSourceTab = "local" | "marketplace"

/**
 * 从本地项目或技能商城多选关联技能；跨 Tab 的选择保留到确认时统一写回。
 * 「更多技能」= Console 返回的技能商城列表（Build 不存发布范围）；本项目已上架商城的技能只出现在「更多技能」。
 * 所有已发布技能都能被智能体引用，下发 Build 的技能不再限制。
 */
const toRef = (skill: Skill, source: AgentSkill["source"]): AgentSkill => ({
  id: skill.name, name: skill.displayName, skillName: skill.name, desc: skill.desc, source,
  publishStatus: skill.enterpriseStatus === "submitted" ? "reviewing" : skill.everPublished ? "published" : "unpublished",
})

export function AddSkillDialog(props: { projectId: string; selected: AgentSkill[]; onConfirm: (skills: AgentSkill[]) => void }) {
  const t = useT()
  const dialog = useDialog()
  const [source, setSource] = useState<SkillSourceTab>("local")
  const [query, setQuery] = useState("")
  const [picked, setPicked] = useState(() => new Set(props.selected.map((x) => x.id)))
  const all = useQuery({ queryKey: ["skills"], queryFn: skillService.list, staleTime: 0 })
  const mall = useQuery({ queryKey: ["consoleMallSkills"], queryFn: consoleScopeService.mallNames, staleTime: 0 })
  const inMall = (skill: Skill) => !!mall.data?.includes(skill.name) && !!skill.everPublished
  const isCandidate = (skill: Skill) => skill.projectId === props.projectId || inMall(skill)
  const available = useMemo<AgentSkill[]>(() => (all.data ?? [])
    .filter((skill) => (source === "local" ? skill.projectId === props.projectId && !inMall(skill) : inMall(skill)))
    .map((skill) => toRef(skill, inMall(skill) ? "marketplace" : "local")), [all.data, mall.data, props.projectId, source])
  const keyword = query.trim().toLowerCase()
  const list = keyword ? available.filter((skill) => skill.name.toLowerCase().includes(keyword) || skill.desc.toLowerCase().includes(keyword)) : available
  const count = picked.size
  const toggle = (id: string) => setPicked((previous) => { const next = new Set(previous); if (!next.delete(id)) next.add(id); return next })
  const confirm = () => {
    const allCandidates = (all.data ?? []).filter(isCandidate).map((skill) => skill.name)
    const kept = props.selected.filter((skill) => !allCandidates.includes(skill.id))
    const selectedCandidates = (all.data ?? []).filter((skill) => allCandidates.includes(skill.name) && picked.has(skill.name)).map((skill) => toRef(skill, inMall(skill) ? "marketplace" : "local"))
    props.onConfirm([...kept, ...selectedCandidates]); dialog.close()
  }
  return <Dialog fit className="w-[640px] overflow-hidden"><div className="flex flex-col" style={{ height: "65vh", "--border-weak-base": "var(--border-agent-config)", "--input-base": "var(--input-agent-config)" } as CSSProperties}>
    <div className="flex items-center justify-between px-5 pt-5 shrink-0"><span className="text-20-medium text-text-strong">添加技能</span><button type="button" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg hover:bg-[var(--neutral-50)]" onClick={dialog.close}><Icon name="close-small" size="small" className="text-text-weak" /></button></div>
    <div className="flex flex-col gap-3 px-5 pt-4 shrink-0"><SegmentedControl className="w-full [&_[data-slot=segmented-control-list]]:!w-full [&_[data-slot=segmented-control-item]]:!flex-1" value={source} onChange={(value) => setSource(value as SkillSourceTab)} items={[{ value: "local", label: "本地技能" }, { value: "marketplace", label: "更多技能" }]} /><Search style={{ width: "100%" }} wrapperStyle={{ width: "100%" }} value={query} onChange={setQuery} placeholder={t("kcode.agentConfig.skills.search")} /></div>
    {all.isPending || mall.isPending ? <div className="flex flex-1 flex-col gap-2 px-5 py-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[68px] animate-pulse rounded-xl bg-surface-base" />)}</div> : list.length === 0 ? <div className="flex flex-1 items-center justify-center px-5"><Empty description={t(keyword ? "kcode.agentConfig.skills.noMatch" : "kcode.agentConfig.skills.noData")} /></div> : <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-3 space-y-2">{list.map((skill) => { const checked = picked.has(skill.id); return <button key={skill.id} type="button" onClick={() => toggle(skill.id)} className={cx("flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors", checked ? "border-[#5B5FFF] bg-white" : "border-[var(--border-weak-base)] bg-white hover:border-[#C7CAFF]")}><DynamicSkillIcon name={skill.name} size={40} /><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><span className="truncate text-[14px] font-medium text-text-strong">{skill.name}</span><SkillTags source={skill.source} status={skill.publishStatus} localState={marketLocalState(all.data?.find((x) => x.name === skill.skillName))} /></div><span className="block truncate text-12-regular text-text-weak">{skill.desc}</span></div><span className={cx("flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors", checked ? "border-[#5B5FFF] bg-[#5B5FFF]" : "border-[#D9DCE1] bg-white")}>{checked && <Icon name="check-small" size="small" className="size-[14px] text-white [--icon-fill:#fff]" />}</span></button> })}</div>}
    <div className="flex shrink-0 items-center justify-between px-5 py-5"><span className="text-14-regular text-text-weak">已选 <span className="text-[var(--brand-button-primary-base)]">{count}</span> 个</span><div className="flex gap-3"><BrandButton variant="text" size="normal" onClick={dialog.close}>取消</BrandButton><BrandButton variant="primary" size="normal" onClick={confirm}>确认</BrandButton></div></div>
  </div></Dialog>
}

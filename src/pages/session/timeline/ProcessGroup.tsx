import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '@/i18n'
import { ProcessStatus, ProcessChevron } from './ProcessStatus'
import { TextShimmer } from '@/ui/text-shimmer/TextShimmer'
import type { Message, Part, ReasoningPart as ReasoningData, ToolPart as ToolData } from '@/mock/types'
import { contextRuns, isContextTool } from './process-groups'
import { ToolPart } from './ToolPart'
import { ReasoningPart } from './ReasoningPart'
import './process-group.css'

export function MergedReasoning({ parts }: { parts: Part[] }) {
  const list = parts.filter((p): p is ReasoningData => p.type === 'reasoning')
  if (!list.length) return null
  return <ReasoningPart part={{ ...list[0], text: list.map(p => p.text).join('\n\n'), time: { start: list[0].time.start, end: list.at(-1)!.time.end } }} />
}
function ContextTools({ parts, working }: { parts: ToolData[]; working: boolean }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const status = parts.some(p => p.state === 'error') ? 'error' : parts.some(p => p.state === 'running') ? working ? 'running' : 'error' : 'completed'
  const label = t('proto.process.explored', { summary: t(parts.every(p => p.tool === 'read') ? 'ui.messagePart.context.read.other' : 'ui.messagePart.context.search.other', { count: parts.length }) })
  return <div data-component="context-tool-group" className="context-tool-collapsible" data-expanded={open ? '' : undefined}>
    <button type="button" data-component="context-tool-group-trigger" aria-expanded={open} onClick={() => setOpen(!open)}><ProcessStatus status={status}/><span title={label}>{label}</span><ProcessChevron open={open}/></button>
    {open && <div data-component="context-tool-group-list">{parts.map(part => <ToolPart key={part.id} part={part} compact working={working}/>)}</div>}
  </div>
}
export function ToolStageGroup({ parts, working, busy, hasFollowingText }: { parts: Part[]; working: boolean; busy: boolean; hasFollowingText: boolean }) {
  const t = useT()
  const tools = parts.filter((p): p is ToolData => p.type === 'tool')
  const status = tools.some(p => p.state === 'error') ? 'error' : busy || tools.some(p => p.state === 'running') ? working ? 'running' : 'error' : 'completed'
  const [open, setOpen] = useState(status === 'running')
  const interacted = useRef(false)
  const autoCollapsed = useRef(false)
  const list = useRef<HTMLDivElement>(null)
  const follow = useRef(true)
  useEffect(() => {
    if (interacted.current) return
    if (status === 'completed' && hasFollowingText) {
      // Let the completed analysis settle before folding the entire group once.
      const timer = setTimeout(() => {
        if (interacted.current) return
        autoCollapsed.current = true
        setOpen(false)
      }, 450)
      return () => clearTimeout(timer)
    }
    else if (status === 'running' && !autoCollapsed.current) setOpen(true)
  }, [status, hasFollowingText])
  useEffect(() => {
    if (open && status === 'running' && follow.current && list.current) list.current.scrollTop = list.current.scrollHeight
  }, [tools.length, status, open])
  const counts = [
    ['explore', tools.filter(isContextTool).length],
    ['patch', tools.filter(p => ['write','edit'].includes(p.tool)).length],
    ['shell', tools.filter(p => p.tool === 'bash').length],
    ['skill', tools.filter(p => p.tool === 'skill').length],
    ['other', tools.filter(p => !isContextTool(p) && !['write','edit','bash','skill'].includes(p.tool)).length],
  ] as const
  const summary = counts.filter(([, n]) => n > 0).map(([key, count]) => t(`ui.toolStage.summary.${key}`, { count })).join(' · ')
  const label = status === 'running' ? t('ui.toolStage.status.running') : status === 'error' ? t('ui.toolErrorCard.failed') : summary
  return <div data-component="collapsible" data-variant="ghost" className="tool-collapsible tool-stage-collapsible" data-stage-motion={open ? 'open' : 'closed'} data-expanded={open ? '' : undefined} data-closed={!open ? '' : undefined}>
    <button type="button" data-slot="collapsible-trigger" data-hide-details="true" aria-expanded={open} onClick={() => { interacted.current = true; setOpen(!open) }}>
      <div data-component="tool-stage-group-trigger"><div data-component="tool-trigger" data-tool-kind="tool-stage" data-stage-status={status}><div data-slot="basic-tool-tool-trigger-content"><div data-slot="basic-tool-tool-info"><div data-slot="basic-tool-tool-info-structured"><div data-slot="basic-tool-tool-info-main"><ProcessStatus status={status}/><span data-slot="basic-tool-tool-title" title={summary}><TextShimmer text={label} active={status === "running"}/></span>{status === 'running' && <span data-slot="basic-tool-tool-subtitle" title={summary}>{summary}</span>}</div></div></div></div><span data-slot="basic-tool-tool-action" data-slot-kind="tool-stage-action"><ProcessChevron open={open}/></span></div></div>
    </button>
    <div data-slot="collapsible-content" data-expanded={open ? '' : undefined} data-closed={!open ? '' : undefined} aria-hidden={!open} inert={!open}>
      <div data-slot="stage-collapsible-inner"><div ref={list} data-scrollable data-component="tool-stage-group-list" onScroll={() => { if(list.current) follow.current = list.current.scrollHeight - list.current.clientHeight - list.current.scrollTop <= 24 }}>
        {contextRuns(parts).map(run => isContextTool(run[0]) && run.length > 1 ? <ContextTools key={run[0].id} parts={run as ToolData[]} working={working}/> : run[0].type === 'reasoning' ? <MergedReasoning key={run[0].id} parts={run}/> : <ToolPart key={run[0].id} part={run[0] as ToolData} compact working={working}/>)}
      </div></div>
    </div>
  </div>
}
export function TurnProcessGroup({ messages, working, children }: { messages: Message[]; working: boolean; children: ReactNode }) {
  const t = useT()
  const completed = messages.length > 0 && messages.every(m => m.time.completed !== undefined)
  const [open, setOpen] = useState(!completed)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { if (completed) setOpen(false); else setOpen(true) }, [completed])
  useEffect(() => { if (!working) return; const timer = setInterval(() => setNow(Date.now()),1000); return () => clearInterval(timer) },[working])
  const start = messages[0]?.time.created ?? now
  const end = completed ? Math.max(...messages.map(m => m.time.completed ?? now)) : now
  const seconds = Math.max(0, Math.round((end-start)/1000))
  const duration = seconds < 60 ? t('ui.message.duration.seconds',{count:seconds}) : t('ui.message.duration.minutesSeconds',{minutes:Math.floor(seconds/60),seconds:seconds%60})
  const aborted = messages.some(m => m.parts.some(p => p.type === 'tool' && (p.state === 'error' || p.state === 'running'))) && completed
  return <div data-component="collapsible" data-variant="ghost" className="tool-collapsible turn-process-collapsible" data-expanded={open ? '' : undefined} data-closed={!open ? '' : undefined}>
    <button type="button" data-slot="collapsible-trigger" data-disabled={!completed ? '' : undefined} aria-expanded={open} onClick={() => { if(completed) setOpen(!open) }}><div data-slot="turn-process-header" data-status={completed ? 'completed' : 'running'}><span data-slot="turn-process-label"><TextShimmer text={t(!completed ? 'ui.process.working' : aborted ? 'ui.process.aborted' : 'ui.process.completed')} active={working}/></span>{completed && <span data-slot="turn-process-chevron"><ProcessChevron open={false}/></span>}<span data-slot="turn-process-summary" title={duration}>{duration}</span></div></button>
    <div data-slot="turn-process-divider" aria-hidden="true"/>
    <div data-slot="collapsible-content" data-expanded={open ? '' : undefined} data-closed={!open ? '' : undefined} hidden={!open}><div data-slot="turn-process-inner">{children}</div></div>
  </div>
}

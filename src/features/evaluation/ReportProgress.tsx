import {useState} from 'react'
import {Popover} from 'radix-ui'
import {type EvalRun,finishedCaseCount} from '@/services/evaluation'
import {qualityOf} from '@/services/evaluation-quality'

/** 对齐 Build 的分段进度、阶段统计及逐例跳转。 */
export function ReportProgress({run,onCase,inList=false}:{run:EvalRun;inList?:boolean;onCase:(id:string)=>void}) {
 const [open,setOpen]=useState(false)
 const stage=(r:EvalRun['results'][number])=>r.judging?'judging':r.status==='pending'?'pending':r.status==='running'?'running':qualityOf(r).state==='环境阻塞'?'blocked':qualityOf(r).total==null?'not_scored':qualityOf(r).state==='质量未通过'?'fail':'pass'
 const labels:Record<string,string>={pass:'通过',fail:'未通过',blocked:'环境阻塞',not_scored:'未评分',judging:'评分中',running:'运行中',pending:'待执行'}
 const stages=Object.entries(labels).map(([key,label])=>({key,label,count:run.results.filter(r=>stage(r)===key).length})).filter(s=>s.count)
 const state=run.awaitingContinueAt?'待继续':run.status==='stop_unconfirmed'?'运行状态待确认':run.status==='judging'?'评分中':'运行中'
 const completion=`已结束 ${finishedCaseCount(run)}/${run.results.length}`
 return <Popover.Root open={open} onOpenChange={setOpen}><Popover.Trigger className={inList ? "eval-report-progress eval-report-list-progress" : "eval-report-progress"} aria-label={`评测进度 · ${state}，${completion}`}>
 <span className="eval-report-progress-label"><span className="eval-status eval-report-progress-stage">{state}</span><strong>{completion}</strong></span>
 <span className="eval-report-progress-track" role="progressbar" aria-label="评测进度" aria-valuemin={0} aria-valuemax={run.results.length} aria-valuenow={finishedCaseCount(run)}>{stages.map(s=><span key={s.key} className="eval-report-progress-segment" data-stage={s.key} style={{flexGrow:s.count}}/>)}</span>
 <span className="eval-report-progress-legend">{stages.map(s=><span key={s.key} data-stage={s.key}>{s.label} {s.count}</span>)}</span>
 </Popover.Trigger><Popover.Portal><Popover.Content className="eval-report-progress-tooltip" sideOffset={6} align="start" aria-label="评测进度" onOpenAutoFocus={e=>e.preventDefault()}>
 <dl className="eval-report-progress-counts"><div><dt>已评分</dt><dd>{run.results.filter(r=>qualityOf(r).total!=null).length}/{run.results.length}</dd></div>{stages.filter(s=>['judging','running','pending','not_scored'].includes(s.key)).map(s=><div key={s.key}><dt>{s.label}</dt><dd>{s.count}</dd></div>)}</dl>
 <ul className="eval-report-progress-cases">{run.results.map(r=><li key={r.id}><button onClick={()=>{setOpen(false);onCase(r.id)}}><span>{r.code} {r.name}</span><strong className="eval-status" data-status={stage(r)}>{labels[stage(r)]}</strong></button></li>)}</ul>
 </Popover.Content></Popover.Portal></Popover.Root>
}

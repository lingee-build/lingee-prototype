import { type EvalRun, type EvalCheck, checksOf, turnsOf, isActiveRun, resultIssueSummary, executionIssues } from '@/services/evaluation'
import { qualityOf } from '@/services/evaluation-quality'
import { runPoints, casePoints, pointsComplete } from '@/services/evaluation-points'
import { evaluationModelText } from '@/services/evaluation-models'
import { evaluationReportPreviewHtml, type ReportHtmlData } from '@/vendor/build-evaluation/report-html'
import { rubric, type Quality } from '@/vendor/build-evaluation/quality-report'

const criterion = (c: EvalCheck) => ({id:c.id,kind:c.kind==='natural'?'semantic':c.kind||'semantic',description:c.text,mode:c.operator,pattern:c.kind==='regex'?c.text:undefined,path:c.kind==='file'?c.text:undefined})
export function buildReportData(run: EvalRun): ReportHtmlData {
  if (run.buildReport) return run.buildReport
  const points = runPoints(run)
  const complete = pointsComplete(points)
  return {
    code:run.code || run.id, state:run.awaitingContinueAt?'awaiting_continue':run.status==='stop_unconfirmed'?'verifying':isActiveRun(run)?run.status:'ended',
    revision:1, sourceRunId:run.sourceRunId, mode:run.recovery?'rejudge':'execution',
    datasetName:'本次选定用例（原型模拟）', sourceAppVersion:'原型模拟', targetKind:run.objectType || 'skill',
    generatedAt:run.ended || run.started, startedAt:run.started, endedAt:run.ended, concurrency:run.concurrency||1,
    executionModel:{name:evaluationModelText(run.models?.execution)}, judgeModel:{name:evaluationModelText(run.models?.judging)},
    lastActivityAt: run.ended ?? run.started, intervals:[], billing:{knownTotal:points.recorded?points.execution+points.judging:null,complete,breakdown:complete?{execution:points.execution,judgment:points.judging}:undefined},
    attachmentNames:Object.fromEntries(run.results.flatMap(r=>[...(r.attachments||[]),...turnsOf(r).flatMap(t=>t.attachments)].map(a=>[a.id,a.name]))),
    cases:run.results.map((r,i)=>{
      const q=qualityOf(r), credits=casePoints(r)
      const quality: Quality | undefined = q.total!==undefined && q.scores ? {
        status:'complete',version:'Lingee-eval v1.0',score:q.total,grade:q.grade!,blocked:q.state==='环境阻塞',
        analysis:{conclusion:q.evidence,evidenceRefs:[]},
        dimensions:rubric.map(([id,,max],j)=>({id,score:q.scores![j],reason:q.evidence || '原型示例评分',deductions:q.scores![j]<max && q.state!=='环境阻塞'?[{points:max-q.scores![j],problem:q.issue || '本维度未达满分',cause:q.issue || '依据本次记录的模拟执行证据',suggestion:'根据用例标准核对执行证据，修复后重新评测。',severity:'low',evidenceRefs:[]}]:[]})),
      } : ['cancelled','skipped'].includes(r.status) ? undefined : {status:r.judging || ['running','pending'].includes(r.status)?'pending':'incomplete',reason:q.state}
      const rounds=r.roundResults||[]
      return {code:r.code || `EC-${i+1}`,sessionId:rounds.some(t=>t.responseRecorded)?`prototype:${run.id}:${r.id}`:undefined,
        state:r.judging?'judging':['running','pending'].includes(r.status)?r.status:'ended',quality,reason:resultIssueSummary(r) || (['cancelled','skipped'].includes(r.status)?'本轮未执行或执行已停止':undefined),
        startedAt:r.timing?.started,endedAt:r.timing?.ended,executionCredits:credits.recorded?credits.execution:undefined,
        content:{name:r.name,externalCaseId:r.businessId,attachments:(r.attachments||[]).map(a=>a.id),criteria:(r.checks||[]).map(criterion),turns:turnsOf(r).map(t=>({input:t.input,attachments:t.attachments.map(a=>a.id),criteria:checksOf(t).map(criterion),clarifications:t.rules.map(rule=>({question:rule.match,answers:rule.responses}))}))},
        evidence:rounds.flatMap((t,j)=>t.responseRecorded || t.response || t.toolResult || t.clarification || t.placeholderError || t.checkResults?.length ? [{id:`evidence-${i}-${j}`,turn:j,complete:!!t.responseRecorded,reply:t.responseRecorded!==false && t.response ? t.response : null,
          artifacts:[...(r.reviewTrace?.artifact && j===rounds.length-1?[{path:'outputs/库存.csv',text:r.reviewTrace.artifact}]:[]),
            ...((t.toolResult || t.evidence || t.checkResults?.length || t.issue)?[{path:'执行证据（原型模拟）',text:[t.status==='skipped'?'已跳过：本轮未执行':'',t.issue?executionIssues[t.issue].reason:'',t.toolResult,t.evidence,...(t.checkResults||[]).map(c=>[c.actual,c.evidence].filter(Boolean).join('\n')),...(j===rounds.length-1?r.checkResults||[]:[]).map(c=>c.evidence)].filter(Boolean).join('\n')}]:[])],
          records:[...(!t.placeholderError?[{id:`input-${i}-${j}`,kind:'input',value:t.input}]:[]),
            ...(t.clarification && t.clarification!=='无需追问。'?[{id:`clarification-${i}-${j}`,kind:'clarification',value:{questions:[{question:t.clarificationFallbackReason ? t.clarification.split("\n")[0] : t.clarification}],answers:t.clarificationFallbackReason ? [[]] : [t.rules.flatMap(rule=>rule.responses.flat())],fallbackReason:t.clarificationFallbackReason}}]:[]),
            ...(t.tool?[{id:`tool-${i}-${j}`,kind:'tool',value:{tool:t.tool,state:{output:t.toolResult}}}]:[]),
            {id:`reply-${i}-${j}`,kind:'reply',value:t.response}]}]:[]),
      }
    }),
  }
}
/** 与 Build 同源：预览、下载和复核资料使用同一报告渲染器。 */
export function buildReportDocument(run: EvalRun, translate:(key:string)=>string=key=>key, _now=Date.now(), placement:'standalone'|'embedded'='standalone') {
  return evaluationReportPreviewHtml(buildReportData(run),run.name,translate,placement)
}

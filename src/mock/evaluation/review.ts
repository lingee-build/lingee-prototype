import type { EvalCase, DemoTurnEvidence } from '../../services/evaluation'
import dice from './dice-cases.json'

export const diceKey = 'skill:sk_roll_dice'
export const agentKey = 'agent:inventory-review'
export const profile = 'Lingee-eval v1.0'
export const judge = '系统质量 Judge（演示）'
const agent = [{ id: 'SCM-001', name: '导出库存明细', level: 'L2', turns: [{ input: '请导出 A001 的库存明细，列出仓库和可用量。', expected: '生成库存明细 CSV，内容包含物料、仓库和可用量，数值与库存查询一致。', rules: [] }] }]
const source = (key: string) => key === diceKey ? dice : key === agentKey ? agent : []
export function reviewCases(key: string): EvalCase[] {
  return source(key).map(s => ({
    id: crypto.randomUUID(), businessId: s.id, name: s.name, difficulty: s.level, input: s.turns[0].input, expected: '', source: 'none', outcome: 'passed', checks: [], attachments: [],
    turns: s.turns.map(t => ({ id: crypto.randomUUID(), input: t.input, expected: t.expected, attachments: [], rules: t.rules.map(r => ({id:crypto.randomUUID(),match:r.matchDescription,responses:[r.response]})), checks:[{id:crypto.randomUUID(),kind:'natural',text:t.expected,required:true,files:[]}] })),
  }))
}
export const reviewPrompt = (key: string) => key === diceKey ? '生成掷骰子用例，覆盖默认投掷、越界、澄清和多轮。' : key === agentKey ? '生成库存明细导出用例，核对 CSV 和库存数据。' : ''
export const issueText = (id?: string) => id === 'FD-RD-003' ? '首句先解释不能保证大点数，随后才询问用户的意思。可直接从澄清问题开始。' : id === 'SCM-001' ? '库存明细 CSV 缺少仓库列。建议按字段要求生成文件并核对内容。' : ''
const firstAsk = '我不能保证掷出大点数。你的意思是仍按普通六面骰随机掷一次吗？'
const betterAsk = '你说的“大一点”是什么意思？是仍按普通六面骰随机掷一次吗？'
export function reviewExecution(key: string, c: EvalCase, fixed: boolean): EvalCase {
  const spec = source(key).find(s => s.id === c.businessId)
  if (!spec || spec.turns.length !== c.turns?.length || c.checks?.length || c.attachments?.length ||
    !spec.turns.every((t,i) => { const a=c.turns![i], check=a.checks?.[0]; return !Object.keys(a.sourceFields||{}).length && a.input===t.input && a.checks?.length===1 && check?.text===t.expected && check.kind==='natural' && !check.reference && !check.condition && !check.files.length && !a.attachments.length && JSON.stringify(a.rules.map(r=>[r.match,r.responses]))===JSON.stringify(t.rules.map(r=>[r.matchDescription,[r.response]])) })) return c
  const inventory = key === agentKey, ambiguous = spec.id === 'FD-RD-003'
  const artifact = inventory ? (fixed ? '物料,仓库,可用量\nA001,深圳仓,18' : '物料,可用量\nA001,18') : undefined
  const traces: DemoTurnEvidence[] = spec.turns.map((t,i) => {
    const answer = inventory ? '已生成库存明细：outputs/库存.csv。' : spec.id==='FD-RD-002' ? '只支持一颗六面骰，无法掷 20 面骰。' : spec.id==='FD-RD-004' && i===1 ? '2' : '4'
    const clarify = ambiguous ? [
      '澄清分层诊断（模拟证据，非真实 MaaS 调用）',
      '配置层｜预期追问：'+t.rules[0].matchDescription,
      '配置层｜预设答案：'+t.rules[0].response,
      '模型层｜实际追问：'+(fixed ? betterAsk : firstAsk),
      '模型层｜禁止自由回答；单选：正常掷一次（按普通六面骰独立随机掷一次）',
      '执行层｜追问意图：匹配；答案映射：唯一等价选项',
      '执行层｜实际提交：正常掷一次；回执：已接受',
      '评分边界｜匹配成功仅表示澄清可继续，追问是否遵循技能约束仍由质量评测判断。',
    ].join('\n') : '无需追问。'
    const toolResult = inventory ? '库存查询：A001，深圳仓，可用量 18。' : spec.id==='FD-RD-002' ? '未调用掷骰工具。' : '六面骰返回：'+answer
    const failed = inventory && !fixed
    return {response:answer, tool:inventory?'查询库存并导出 CSV':spec.id==='FD-RD-002'?undefined:'roll_dice',toolResult,clarification:clarify,files:inventory?['outputs/库存.csv']:[], judgments:[{check:{text:t.expected},verdict:failed?'failed':'passed',actual:failed?'已生成 CSV，但表头缺少仓库。':inventory?'三列齐全，库存数量与查询一致。':ambiguous?'已在报点前询问并收到确认，随后仅掷一次。':'回复与本轮要求一致。',evidence:[clarify,toolResult,answer,artifact].filter(Boolean).join('\n')}]}
  })
  return {...c, demo:true,demoJudgingDelayMs:800,outcome:inventory&&!fixed?'failed':'passed',demoEvidence:{turns:traces,overall:[]}, reviewTrace:{scenario:spec.id,fixed,artifact}}
}

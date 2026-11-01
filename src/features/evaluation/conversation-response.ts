import type { EvaluationConversation } from '@/services/evaluation-conversations'
import { turnsOf } from '@/services/evaluation'
import { makeDraft } from './generation-drafts'

const scenarios = (text: string) => ['正常查询', '信息缺失', '记录不存在', '多轮追问'].filter((_, i) => [/正常|完整|成功/, /缺少|缺失|不足|澄清/, /不存在|异常|无效/, /多轮|追问/][i].test(text))

/** 本地交互演示：按明确意图推进，不将无关回复解释为新增用例 */
export function respondToEvaluation(next: EvaluationConversation, raw: string): { text: string; changed: boolean } {
  const text = raw.replace(/^\/evaluation-case-designer\s*/, '').trim()
  const choices = '可以补充要覆盖的业务场景和预期结果，例如“正常查询返回单据明细，缺少组织时先询问”'
  if (/^\d+$/.test(text) || text.length < 2) return { text: `还不确定你想调整哪部分。${choices}；修改已有草稿时，可以说“第 1 条改成多轮查询”`, changed: false }
  const target = text.match(/第\s*([1-9]\d*|一|二|三|四)\s*条/)
  if (target) {
    const index = (/^\d+$/.test(target[1]) ? Number(target[1]) : '一二三四'.indexOf(target[1]) + 1) - 1
    const item = next.drafts[index]
    if (!item) return { text: `当前没有第 ${index + 1} 条草稿，请确认要修改的用例`, changed: false }
    if (next.adopted[item.id]) return { text: `第 ${index + 1} 条已加入用例列表，请前往用例列表维护。这里保留加入时的草稿，不再修改或重复加入。`, changed: false }
    if (!/改|补充|增加|添加/.test(text)) return { text: `你希望怎样调整“${item.name}”？可以补充用户输入或评测标准`, changed: false }
    if (/多轮/.test(text)) {
      const turns = structuredClone(turnsOf(item))
      if (turns.length > 1) return { text: '这条用例已经包含多轮对话，请说明要调整哪一轮的输入或评测标准', changed: false }
      const extra = makeDraft(next.objectName, '多轮追问', next.rule, []).turns![1]
      next.drafts[index] = { ...item, turns: [...turns, extra] }
      return { text: `已为第 ${index + 1} 条增加后续追问，原有输入、附件、澄清回复和评测标准均保留。请查看草稿后确认`, changed: true }
    }
    const rename = text.match(/(?:名称|名字|标题)(?:改为|改成|修改为|为|：|:)\s*[“"]?(.+?)[”"]?$/)
    const input = text.match(/(?:用户输入|输入)(?:改为|改成|修改为|为|：|:)\s*[“"]?(.+?)[”"]?$/)
    const criterion = text.match(/(?:评测标准|标准)(?:改为|改成|补充|增加|添加|：|:)\s*[“"]?(.+?)[”"]?$/)
    if (rename) next.drafts[index] = { ...item, name: rename[1].trim() }
    else if (input) {
      const turns = structuredClone(turnsOf(item))
      turns[0].input = input[1].trim()
      next.drafts[index] = { ...item, input: turns[0].input, turns }
    } else if (criterion && /补充|增加|添加/.test(text)) next.drafts[index] = { ...item, checks: [...(item.checks || []), { id: crypto.randomUUID(), kind: 'natural', text: criterion[1].trim(), required: true, files: [] }] }
    else return { text: '请明确修改内容，例如“第 1 条名称改为按单号查询”“第 1 条用户输入改为查询单据 A001”，或“第 1 条补充评测标准：返回客户名称”', changed: false }
    return { text: `已调整第 ${index + 1} 条草稿，请查看修改内容后确认`, changed: true }
  }
  const confirmation = /^(好的?|可以|确认|开始|生成|按建议|按这个|就这样|继续)/.test(text)
  const requested = scenarios(text)
  if (!next.request) {
    next.request = text
    if (!requested.length || !/应|返回|不编造|告知|先询问|先澄清/.test(text)) return { text: `我会为“${next.objectName}”设计用例，建议覆盖正常查询、信息缺失和记录不存在三个场景。\n\n${choices}。也可以回复“按建议生成”，再到草稿中完善业务数据`, changed: false }
  } else if (!next.rule && !confirmation && !requested.length && !/应|返回|不编造|告知|先|结果|要求/.test(text)) {
    return { text: choices, changed: false }
  }
  if (next.drafts.length && !requested.length && !/新增|补充|生成/.test(text)) return { text: '草稿已保留。可以指定要修改的用例，也可以打开用例草稿，检查后加入评测列表', changed: false }
  next.rule ||= confirmation ? '结果应有业务数据依据；信息不足时先询问，记录不存在时明确告知，不编造数据' : text
  let wanted = requested.length ? requested : scenarios(next.request)
  if (!wanted.length) wanted = ['正常查询', '信息缺失', '记录不存在']
  wanted = wanted.filter(s => !next.drafts.some(d => d.name === `${next.objectName} · ${s}`))
  if (!wanted.length) return { text: '这些场景已有草稿，没有重复添加。未加入的草稿可继续完善，已加入的用例请到用例列表维护；也可补充新的业务场景', changed: false }
  next.drafts.push(...wanted.map(s => makeDraft(next.objectName, s, next.rule, next.files)))
  return { text: `已整理 ${wanted.length} 条用例：\n\n${wanted.map(s => `- ${s}`).join('\n')}\n\n每条包含用户输入和评测标准。请在草稿中确认业务数据与预期结果，再加入用例列表`, changed: true }
}

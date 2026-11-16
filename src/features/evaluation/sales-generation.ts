import type { EvaluationConversation } from "@/services/evaluation-conversations"
import type { EvalCase, EvalTurn } from "@/services/evaluation"
import type { Message } from "@/mock/types"

export const salesGenerationObject = "skill:sale-order-management-eval-demo"

function salesReceipt(messages: Message[]) {
  for (const message of [...messages].reverse()) {
    for (const part of [...message.parts].reverse()) {
      if (part.type !== "tool" || part.tool !== "mcp" || part.state !== "completed" || !part.output) continue
      try {
        const data = JSON.parse(part.output)
        if (typeof data?.order?.no === "string" && typeof data.item?.name === "string") {
          return { order: data.order, item: data.item } as {
            order: { no: string; totalallamount?: string }
            item: { name: string; qty?: string; amountandtax?: string }
          }
        }
      } catch {
        // 原型只从可解析的销售订单回执提取字段。
      }
    }
  }
}

export function salesGeneration(next: EvaluationConversation, text: string) {
  if (next.objectId !== salesGenerationObject) return
  const source = next.testSources?.at(-1)
  const generate = /生成|整理|提取|新增/.test(text) && /用例/.test(text)
  const save = (name: string, turn: Omit<EvalTurn, "id" | "attachments">, reply: string, sourceMaterials?: string[]) => {
    if (next.drafts.some(item => item.name === name)) return { text: "这条用例已保存，可在右侧展开核对。", changed: false }
    const draft: EvalCase = {
      id: crypto.randomUUID(), name, input: turn.input, expected: turn.expected,
      source: "none", outcome: "passed", attachments: structuredClone(next.files), sourceMaterials,
      turns: [{ ...turn, id: crypto.randomUUID(), attachments: [] }],
    }
    next.drafts.push(draft)
    return { text: reply, changed: true }
  }

  if (!source) {
    if (!generate || !/单号|订单号|订单编号/.test(text) || !/缺少|未提供|没给|未给/.test(text) || !/先追问|先询问|先澄清/.test(text)) return
    return save("缺少销售订单号时先询问", {
      input: "帮我查一下销售订单。",
      expected: "询问用户要查询的销售订单号。在取得订单号前不调用订单查询工具，不返回订单明细或编造查询结果。",
      rules: [],
    }, "已根据需求保存 1 条用例。检查点是先问订单号，拿到之前不查询、不返回订单明细。")
  }

  const pending = next.pendingSalesSource === source.sessionId
  if (!generate && !pending) return
  const messages = source.messages ?? []
  const receipt = salesReceipt(messages)
  if (!receipt || ![receipt.item.qty, receipt.order.totalallamount].every(value => value != null && String(value).trim() && Number.isFinite(Number(value)))) {
    return { text: "关联会话里缺少可核对的订单号、商品数量或整单含税金额。请补充包含这些字段的工具回执后再生成。当前未保存草稿。", changed: false }
  }
  const correction = pending ? text.match(/(?:商品行含税金额|绿茶含税金额|amountandtax)\s*(?:为|是|[:：=])?\s*(\d+(?:\.\d{1,2})?)\s*(?:元)?/i)?.[1] : undefined
  const itemAmount = receipt.item.amountandtax ?? correction
  if (itemAmount == null || !String(itemAmount).trim() || !Number.isFinite(Number(itemAmount))) {
    next.pendingSalesSource = source.sessionId
    return { text: `订单 ${receipt.order.no} 的工具回执有数量和整单金额，但缺少「${receipt.item.name}」商品行的 amountandtax。请核对分录行后补充，例如回复「商品行含税金额为 … 元」。当前未保存草稿。`, changed: false }
  }
  delete next.pendingSalesSource
  const data = {
    order: { no: receipt.order.no, amount: Number(receipt.order.totalallamount).toFixed(2) },
    product: { name: receipt.item.name, qty: String(Number(receipt.item.qty)), amount: Number(itemAmount).toFixed(2) },
  }
  const questions = messages.flatMap(message => message.parts.flatMap(part =>
    part.type === "tool" && part.tool === "question" && part.state === "completed" ? part.questionAnswers ?? [] : [],
  ))
  const rules = questions.filter(question => question.answers.length).map(question => ({
    id: crypto.randomUUID(), match: question.question,
    responses: question.answers,
  }))
  const input = rules.length
    ? "查一下这张订单，只用三行回答 {{diyJson.product.name}}数量、商品含税金额和整单含税金额。"
    : "查询订单 {{diyJson.order.no}}，只用三行回答 {{diyJson.product.name}}数量、商品含税金额和整单含税金额。"
  const expected = [
    "{{diyJson.product.name}}数量：{{diyJson.product.qty}} 件（商品行 qty）",
    "{{diyJson.product.name}}含税金额：{{diyJson.product.amount}} 元（商品行 amountandtax）",
    "整单含税金额：{{diyJson.order.amount}} 元（订单头 totalallamount）",
    "最终回答仅三行，不输出字段来源括注。金额保留两位小数。",
  ].join("\n")
  const name = `${rules.length ? "澄清订单号后" : ""}查询${data.product.name}数量与含税金额`
  return save(name, { input, expected, rules, sourceFields: { "diyJson 示例": JSON.stringify(data, null, 2) } },
    `已保存草稿。标准答案为 ${data.product.qty} 件、商品行 ${data.product.amount} 元、整单 ${data.order.amount} 元。${rules.length ? "订单号澄清配置在第 1 轮。" : ""} 展开用例可核对标准答案和 diyJson。`,
    [`本地测试会话：${source.title}`, correction && !receipt.item.amountandtax ? "商品行金额由用户核对补充" : "商品行金额来自工具回执"])
}

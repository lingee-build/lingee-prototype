import type { AgentDisplayInfo } from "@/mock/fixtures/dev"

export const AUDIENCE_LIMIT = 5
export const QUESTION_LIMIT = 30
export const questionLength = (text: string) => Array.from(text).length

/** Console 长度上限（中文） */
export const TEXT_LIMIT = 200
export const TITLE_LIMIT = 50

type Scenario = AgentDisplayInfo["businessScenarios"][number]
const trimScenario = (s: Partial<Scenario>): Scenario => ({
  title: (s.title ?? "").trim(), problem: (s.problem ?? "").trim(), solution: (s.solution ?? "").trim(), question: (s.question ?? "").trim(),
})
const blank = (s: Scenario) => !s.title && !s.problem && !s.solution && !s.question

export function normalizeDisplayInfo(info?: AgentDisplayInfo): AgentDisplayInfo {
  return {
    targetAudience: info?.targetAudience.map(value => value.trim()).filter(Boolean) ?? [],
    detailedIntroduction: {
      coreValue: info?.detailedIntroduction.coreValue.trim() ?? "",
      coreAdvantage: info?.detailedIntroduction.coreAdvantage.trim() ?? "",
    },
    // 全空的场景保存时丢弃
    businessScenarios: info?.businessScenarios.map(trimScenario).filter(s => !blank(s)) ?? [],
    exampleQuestion: info?.exampleQuestion.trim() ?? "",
  }
}

/**
 * 展示信息均为选填，只校验格式（长度以 Console 为准）。
 * 例外：场景填了任意内容时，场景名称必填（Console @NotBlank）。
 * 场景错误按界面上的原始下标记录，便于定位到对应页签。
 */
export function displayInfoErrors(info?: AgentDisplayInfo): Record<string, string> {
  const { targetAudience, exampleQuestion, detailedIntroduction } = normalizeDisplayInfo(info)
  const errors: Record<string, string> = {}
  if (targetAudience.length > AUDIENCE_LIMIT) errors.audience = "audienceLimit"
  else if (new Set(targetAudience).size !== targetAudience.length) errors.audience = "audienceDuplicate"
  if (questionLength(exampleQuestion) > QUESTION_LIMIT) errors.question = "questionLimit"
  for (const field of ["coreValue", "coreAdvantage"] as const)
    if (questionLength(detailedIntroduction[field]) > TEXT_LIMIT) errors[field] = "textLimit"
  info?.businessScenarios.map(trimScenario).forEach((s, index) => {
    if (blank(s)) return
    if (!s.title) errors[`scenario-${index}-title`] = "titleRequired"
    else if (questionLength(s.title) > TITLE_LIMIT) errors[`scenario-${index}-title`] = "titleLimit"
    for (const field of ["problem", "solution"] as const)
      if (questionLength(s[field]) > TEXT_LIMIT) errors[`scenario-${index}-${field}`] = "textLimit"
  })
  return errors
}

import type { AgentDisplayInfo } from "@/mock/fixtures/dev"

export const AUDIENCE_LIMIT = 5
export const QUESTION_LIMIT = 30
export const questionLength = (text: string) => Array.from(text).length

export function normalizeDisplayInfo(info?: AgentDisplayInfo): AgentDisplayInfo {
  return {
    targetAudience: info?.targetAudience.map(value => value.trim()).filter(Boolean) ?? [],
    detailedIntroduction: {
      coreValue: info?.detailedIntroduction.coreValue.trim() ?? "",
      coreAdvantage: info?.detailedIntroduction.coreAdvantage.trim() ?? "",
    },
    businessScenarios: info?.businessScenarios.map(({ title, problem, solution }) => ({
      title: title.trim(), problem: problem.trim(), solution: solution.trim(),
    })).filter(({ title, problem, solution }) => title || problem || solution) ?? [],
    exampleQuestion: info?.exampleQuestion.trim() ?? "",
  }
}

/** 展示信息均为选填，只校验格式：人群最多 5 项且不重复、示例问法不超过 30 字 */
export function displayInfoErrors(info?: AgentDisplayInfo): Record<string, string> {
  const { targetAudience, exampleQuestion } = normalizeDisplayInfo(info)
  const errors: Record<string, string> = {}
  if (targetAudience.length > AUDIENCE_LIMIT) errors.audience = "audienceLimit"
  else if (new Set(targetAudience).size !== targetAudience.length) errors.audience = "audienceDuplicate"
  if (questionLength(exampleQuestion) > QUESTION_LIMIT) errors.question = "questionLimit"
  return errors
}

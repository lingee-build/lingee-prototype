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
    })) ?? [],
    exampleQuestion: info?.exampleQuestion.trim() ?? "",
  }
}

export function displayInfoErrors(info?: AgentDisplayInfo): Record<string, string> {
  const { targetAudience, detailedIntroduction, businessScenarios, exampleQuestion } = normalizeDisplayInfo(info)
  const errors: Record<string, string> = {}
  if (!targetAudience.length) errors.audience = "audienceMissing"
  else if (targetAudience.length > AUDIENCE_LIMIT) errors.audience = "audienceLimit"
  else if (new Set(targetAudience).size !== targetAudience.length) errors.audience = "audienceDuplicate"
  if (!detailedIntroduction.coreValue) errors.coreValue = "required"
  if (!detailedIntroduction.coreAdvantage) errors.coreAdvantage = "required"
  if (!businessScenarios.length) errors.scenarios = "scenarioMissing"
  businessScenarios.forEach((scenario, index) => {
    for (const key of ["title", "problem", "solution"] as const) {
      if (!scenario[key]) errors[`scenario-${index}-${key}`] = "required"
    }
  })
  if (!exampleQuestion) errors.question = "required"
  else if (questionLength(exampleQuestion) > QUESTION_LIMIT) errors.question = "questionLimit"
  return errors
}

import { useState } from "react"
import type { QuestionInfo } from "@/mock/types"

/**
 * 提问 dock 的答题状态：当前题、每题答案、自定义答案、已跳过的题。
 * 单选题选中即切换，多选题逐项勾选；自定义答案和预设选项走同一套答案数组；
 * 选项带 followUp 时选中展开补充输入（如新工具名），提交时拼在该题答案末尾。
 */
export function useQuestionState(questions: QuestionInfo[]) {
  const [tab, setTab] = useState(0)
  const [answers, setAnswers] = useState<string[][]>(() => questions.map(() => []))
  const [custom, setCustom] = useState<string[]>(() => questions.map(() => ""))
  const [followUp, setFollowUp] = useState<string[]>(() => questions.map(() => ""))
  const [skipped, setSkipped] = useState<boolean[]>(() => questions.map(() => false))
  const [editing, setEditing] = useState<number | null>(null)

  const setAnswer = (index: number, update: (current: string[]) => string[]) =>
    setAnswers((all) => all.map((x, i) => (i === index ? update(x) : x)))

  const answered = (index: number) => skipped[index] || answers[index].some((x) => x.trim())
  const unanswered = questions.map((_, i) => i).filter((i) => !answered(i))

  return {
    tab,
    setTab,
    answers,
    custom,
    followUp,
    setFollowUpValue(index: number, value: string) {
      setFollowUp((all) => all.map((x, i) => (i === index ? value : x)))
    },
    editing,
    setEditing,
    unanswered,
    allAnswered: unanswered.length === 0,
    last: tab >= questions.length - 1,

    pick(index: number, label: string) {
      setSkipped((all) => all.map((x, i) => (i === index ? false : x)))
      if (questions[index].multiple) return setAnswer(index, (x) => (x.includes(label) ? x.filter((v) => v !== label) : [...x, label]))
      setAnswer(index, () => [label])
    },

    customPicked: (index: number) => !!custom[index].trim() && answers[index].includes(custom[index].trim()),

    /** 输入自定义答案：有内容即视为选中，清空则取消 */
    setCustomValue(index: number, value: string) {
      const prev = custom[index].trim()
      const next = value.trim()
      setCustom((all) => all.map((x, i) => (i === index ? value : x)))
      setSkipped((all) => all.map((x, i) => (i === index ? false : x)))
      setAnswer(index, (current) => {
        const rest = current.filter((x) => x !== prev)
        if (!next) return rest
        return questions[index].multiple ? [...rest, next] : [next]
      })
    },

    selectAllRecommended() {
      setAnswers(
        questions.map((q) => {
          const recommended = q.options.filter((x) => x.recommended).map((x) => x.label)
          return q.multiple ? recommended : recommended.slice(0, 1)
        }),
      )
    },

    skip(index: number) {
      setSkipped((all) => all.map((x, i) => (i === index ? true : x)))
      setAnswer(index, () => [])
    },
  }
}

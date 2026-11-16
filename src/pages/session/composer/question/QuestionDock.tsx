import { SmartIdentifierIcon } from "@/source-runtime/SmartIdentifierIcon"
import { Fragment, useEffect, useRef, useState } from "react"
import { Button, DockPrompt, Icon } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { QuestionRequest } from "@/mock/types"
import { Mark, QuestionOption } from "./QuestionOption"
import { useQuestionState } from "./use-question-state"

/**
 * 提问 dock：模型向用户确认信息时顶替输入框出现。
 * 多道题纵向排列、可上下切换；每题支持预设选项 + 自己输入；全部作答（或跳过）后才能确认。
 */
export function QuestionDock(props: { request: QuestionRequest; onSubmit: (answers: string[][]) => void }) {
  const t = useT()
  const questions = props.request.questions
  const state = useQuestionState(questions)
  const options = useRef<HTMLDivElement>(null)
  const navigating = useRef(false)
  const sections = useRef<Array<HTMLDivElement | null>>([])
  const [hoverConfirm, setHoverConfirm] = useState(false)
  const single = questions.length <= 1
  const hasRecommended = questions.some((q) => q.options.some((o) => o.recommended))
  const customLabel = t("ui.messagePart.option.typeOwnAnswer")
  const customPlaceholder = t("ui.question.custom.placeholder")

  // 切题时把对应题目滚到可视区
  useEffect(() => {
    const section = sections.current[state.tab]
    const container = options.current
    if (!section || !container) return
    navigating.current = true
    const top = section.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
    container.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })
    const timer = setTimeout(() => { navigating.current = false }, 320)
    return () => clearTimeout(timer)
  }, [state.tab])

  const confirm = () => {
    if (!state.allAnswered) return
    // 选项带 followUp（如「更换工具」填新工具名）时，把补充输入拼在该题答案末尾
    props.onSubmit(
      state.answers.map((answers, qi) => {
        const picked = questions[qi].options.find((o) => answers.includes(o.label))
        const extra = picked?.followUp ? state.followUp[qi].trim() : ""
        return answers.length > 0 && extra ? [...answers, extra] : answers
      }),
    )
  }
  // 跳过当前题；跳过的是最后一道未答题时直接提交
  const skip = () => {
    const remaining = state.unanswered.filter((i) => i !== state.tab)
    state.skip(state.tab)
    if (remaining.length === 0) return props.onSubmit(state.answers.map((x, i) => (i === state.tab ? [] : x)))
    state.setTab(remaining[0])
  }

  return (
    <DockPrompt
      kind="question"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); confirm(); return }
        if (e.altKey && e.key.toLowerCase() === "r") { e.preventDefault(); state.selectAllRecommended(); return }
        if ((e.target as HTMLElement).matches("textarea,input")) return
        if (e.key === "Escape") { e.preventDefault(); skip() }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); state.setTab(Math.max(0, state.tab - 1)) }
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); state.setTab(Math.min(questions.length - 1, state.tab + 1)) }
      }}
      header={
        single ? undefined : (
          <div data-slot="question-progress-row">
            <span data-slot="question-multi-title">{t("ui.question.multiSelectTitle")}</span>
            <div data-slot="question-progress-text">
              <button
                type="button"
                data-slot="question-progress-nav"
                data-direction="prev"
                disabled={state.tab <= 0}
                onClick={() => state.setTab(state.tab - 1)}
                aria-label={t("ui.common.back")}
              >
                <Icon name="question-up" size="small" />
              </button>
              <span data-slot="question-progress-count">{`${state.tab + 1}/${questions.length}`}</span>
              <button
                type="button"
                data-slot="question-progress-nav"
                data-direction="next"
                disabled={state.last}
                onClick={() => state.setTab(state.tab + 1)}
                aria-label={t("ui.common.next")}
              >
                <Icon name="question-down" size="small" />
              </button>
            </div>
          </div>
        )
      }
      footer={
        <>
          {hasRecommended && (
            <Button variant="ghost" size="large" onClick={state.selectAllRecommended} aria-keyshortcuts="Alt+R" className="mr-auto inline-flex items-center gap-1.5">
              <SmartIdentifierIcon className="size-4 shrink-0" />
              {t("ui.question.selectAllRecommended")}
            </Button>
          )}
          <Button variant="ghost" size="large" onClick={skip}>
            {t("ui.common.skip")}
          </Button>
          <div data-slot="question-confirm-area" onMouseEnter={() => setHoverConfirm(true)} onMouseLeave={() => setHoverConfirm(false)}>
            <div data-slot="question-footer-actions">
              <Button
                variant="primary"
                size="large"
                className={cx(
                  "h-9 px-3 py-2 leading-[20px] text-[14px] font-[400] cursor-pointer rounded-[12px] bg-[var(--primary-600)] border-none hover:bg-[var(--primary-700)]",
                  !state.allAnswered && "!cursor-not-allowed",
                )}
                disabled={!state.allAnswered}
                onClick={confirm}
              >
                {t("ui.common.confirm")}
              </Button>
            </div>
            {hoverConfirm && state.unanswered.length > 0 && !single && (
              <div data-slot="question-unanswered-popup">
                <span data-slot="popup-hint">{t("ui.question.unanswered.hint", { count: state.unanswered.length })}</span>
                <div data-slot="popup-numbers">
                  {state.unanswered.map((index) => (
                    <button key={index} type="button" data-slot="popup-number-btn" onClick={() => state.setTab(index)}>
                      {index + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      }
    >
      <div data-slot="question-options" ref={options} onScroll={() => {
        if (navigating.current || state.editing !== null || !options.current) return
        const top = options.current.getBoundingClientRect().top
        const index = sections.current.findLastIndex(section => section && section.getBoundingClientRect().top - top <= 40)
        if (index >= 0 && index !== state.tab) state.setTab(index)
      }}>
        {questions.map((q, qi) => (
          <div
            key={qi}
            data-slot="question-section"
            data-active={state.tab === qi}
            ref={(el) => {
              sections.current[qi] = el
            }}
            role={q.multiple ? "group" : "radiogroup"}
            aria-label={q.question}
          >
            <div data-slot="question-header-main">
              <div data-slot="question-header-title" title={q.question}>
                {q.question}
              </div>
            </div>
            {q.options.map((option, oi) => (
              <Fragment key={option.label}>
                <QuestionOption
                  multi={!!q.multiple}
                  picked={state.answers[qi].includes(option.label)}
                  index={oi + 1}
                  label={option.label}
                  description={option.description}
                  tag={option.recommended ? t("dialog.provider.tag.recommended") : undefined}
                  onClick={() => {
                    state.setTab(qi)
                    state.pick(qi, option.label)
                  }}
                />
                {option.followUp && state.answers[qi].includes(option.label) && (
                  <div data-slot="question-follow-up">
                    <textarea
                      data-slot="question-custom-input"
                      placeholder={option.followUp}
                      value={state.followUp[qi]}
                      rows={1}
                      wrap="soft"
                      aria-label={option.followUp}
                      onChange={(e) => {
                        state.setFollowUpValue(qi, e.currentTarget.value)
                        e.currentTarget.style.height = "auto"
                        e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
                      }}
                    />
                  </div>
                )}
              </Fragment>
            ))}
            {q.custom !== false &&
              (state.editing === qi ? (
                <form
                  data-slot="question-option"
                  data-custom="true"
                  data-picked={state.customPicked(qi)}
                  onSubmit={(e) => {
                    e.preventDefault()
                    state.setEditing(null)
                  }}
                >
                  <Mark multi={!!q.multiple} picked={state.customPicked(qi)} index={q.options.length + 1} />
                  <span data-slot="question-option-main">
                    <span data-slot="option-label">{customLabel}</span>
                    <textarea
                      autoFocus
                      data-slot="question-custom-input"
                      placeholder={customPlaceholder}
                      value={state.custom[qi]}
                      rows={1}
                      wrap="soft"
                      onChange={(e) => { state.setCustomValue(qi, e.currentTarget.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px` }}
                      onBlur={() => state.setEditing(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing)) {
                          e.preventDefault()
                          state.setEditing(null)
                        }
                      }}
                    />
                  </span>
                </form>
              ) : (
                <button
                  type="button"
                  data-slot="question-option"
                  data-custom="true"
                  data-picked={state.customPicked(qi)}
                  role={q.multiple ? "checkbox" : "radio"}
                  aria-checked={state.customPicked(qi)}
                  onClick={() => {
                    state.setTab(qi)
                    state.setEditing(qi)
                  }}
                >
                  <Mark multi={!!q.multiple} picked={state.customPicked(qi)} index={q.options.length + 1} />
                  <span data-slot="question-option-main">
                    <span data-slot="option-label">{customLabel}</span>
                    <span data-slot="option-description">{state.custom[qi] || customPlaceholder}</span>
                  </span>
                </button>
              ))}
          </div>
        ))}
      </div>
    </DockPrompt>
  )
}

import type { MouseEventHandler, ReactNode } from "react"
import { Tooltip } from "@/ui"

/** 选项前的标记：多选是复选框，单选是带序号的圆点 */
export function Mark(props: { multi: boolean; picked: boolean; index: number }) {
  return (
    <span data-slot="question-option-check" aria-hidden="true">
      {props.multi ? (
        <span data-slot="question-option-box" data-type="checkbox" data-picked={props.picked}>
          <svg data-slot="question-option-checkmark" width="14" height="14" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : (
        <span data-slot="question-option-box" data-type="number" data-picked={props.picked}>
          <span data-slot="question-option-index">{props.index}</span>
        </span>
      )}
    </span>
  )
}

export function QuestionOption(props: {
  multi: boolean
  picked: boolean
  index: number
  label: string
  description?: string
  tag?: string
  onClick: MouseEventHandler<HTMLButtonElement>
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      data-slot="question-option"
      data-picked={props.picked}
      role={props.multi ? "checkbox" : "radio"}
      aria-checked={props.picked}
      onMouseDown={(e) => { if (e.button === 0) e.preventDefault() }}
      onClick={props.onClick}
    >
      <Mark multi={props.multi} picked={props.picked} index={props.index} />
      <span data-slot="question-option-main">
        <span data-slot="option-label">
          <span data-slot="option-label-text">{props.label}</span>
          {props.tag && <span data-slot="option-label-tag">{props.tag}</span>}
        </span>
        {props.description && (
          <Tooltip value={props.description} placement="top" contentStyle={{ maxWidth: 434, wordBreak: "break-word" }}>
            <span data-slot="option-description">{props.description}</span>
          </Tooltip>
        )}
      </span>
    </button>
  )
}

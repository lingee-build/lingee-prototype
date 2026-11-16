import { useT } from "@/i18n"
import { PromptInput, type PromptInputProps } from "@/features/prompt-input/PromptInput"
import { sessionService } from "@/services"
import { useSync } from "@/stores/sync"
import { PermissionDock } from "./PermissionDock"
import { TodoDock } from "./TodoDock"
import { QuestionDock } from "./question/QuestionDock"

/**
 * 会话底部的输入区域（对应原工程的 SessionComposerRegion）。
 * 平时是「待办 + 输入框」；模型提问或申请权限时，由对应的 dock 顶替输入框，处理完再恢复。
 */
export function Composer(props: PromptInputProps & { sessionId: string }) {
  const t = useT()
  const todos = useSync((s) => s.todos[props.sessionId])
  const question = useSync((s) => s.questions[props.sessionId])
  const permission = useSync((s) => s.permissions[props.sessionId])
  const showTodos = !!todos?.length && todos.some((x) => x.status !== "completed")

  if (question)
    return <QuestionDock key={question.id} request={question} onSubmit={(answers) => sessionService.replyQuestion(props.sessionId, answers)} />
  if (permission)
    return <PermissionDock request={permission} onDecide={(reply) => sessionService.replyPermission(props.sessionId, reply)} />

  return (
    <>
      {showTodos && (
        <div className="pb-1">
          <TodoDock todos={todos} />
        </div>
      )}
      <div className="relative">
        <PromptInput {...props} />
      </div>
      <p className="text-center text-[12px] text-[var(--neutral-400)] leading-[18px] mt-2">{t("prompt.disclaimer")}</p>
    </>
  )
}

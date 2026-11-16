import { useState } from "react"
import { BrandButton, Dialog, Input, useDialog } from "@/ui"
import { useT } from "@/i18n"
import type { Workflow } from "@/mock/fixtures/workflows"

const NAME_MAX = 40
const DESC_MAX = 200

/**
 * 编辑工作流基础信息：只改名称与描述，设计内容不受影响。
 * 新建工作流走新任务页的 workflow-builder 对话，不用这个弹窗。
 */
export function WorkflowFormDialog(props: {
  workflow: Workflow
  existingNames: string[]
  onSubmit: (input: { name: string; desc: string }) => Promise<void>
}) {
  const t = useT()
  const dialog = useDialog()
  const [name, setName] = useState(props.workflow.name ?? "")
  const [desc, setDesc] = useState(props.workflow.desc ?? "")
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const trimmed = name.trim()
  const duplicated = props.existingNames.some((x) => x === trimmed && x !== props.workflow.name)
  const nameError = !trimmed
    ? t("proto.workflow.form.nameRequired")
    : trimmed.length > NAME_MAX
      ? t("proto.workflow.form.nameTooLong", { max: NAME_MAX })
      : duplicated
        ? t("proto.workflow.form.nameDuplicated")
        : undefined
  const descError = desc.length > DESC_MAX ? t("proto.workflow.form.descTooLong", { max: DESC_MAX }) : undefined

  const submit = async () => {
    setTouched(true)
    if (nameError || descError || submitting) return
    setSubmitting(true)
    await props.onSubmit({ name: trimmed, desc: desc.trim() })
    setSubmitting(false)
    dialog.close()
  }

  return (
    <Dialog
      fit
      title={t("proto.workflow.form.editTitle")}
      className="w-[560px] max-w-[calc(100vw-32px)] !rounded-[24px] overflow-hidden shadow-[0px_6px_12px_rgba(0,0,0,0.08)]"
    >
      <form
        className="workflow-form flex flex-col gap-5 px-6 pb-6 pt-1"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Input
          label={t("proto.workflow.form.name")}
          required
          autoFocus
          value={name}
          onChange={setName}
          placeholder={t("proto.workflow.form.namePlaceholder")}
          error={touched ? nameError : undefined}
        />
        <Input
          label={t("proto.workflow.form.desc")}
          multiline
          value={desc}
          onChange={setDesc}
          placeholder={t("proto.workflow.form.descPlaceholder")}
          className="min-h-[72px] max-h-[160px]"
          error={descError}
        />

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            className="h-[34px] cursor-pointer rounded-[8px] border-none bg-transparent px-4 text-[14px] text-[var(--neutral-600)] transition-colors hover:bg-[var(--surface-base-hover)]"
            disabled={submitting}
            onClick={dialog.close}
          >
            {t("common.cancel")}
          </button>
          <BrandButton type="submit" variant="primary" size="normal" disabled={submitting}>
            {t("common.save")}
          </BrandButton>
        </div>
      </form>
    </Dialog>
  )
}

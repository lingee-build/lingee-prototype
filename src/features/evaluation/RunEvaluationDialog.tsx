import { useEffect, useRef, useState } from "react"
import { Dialog as Radix } from "radix-ui"
import { BrandButton, Dialog } from "@/ui"
import { useT } from "@/i18n"
import { useSync } from "@/stores/sync"
import { EvaluationModelSelect } from "./EvaluationModelSelect"
import { resolveEvaluationModels, type EvalModelIds, type EvalRunModels } from "@/services/evaluation-models"

export function RunEvaluationDialog({ name, count, scope, initial, defaults, rerun, missingCount, onClose, onStart }: {
  name: string; count: number; scope: string; initial: EvalModelIds; defaults: EvalModelIds; rerun: boolean; missingCount: number
  onClose: () => void; onStart: (models: EvalRunModels) => void | Promise<void>
}) {
  const t = useT()
  const models = useSync(s => s.models)
  const ready = useSync(s => s.ready)
  const [selection, setSelection] = useState(initial)
  const [starting, setStarting] = useState(false)
  const submitting = useRef(false)
  const returnFocus = useRef(document.activeElement as HTMLElement | null)
  useEffect(() => {
    const trigger = returnFocus.current
    return () => { queueMicrotask(() => { if (trigger?.isConnected) trigger.focus() }) }
  }, [])
  const [error, setError] = useState("")
  const close = () => { if (!submitting.current) onClose() }
  const modelError = (id: string) => !ready ? undefined : !models.length ? t("proto.eval.models.empty")
    : !id ? t(rerun ? "proto.eval.models.legacy" : "proto.eval.models.required")
    : !models.some(model => model.id === id) ? t("proto.eval.models.unavailable") : undefined
  const valid = ready && !!resolveEvaluationModels(selection, models)
  async function start(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current || !valid) return
    const resolved = resolveEvaluationModels(selection, useSync.getState().models)
    if (!resolved) { setError(t("proto.eval.models.changed")); return }
    submitting.current = true
    setStarting(true)
    setError("")
    try { await onStart(resolved) }
    catch (error) { setError(error instanceof Error ? error.message : t("proto.eval.models.startFailed")) }
    finally { submitting.current = false; setStarting(false) }
  }
  return <Radix.Root open modal onOpenChange={open => { if (!open) close() }}>
    <Radix.Portal>
      <Radix.Overlay data-component="dialog-overlay" />
      <Dialog fit title={t("proto.eval.models.title")} width="min(440px, calc(100vw - 32px))" className="eval-run-dialog" onClose={close}>
        <form onSubmit={start} aria-busy={starting}>
          <dl className="eval-run-context">
            <dt>{t("proto.eval.models.object")}</dt><dd>{name}</dd>
            <dt>{t("proto.eval.models.scope")}</dt><dd>{scope} · {t("proto.eval.models.count", { count })}</dd>
          </dl>
          {rerun && <p className="eval-run-note">{t("proto.eval.models.latestContent")}</p>}
          {!!missingCount && <p className="eval-run-note" role="status">{t("proto.eval.models.deletedCases", { count: missingCount })}</p>}
          {(["execution", "judging"] as const).map(role => <EvaluationModelSelect key={role}
            label={t(`proto.eval.models.${role}`)} hint={t(`proto.eval.models.${role}Hint`)}
            value={selection[role]} models={models} disabled={starting || !ready}
            defaultId={defaults[role]} defaultLabel={t(`proto.eval.models.${role}Default`)}
            error={modelError(selection[role])}
            onChange={id => { setSelection(current => ({ ...current, [role]: id })); setError("") }} />)}
          {!ready && <p role="status" className="eval-muted">{t("proto.eval.models.loading")}</p>}
          {error && <p className="eval-field-error" role="alert">{error}</p>}
          <div className="eval-run-dialog-actions">
            <BrandButton variant="primary" type="submit" disabled={!valid || starting || !count}>
              {t(starting ? "proto.eval.models.starting" : "proto.eval.models.start")}
            </BrandButton>
          </div>
        </form>
      </Dialog>
    </Radix.Portal>
  </Radix.Root>
}

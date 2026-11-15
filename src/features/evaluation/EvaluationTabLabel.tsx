import { useT } from "@/i18n"

/** 对齐 Build 的 EvaluationLabel compact 样式。 */
export function EvaluationTabLabel() {
  const t = useT()
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {t("proto.eval.title")}
      <span className="inline-block font-normal text-text-weak text-[11px] leading-4">Beta</span>
    </span>
  )
}

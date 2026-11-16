import { Icon } from "@/ui"
import { useT } from "@/i18n"
import type { McpApp } from "@/mock/fixtures/dev"
import { CHECK_ROWS, checkField } from "@/vendor/kcode-web/src/utils/mcp-app-check"
import { missingRequired } from "./status"

/**
 * 业务组件的「检查」：按清单逐项核对 info.json 的字段是否填写（清单与线上共用同一份）。
 * 表格结构对齐线上的 kdapp-artifact-preview。
 */
export function McpAppCheck(props: { app: McpApp }) {
  const t = useT()
  const missing = missingRequired(props.app).length

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-[16px] font-medium leading-[24px] text-text-strong">{t("kcode.mcpApp.preview.check.title")}</div>
        {missing > 0 ? (
          <span className="rounded-full bg-[var(--red-100)] px-2.5 py-0.5 text-[12px] font-medium leading-[18px] text-[var(--red-600)]">
            {t("kcode.mcpApp.preview.check.missingCount", { count: missing })}
          </span>
        ) : (
          <span className="rounded-full bg-[var(--green-100)] px-2.5 py-0.5 text-[12px] font-medium leading-[18px] text-[var(--green-600)]">
            {t("kcode.mcpApp.preview.check.allComplete")}
          </span>
        )}
      </div>

      {!props.app.info ? (
        <div className="bg-surface-skill-info rounded-[16px] px-5 py-4 text-[14px] leading-[22px] text-[var(--neutral-500)]">{t("kcode.mcpApp.preview.check.noInfo")}</div>
      ) : (
        <>
          <div className="rounded-[16px] border border-[var(--border-weak-base)] overflow-hidden">
            <table className="w-full text-[14px] leading-[22px]">
              <thead>
                <tr className="bg-surface-skill-info text-text-weak">
                  <th className="px-4 py-2.5 text-left font-medium w-[40%]">{t("kcode.mcpApp.preview.check.col.field")}</th>
                  <th className="px-4 py-2.5 text-left font-medium w-[15%]">{t("kcode.mcpApp.preview.check.col.required")}</th>
                  <th className="px-4 py-2.5 text-left font-medium w-[15%]">{t("kcode.mcpApp.preview.check.col.status")}</th>
                  <th className="px-4 py-2.5 text-left font-medium w-[30%]">{t("kcode.mcpApp.preview.check.col.desc")}</th>
                </tr>
              </thead>
              <tbody>
                {CHECK_ROWS.map((row) => {
                  const status = checkField(props.app.info, row)
                  return (
                    <tr key={row.field} className="border-t border-[var(--border-weak-base)]">
                      <td className="px-4 py-2.5 font-mono text-text-base break-all">{row.field}</td>
                      <td className="px-4 py-2.5">
                        {row.required ? (
                          <span className="text-[var(--red-500)] font-medium">{t("kcode.mcpApp.preview.check.required")}</span>
                        ) : (
                          <span className="text-[var(--neutral-400)]">{t("kcode.mcpApp.preview.check.optional")}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {(status === "ok" || status === "optional-ok") && (
                          <span className="inline-flex items-center gap-1 text-[var(--green-600)]">
                            <Icon name="circle-check" className="size-4" /> {t("kcode.mcpApp.preview.check.filled")}
                          </span>
                        )}
                        {status === "empty" && (
                          <span className="inline-flex items-center gap-1 text-[var(--red-500)]">
                            <Icon name="circle-x" className="size-4" /> {t("kcode.mcpApp.preview.check.missing")}
                          </span>
                        )}
                        {status === "optional-empty" && (
                          <span className="inline-flex items-center gap-1 text-[var(--neutral-400)]">
                            <Icon name="dash" className="size-4" /> {t("kcode.mcpApp.preview.check.notFilled")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--neutral-500)]">{t(row.descKey)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 bg-surface-skill-info rounded-[16px] px-5 py-4 text-[14px] leading-[22px] text-[var(--neutral-500)]">
            <span className="font-medium text-text-base">relateTools</span> {t("kcode.mcpApp.preview.check.relateToolsDesc")}
          </div>
        </>
      )}
    </>
  )
}

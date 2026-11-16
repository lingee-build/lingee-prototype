import { useEffect, useRef, useState } from "react"
import { Icon } from "@/ui"
import { cx } from "@/lib/cx"
import { useEnvScenario, type ScenarioFlags } from "@/features/env-source/env-scenario"

/**
 * 演示场景悬浮控件（原型评审工具，非产品功能）：全局右下角小圆钮，点开浮层切换场景。
 * 页面正文不再出现任何演示痕迹；URL 直达（?env-scenario=）照常生效，见 env-scenario.ts。
 */

const SCENARIOS: Array<{ key: keyof ScenarioFlags; label: string; hint: string }> = [
  { key: "noSandbox", label: "没有测试环境", hint: "来源＝生产并标注；测试拦截" },
  { key: "noSaasConn", label: "测试环境无可用 SaaS 连接器", hint: "登录生产时来源＝生产并告知原因" },
  { key: "loginTest", label: "直接登录测试环境", hint: "来源＝测试环境，生产资源不可用" },
  { key: "srcOverride", label: "来源覆盖文件（后门）", hint: "内容正确时来源按文件配置" },
  { key: "noIdentity", label: "没有测试环境身份", hint: "有测试环境但当前账号无身份；测试被拦" },
  { key: "credExpired", label: "测试环境凭据过期", hint: "测试提示刷新凭据后重试" },
  { key: "envApiError", label: "环境信息接口失败", hint: "警示条告知；来源保持当前判定" },
]

export function ScenarioDock() {
  const scenario = useEnvScenario()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  const active = SCENARIOS.filter((s) => scenario[s.key]).length

  return (
    <div ref={root} className="fixed right-5 bottom-5 z-[90] flex flex-col items-end gap-2">
      {open && (
        <div className="w-[300px] rounded-xl border border-[var(--border-weak-base)] bg-background-white p-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
          <div className="mb-2.5 text-12-medium text-text-weak">演示场景（点击切换，界面与各口径随 PRD 判定表联动）</div>
          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map((s) => {
              const on = scenario[s.key]
              return (
                <button
                  key={s.key}
                  type="button"
                  title={s.hint}
                  onClick={() => scenario.toggle(s.key)}
                  className={cx(
                    "cursor-pointer rounded-lg border px-2.5 py-1 text-12-regular transition-colors",
                    on ? "border-[#5B5FFF] bg-[#F0F1FF] text-[#3A3FD6]" : "border-[var(--border-weak-base)] bg-background-white text-text-base hover:border-[#C7CAFF]",
                  )}
                >
                  {on && <Icon name="check-small" size="small" className="mr-0.5 size-3 inline [--icon-fill:currentColor]" />}
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <button
        type="button"
        aria-label="演示场景"
        title="演示场景"
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "relative flex size-10 cursor-pointer items-center justify-center rounded-full border border-[var(--border-weak-base)] bg-background-white text-text-base shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition-colors hover:border-[#C7CAFF]",
          open && "border-[#5B5FFF] text-[#3A3FD6]",
        )}
      >
        <Icon name="test-flask" size="small" />
        {active > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#5B5FFF] text-[10px] font-medium text-white">{active}</span>
        )}
      </button>
    </div>
  )
}

import type { Locale } from "@/i18n"
import type { Skill } from "@/mock/fixtures/dev"
import { VALIDATION_GROUPS } from "@/mock/fixtures/skill-validation.gen"

export interface ValidationRule {
  /** 稳定的英文规则 id，「去修复」的提示词模板按它匹配 */
  id: string
  name: string
  severity: "block" | "warn"
  desc: string
  status: "ok" | "fail" | "warn"
  /** 未通过的原因（校验脚本的原始输出，固定英文） */
  msg?: string
}

export interface ValidationGroup {
  id: string
  label: string
  rules: ValidationRule[]
}

/**
 * 预置的未通过项：技能 id → 规则英文名 → 原因。没列出的规则一律通过。
 * 规则清单本身同步自线上的校验脚本（6 组 41 条），这里只决定哪几条不过。
 */
const PRESET_FAILURES: Record<string, Record<string, string>> = {
  sk_leave: {
    "Referenced file exists": "references/leave-policy.md is referenced in SKILL.md but does not exist",
    "High-risk operation confirmation": "category=action but no confirmation step found before submitting the leave request",
    "description length limit": "description is 548 characters, exceeds 512",
  },
  sk_ar: { "Body token limit": "estimated 5,640 tokens, exceeds the recommended 5,000" },
  sk_supplier: { "MCP skill allowed-tools required": "manifest declares MCP tool supplier_score_query but allowed-tools is empty" },
}

/** 生成某个技能的校验报告（对应线上的 validation-report.json） */
export function validationOf(skill: Skill, locale: Locale): ValidationGroup[] {
  const failures = PRESET_FAILURES[skill.id] ?? {}
  return VALIDATION_GROUPS.map((group) => ({
    id: group.id,
    label: group.label[locale],
    rules: group.rules.map((rule) => {
      const msg = failures[rule.name.en]
      return {
        id: rule.name.en,
        name: rule.name[locale],
        severity: rule.severity,
        desc: rule.desc[locale],
        status: !msg ? "ok" : rule.severity === "block" ? "fail" : "warn",
        msg,
      }
    }),
  }))
}

export function summarize(groups: ValidationGroup[]) {
  const rules = groups.flatMap((x) => x.rules)
  const ok = rules.filter((x) => x.status === "ok").length
  const block = rules.filter((x) => x.status !== "ok" && x.severity === "block").length
  return { total: rules.length, ok, block, warn: rules.length - ok - block, fail: rules.length - ok, allPass: ok === rules.length }
}

import type { EvalCheck } from "@/services/evaluation"

export function CheckTypeIcon({ kind }: { kind: NonNullable<EvalCheck["kind"]> }) {
  return <svg className="eval-check-type-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === "natural" ? <><path d="M3 2.5h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6l-3.5 2v-2H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" /><path d="M5 5.5h6M5 8h4" /></> : kind === "keyword" ? <><path d="m1.5 12 3.25-8 3.25 8M2.5 9.5H7M13.5 8.5c0-2-4-2-4 0M13.5 9.5h-2a1.5 1.5 0 0 0 0 3c1.1 0 2-.7 2-1.5M13.5 8.5v4" /></> : kind === "regex" ? <><circle cx="3" cy="12" r=".7" fill="currentColor" stroke="none" /><path d="M10 3v8M6.5 5l7 4M6.5 9l7-4" /></> : <><path d="M9.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5l-3.5-3.5ZM9.5 1.5V5H13" /><path d="M5.5 8h5M5.5 10.5h5" /></>}
  </svg>
}

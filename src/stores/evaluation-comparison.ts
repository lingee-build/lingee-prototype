import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * 报告对比范围与基线的本地持久化状态（按评测对象隔离）。
 * selections[objectId] 为 null/undefined 表示“全部已完成”；数组表示自选范围。
 */
interface ComparisonState {
  selections: Record<string, string[] | null | undefined>
  baselines: Record<string, string | undefined>
  setSelection: (objectId: string, ids: string[] | null) => void
  setBaseline: (objectId: string, runId?: string) => void
}

export const useEvaluationComparison = create<ComparisonState>()(
  persist(
    (set) => ({
      selections: {},
      baselines: {},
      setSelection: (objectId, ids) => set(s => ({ selections: { ...s.selections, [objectId]: ids } })),
      setBaseline: (objectId, runId) => set(s => ({ baselines: { ...s.baselines, [objectId]: runId } })),
    }),
    {
      name: "lingee.evaluation-comparison.v1",
      partialize: ({ selections, baselines }) => ({ selections, baselines }),
    },
  ),
)

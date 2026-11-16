import { create } from "zustand"

export type AgentMode = "build" | "spec" | "quest"

interface PromptState {
  mode: AgentMode
  modelId: string
  /** 外部（推荐卡片、技能入口、开发页的「编辑」）写入输入框的草稿；seq 变化时编辑器才会重新灌入。sessionId 为空表示给新任务页的输入框 */
  draft: { text: string; seq: number; sessionId?: string }
  /** 已被输入框取走的草稿序号，避免输入框重新挂载时把旧草稿再灌一遍 */
  consumed: number
  setMode: (mode: AgentMode) => void
  toggleMode: (mode: "spec" | "quest") => void
  setModel: (modelId: string) => void
  setDraft: (text: string, sessionId?: string) => void
  /** 取走发给自己（新任务页或指定会话）且尚未消费的草稿；没有则返回 undefined */
  takeDraft: (sessionId?: string) => string | undefined
}

/** 输入框相关的会话外状态：模式（Build/Spec/目标）、当前模型、待灌入的草稿 */
export const usePrompt = create<PromptState>((set, get) => ({
  mode: "build",
  modelId: "lingee-deep",
  draft: { text: "", seq: 0 },
  consumed: 0,
  setMode: (mode) => set({ mode }),
  // 互斥：再次选择当前模式则回到 build
  toggleMode: (mode) => set((s) => ({ mode: s.mode === mode ? "build" : mode })),
  setModel: (modelId) => set({ modelId }),
  setDraft: (text, sessionId) => set((s) => ({ draft: { text, seq: s.draft.seq + 1, sessionId } })),
  takeDraft: (sessionId) => {
    const { draft, consumed } = get()
    if (draft.seq === consumed || draft.sessionId !== sessionId) return undefined
    set({ consumed: draft.seq })
    return draft.text
  },
}))

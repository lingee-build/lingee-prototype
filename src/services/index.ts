import { db } from "@/mock/db"
import { latency } from "@/mock/latency"
import { currentDisplayName, useAuth } from "@/stores/auth"

export * from "./project"
export * from "./session"

/** 当前用户：姓名和账号跟着登录人走，租户沿用假数据 */
export const userService = {
  current: () => {
    const account = useAuth.getState().account
    return latency(account ? { ...db.user, userId: account, displayName: currentDisplayName() } : db.user)
  },
}
export const modelService = { list: () => latency(db.models) }
export * from "./dev"
export * from "./console-scope"
export * from "./workflow"
export * from "./file"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { accounts, PASSWORD } from "@/mock/fixtures/accounts"

interface AuthState {
  /** 已登录的账号；undefined 表示未登录 */
  account?: string
  /** 账号或密码不对时返回 false */
  login: (account: string, password: string) => boolean
  logout: () => void
}

/** 登录状态，持久化到 localStorage：刷新页面不用重新登录 */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      login(account, password) {
        const found = accounts.find((x) => x.account === account.trim().toLowerCase())
        if (!found || password !== PASSWORD) return false
        set({ account: found.account })
        return true
      },
      logout: () => set({ account: undefined }),
    }),
    { name: "lingee-prototype.auth" },
  ),
)

/** 当前登录人的姓名；未登录时为空 */
export const currentDisplayName = () => accounts.find((x) => x.account === useAuth.getState().account)?.displayName ?? ""

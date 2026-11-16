import { useState, type FormEvent } from "react"
import { Navigate, useLocation } from "react-router"
import { BrandButton, Input } from "@/ui"
import { useT } from "@/i18n"
import { publicUrl } from "@/lib/public-url"
import { useAuth } from "@/stores/auth"

/** 登录页：账号是姓名全拼。登录成功后回到原来要去的地址 */
export function Component() {
  const t = useT()
  const location = useLocation()
  const { account: current, login } = useAuth()
  const [account, setAccount] = useState("")
  const [password, setPassword] = useState("")
  const [failed, setFailed] = useState(false)

  if (current) return <Navigate to={(location.state as { from?: string } | null)?.from || "/"} replace />

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setFailed(!login(account, password))
  }
  const edit = (set: (value: string) => void) => (value: string) => {
    set(value)
    setFailed(false)
  }

  return (
    <div className="size-full flex items-center justify-center bg-background-page px-6">
      <form onSubmit={submit} className="w-full max-w-[360px] flex flex-col gap-5 [&_input]:select-text">
        <div className="flex flex-col items-center gap-4 pb-3">
          <img src={publicUrl("/lingee-icon-96.png")} alt="" className="size-12" />
          <h1 className="text-[20px] font-[600] leading-[28px] text-text-strong">{t("proto.login.title")}</h1>
        </div>
        <Input
          label={t("proto.login.account")}
          name="username"
          autoComplete="username"
          autoFocus
          value={account}
          onChange={edit(setAccount)}
          placeholder={t("proto.login.accountPlaceholder")}
        />
        <Input
          label={t("proto.login.password")}
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={edit(setPassword)}
          placeholder={t("proto.login.passwordPlaceholder")}
          error={failed ? t("proto.login.error") : undefined}
        />
        <BrandButton type="submit" variant="primary" size="large" className="mt-2 w-full justify-center" disabled={!account.trim() || !password}>
          {t("proto.login.submit")}
        </BrandButton>
      </form>
    </div>
  )
}

import { useId } from "react"
import { useT } from "@/i18n"

/** 文件区的空状态（没有文件 / 还没打开任何文件） */
export function EmptyFiles() {
  const t = useT()
  const id = useId()
  return (
    <div className="flex flex-col items-center" style={{ gap: 8 }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="47" height="47" viewBox="0 0 47 47" fill="none">
        <path
          d="M30.3333 14C31.622 14 32.6667 15.0447 32.6667 16.3333C32.6667 17.622 31.622 18.6667 30.3333 18.6667H16.3333C15.0447 18.6667 14 17.622 14 16.3333C14 15.0447 15.0447 14 16.3333 14H30.3333Z"
          fill={`url(#${id})`}
          fillOpacity="0.64"
        />
        <rect x="2.33" y="2.33" width="42" height="42" rx="7" stroke={`url(#${id})`} strokeOpacity="0.64" strokeWidth="4.67" />
        <defs>
          <linearGradient id={id} x1="23.3333" y1="0" x2="23.3333" y2="46.6667" gradientUnits="userSpaceOnUse">
            <stop stopOpacity="0.28" />
            <stop offset="1" stopOpacity="0.12" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-center text-[16px] font-normal leading-6 text-[var(--neutral-400,rgba(0,0,0,0.28))]">{t("session.files.empty")}</span>
    </div>
  )
}

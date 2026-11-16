import { useLocaleStore, useT } from "@/i18n"

/** 新任务页的标语（中文用宋体大字，英文用系统无衬线） */
export function NewSessionView() {
  const t = useT()
  const zh = useLocaleStore((s) => s.locale) === "zh"
  return (
    <div className="w-full">
      <div className="w-full px-6 md:px-0 md:max-w-[710px] md:mx-auto">
        <div className="flex flex-col items-start w-full">
          <div className="flex items-center mb-6 w-full min-w-0">
            <h1
              className="text-[var(--neutral-700)] text-[32px] leading-[var(--line-height-snug)] w-full"
              style={{
                fontFamily: zh ? '"Songti SC", SimSun, STSong, serif' : "system-ui, sans-serif",
                fontWeight: zh ? 700 : 400,
                fontSize: zh ? 40 : 28,
                lineHeight: 1,
                color: "var(--neutral-800)",
                letterSpacing: 0,
              }}
            >
              {t("kcode.home.tagline.text")}
            </h1>
          </div>
        </div>
      </div>
    </div>
  )
}

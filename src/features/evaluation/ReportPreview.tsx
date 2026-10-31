import { useEffect, useState } from "react"

/** A real document URL keeps fragment links inside the report, not the parent app. */
export function ReportPreview({ html }: { html: string }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const next = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }))
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [html])
  return <iframe className="eval-report-document" title="评测报告预览" sandbox="allow-same-origin" src={url} />
}

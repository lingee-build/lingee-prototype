export const reportAccent = "#485CFB"
export const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
export const paragraph = (label: string, text: string) => `<div class="field" data-report-key="field-${escape(label)}"><h4>${escape(label)}</h4><p>${escape(text || "未记录")}</p></div>`

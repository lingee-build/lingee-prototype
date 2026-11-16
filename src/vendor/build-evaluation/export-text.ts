const credentialKey = /^(?:authorization|proxy-authorization|cookie|set-cookie|password|passwd|secret|(?:access|refresh|session)[_-]?token|api[_-]?key|client[_-]?secret|token)$/i

export function exportText(value: string) {
  return value
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[已脱敏]")
    .replace(/\b(Bearer|Basic)\s+[a-z\d+/=_.-]+/gi, "$1 [已脱敏]")
    .replace(/(["']?(?:password|passwd|authorization|cookie|secret|api[_-]?key|(?:access|refresh|session)[_-]?token|token)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s&,;}]+)/gi, '$1"[已脱敏]"')
    .replace(/(?:[A-Za-z]:\\(?:Users|Documents and Settings)\\|\/(?:Users|home|private\/var|private\/tmp|tmp|var\/folders)\/)[^\s"'<>]+/gi,"[本地路径]")
}

export function exportValue(value: unknown): unknown {
  if (typeof value === "string") return exportText(value)
  if (Array.isArray(value)) return value.map(exportValue)
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) =>
      [key, credentialKey.test(key) ? "[已脱敏]" : exportValue(item)]))
  return value
}

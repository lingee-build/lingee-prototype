import { hasPlaceholders, renderPlaceholders, type PlaceholderData } from "./placeholders"

type Criterion = { description?: string; values?: string[]; pattern?: string; path?: string }
type Turn = { input: string; criteria: Criterion[]; sourceFields?: Record<string, string> }
type Content = { turns: Turn[]; criteria: Criterion[] }

export function previewCase<T extends Content>(content: T, data: PlaceholderData) {
  const expectedErrors: string[] = []
  const expected = (text: string) => {
    const rendered = renderPlaceholders(text, { mode: "expected", data })
    expectedErrors.push(...rendered.errors)
    return rendered.value
  }
  const criteria = <C extends Criterion>(item: C): C => {
    if (item.description !== undefined) return { ...item, description: expected(item.description) }
    if (item.values !== undefined) return { ...item, values: item.values.map(expected) }
    if (item.pattern !== undefined) return { ...item, pattern: expected(item.pattern) }
    if (item.path !== undefined) return { ...item, path: expected(item.path) }
    return item
  }
  const resolved: T = { ...content, turns: content.turns.map(turn => ({ ...turn })) }
  resolved.criteria = content.criteria.map(criteria)
  const caseErrors = expectedErrors.splice(0)
  const turns = content.turns.map((turn, index) => {
    const input = renderPlaceholders(turn.input, { mode: "preview", data })
    resolved.turns[index].criteria = resolved.turns[index].criteria.map(criteria)
    if (turn.sourceFields) resolved.turns[index].sourceFields = Object.fromEntries(
      Object.entries(turn.sourceFields).map(([key, value]) => [key, /^(session|turn):/.test(key) ? expected(value) : value]),
    )
    if (!input.dynamic.length && !input.errors.length && !input.value.trim()) input.errors.push("替换后的问题为空")
    return { ...input, expected: resolved.turns[index].criteria, sourceFields: resolved.turns[index].sourceFields,
      expectedErrors: expectedErrors.splice(0) }
  })
  return { resolved, turns, caseErrors, expected: resolved.criteria }
}

export function caseUsesPlaceholders(content: Content) {
  const fields = (criterion: Criterion) => [criterion.description, criterion.pattern, criterion.path, ...criterion.values ?? []]
  return [...content.criteria.flatMap(fields), ...content.turns.flatMap(turn => [
    turn.input, ...turn.criteria.flatMap(fields),
    ...Object.entries(turn.sourceFields ?? {}).filter(([key]) => /^(session|turn):/.test(key)).map(([, value]) => value),
  ])].some(value => typeof value === "string" && hasPlaceholders(value))
}

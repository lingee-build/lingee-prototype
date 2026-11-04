/** 只同步报告变化的节点，保留未变化的正文、键盘焦点、选区及用户展开状态。 */
export function updateReportDOM(target: Element, source: Element) {
  const document = target.ownerDocument
  const selection = document.getSelection()
  const anchor = selection?.anchorNode
  const focus = selection?.focusNode
  const anchorOffset = selection?.anchorOffset ?? 0
  const focusOffset = selection?.focusOffset ?? 0

  function key(node: Node): string {
    if (node.nodeType !== 1) return ""
    const element = node as Element
    return element.id || element.getAttribute("data-report-key") || ""
  }
  function compatible(a: Node, b: Node) {
    return a.nodeType === b.nodeType && a.nodeName === b.nodeName && key(a) === key(b)
  }
  function patch(current: Node, next: Node) {
    if (current.nodeType !== 1) {
      if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue
      return
    }
    const element = current as Element
    const incoming = next as Element
    // open 和导航添加的 tabindex 属于阅读状态，不随报告刷新重置。
    const retained = (name: string) => (name === "open" && element.tagName === "DETAILS")
      || (name === "tabindex" && element.getAttribute(name) === "-1" && !incoming.hasAttribute(name))
    for (const attribute of Array.from(element.attributes)) {
      if (!retained(attribute.name) && !incoming.hasAttribute(attribute.name)) element.removeAttribute(attribute.name)
    }
    for (const attribute of Array.from(incoming.attributes)) {
      if (!retained(attribute.name) && element.getAttribute(attribute.name) !== attribute.value) element.setAttribute(attribute.name, attribute.value)
    }
    children(element, incoming)
  }
  function children(current: Element, next: Element) {
    let cursor = current.firstChild
    for (const incoming of Array.from(next.childNodes)) {
      let match = cursor
      while (match && !compatible(match, incoming)) match = match.nextSibling
      if (!match) {
        current.insertBefore(document.importNode(incoming, true), cursor)
        continue
      }
      // 删除过期的兄弟节点，而非移动仍在使用的节点，避免焦点／选区失效。
      while (cursor && cursor !== match) {
        const removed = cursor
        cursor = cursor.nextSibling
        current.removeChild(removed)
      }
      patch(match, incoming)
      cursor = match.nextSibling
    }
    while (cursor) {
      const removed = cursor
      cursor = cursor.nextSibling
      current.removeChild(removed)
    }
  }
  children(target, source)
  // 文本节点确有更新时，浏览器会重置 offset；仅在原节点仍存在时恢复位置。
  if (selection && anchor?.isConnected && focus?.isConnected && target.contains(anchor) && target.contains(focus)) {
    const limit = (node: Node, offset: number) => Math.min(offset, node.nodeType === 3 ? node.textContent?.length ?? 0 : node.childNodes.length)
    const a = limit(anchor, anchorOffset), f = limit(focus, focusOffset)
    if (selection.anchorNode !== anchor || selection.focusNode !== focus || selection.anchorOffset !== a || selection.focusOffset !== f) {
      selection.setBaseAndExtent(anchor, a, focus, f)
    }
  }
}

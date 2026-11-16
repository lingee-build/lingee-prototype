export interface TreeNode {
  name: string
  path: string
  type: "file" | "directory"
  children: TreeNode[]
}

/** 把扁平的相对路径列表组装成树：目录在前、文件在后，同类按名称排序 */
export function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", type: "directory", children: [] }
  paths.forEach((path) => {
    path.split("/").reduce((parent, name, index, parts) => {
      const nodePath = parts.slice(0, index + 1).join("/")
      const found = parent.children.find((x) => x.path === nodePath)
      if (found) return found
      const node: TreeNode = { name, path: nodePath, type: index === parts.length - 1 ? "file" : "directory", children: [] }
      parent.children.push(node)
      return node
    }, root)
  })
  const sort = (nodes: TreeNode[]): TreeNode[] =>
    [...nodes]
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1))
      .map((node) => ({ ...node, children: sort(node.children) }))
  return sort(root.children)
}

/** 筛选：保留名称命中的文件，以及含有命中文件的目录 */
export function filterTree(nodes: TreeNode[], keyword: string): TreeNode[] {
  const query = keyword.trim().toLowerCase()
  if (!query) return nodes
  return nodes.flatMap((node) => {
    if (node.type === "file") return node.name.toLowerCase().includes(query) ? [node] : []
    const children = filterTree(node.children, query)
    return children.length > 0 ? [{ ...node, children }] : []
  })
}

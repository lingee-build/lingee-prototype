import type { KnowledgeCategory } from "@/mock/fixtures/knowledge"

export type FolderState = "full" | "part" | "none"

/** 把目录树拍平成索引：每个目录的子树 id（含自身）、祖先 id、从根到它的路径 */
export function indexTree(tree: KnowledgeCategory[]) {
  const subtree = new Map<string, string[]>()
  const ancestors = new Map<string, string[]>()
  const paths = new Map<string, string>()
  const byId = new Map<string, KnowledgeCategory>()
  const walk = (dir: KnowledgeCategory, parents: string[], prefix: string): string[] => {
    byId.set(dir.id, dir)
    ancestors.set(dir.id, parents)
    paths.set(dir.id, prefix ? `${prefix}/${dir.name}` : dir.name)
    const ids = [dir.id, ...dir.children.flatMap((child) => walk(child, [...parents, dir.id], paths.get(dir.id) ?? dir.name))]
    subtree.set(dir.id, ids)
    return ids
  }
  tree.forEach((dir) => walk(dir, [], ""))
  return { subtree, ancestors, paths, byId }
}

export type TreeIndex = ReturnType<typeof indexTree>

/** 目录被某个已关联的祖先覆盖（关联父目录即包含全部子目录） */
export const isCovered = (id: string, bound: Set<string>, index: TreeIndex) => (index.ancestors.get(id) ?? []).some((x) => bound.has(x))

/** 勾选态：自身或祖先已关联 = 全选；只有部分子目录关联 = 半选 */
export function folderState(id: string, bound: Set<string>, index: TreeIndex): FolderState {
  if (bound.has(id) || isCovered(id, bound, index)) return "full"
  return (index.subtree.get(id) ?? []).some((x) => bound.has(x)) ? "part" : "none"
}

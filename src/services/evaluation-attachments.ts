import type { EvalAttachment } from "./evaluation"
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("lingee-evaluation-attachments", 1)
    request.onupgradeneeded = () => request.result.createObjectStore("files")
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
export async function saveAttachment(file: File): Promise<EvalAttachment> {
  const db = await database()
  const id = crypto.randomUUID()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("files", "readwrite")
      tx.objectStore("files").put(file, id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    return { id, name: file.name, size: file.size, data: "" }
  } finally { db.close() }
}
export async function downloadAttachment(file: EvalAttachment) {
  let url = file.data
  if (!url) {
    const db = await database()
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        const request = db.transaction("files").objectStore("files").get(file.id)
        request.onsuccess = () => request.result ? resolve(request.result) : reject(new Error("附件不存在"))
        request.onerror = () => reject(request.error)
      })
      url = URL.createObjectURL(blob)
    } finally { db.close() }
  }
  const a = document.createElement("a"); a.href = url; a.download = file.name; a.click()
  if (!file.data) setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 一个事务清理已无其他评测引用的附件；失败时整个事务回滚。 */
export async function removeEvaluationAttachments(ids: string[]) {
  if (!ids.length) return
  const db = await database()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("files", "readwrite")
      for (const id of ids) tx.objectStore("files").delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}

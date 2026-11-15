import JSZip from "jszip"

const fileLimit = 20 * 1024 * 1024
const packageLimit = 100 * 1024 * 1024

// JSZip exposes internalStream at runtime but omits it from its TypeScript declarations.
type StreamingEntry = JSZip.JSZipObject & {
  internalStream(type: "uint8array"): {
    on(event: "data", listener: (chunk: Uint8Array) => void): void
    on(event: "error" | "end", listener: () => void): void
    pause(): void
    resume(): void
  }
}

export async function openEvaluationImport(file: File, message: (key: string) => string) {
  const name = file.name.toLowerCase()
  if (name.endsWith(".xlsx") && file.size <= fileLimit)
    return { workbook: file, attachments: async (_names: string[]) => [] as File[] }

  if (!name.endsWith(".zip") || file.size > packageLimit)
    throw new Error(message("请选择不超过 20 MB 的 Excel 或不超过 100 MB 的 ZIP。"))

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer())
  } catch {
    throw new Error(message("无法读取 ZIP，请检查压缩包是否损坏或加密。"))
  }

  if (Object.keys(zip.files).length > 1000)
    throw new Error(message("ZIP 内文件和目录不得超过 1000 项。"))

  const entries = Object.values(zip.files).filter(entry =>
    !entry.dir && !entry.name.split("/").some(part => part === "__MACOSX" || part.startsWith("._")),
  )
  const basename = (entry: JSZip.JSZipObject) => entry.name.split("/").at(-1)!
  const workbooks = entries.filter(entry => basename(entry).toLowerCase().endsWith(".xlsx"))
  if (workbooks.length !== 1) throw new Error(message("ZIP 内必须有且只有一份 .xlsx 用例表。"))

  let extracted = 0
  const read = (entry: JSZip.JSZipObject) => new Promise<File>((resolve, reject) => {
    const chunks: Uint8Array<ArrayBuffer>[] = []
    let size = 0
    const stream = (entry as StreamingEntry).internalStream("uint8array")
    stream.on("data", chunk => {
      size += chunk.byteLength
      extracted += chunk.byteLength
      if (size > fileLimit || extracted > packageLimit) {
        stream.pause()
        reject(new Error(message("ZIP 解压后单个文件不得超过 20 MB，总计不得超过 100 MB。")))
        return
      }
      chunks.push(new Uint8Array(chunk))
    })
    stream.on("error", () => reject(new Error(message("无法读取 ZIP，请检查压缩包是否损坏或加密。"))))
    stream.on("end", () => resolve(new File(chunks, basename(entry))))
    stream.resume()
  })

  const [entry] = workbooks
  const workbook = await read(entry)
  return {
    workbook,
    async attachments(names: string[]) {
      const wanted = new Set(names)
      const matches = entries.filter(item => item !== entry && wanted.has(basename(item)))
      if (new Set(matches.map(basename)).size !== matches.length)
        throw new Error(message("ZIP 内有同名引用附件，请保留其中一份。"))
      const files: File[] = []
      for (const item of matches) files.push(await read(item))
      return files
    },
  }
}

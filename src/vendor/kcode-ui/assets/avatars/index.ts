import avatar1 from "./avatar-1948756636.png"
import avatar2 from "./avatar-1948756637.png"
import avatar3 from "./avatar-1948756638.png"
import avatar4 from "./avatar-1948756659.png"
import avatar5 from "./avatar-1948756660.png"
import avatar6 from "./avatar-1948756665.png"
import avatar7 from "./avatar-1948756666.png"
import avatar8 from "./avatar-1948756667.png"
import avatar9 from "./avatar-1948756668.png"
import avatar10 from "./avatar-1948756675.png"
import avatar11 from "./avatar-1948756679.png"
import avatar12 from "./avatar-1948756680.png"
import avatar13 from "./avatar-1948756687.png"
import avatar14 from "./avatar-1948756690.png"
import avatar15 from "./avatar-1948756692.png"
import avatar16 from "./avatar-1948756704.png"
import avatar17 from "./avatar-1948756705.png"
import avatar18 from "./avatar-1948756715.png"
import avatar19 from "./avatar-1948756718.png"
import avatar20 from "./avatar-1948756719.png"

/** 子agent 卡片可用的头像素材集合 */
export const AVATARS = [
  avatar1,
  avatar2,
  avatar3,
  avatar4,
  avatar5,
  avatar6,
  avatar7,
  avatar8,
  avatar9,
  avatar10,
  avatar11,
  avatar12,
  avatar13,
  avatar14,
  avatar15,
  avatar16,
  avatar17,
  avatar18,
  avatar19,
  avatar20,
]

/**
 * 根据种子字符串确定性地从头像素材集合中选取一张，效果上表现为“随机”，
 * 但同一个种子（如子agent会话 id）在多次渲染/重新计算时始终得到同一张头像，避免闪烁跳变。
 */
export function pickAvatar(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  const index = Math.abs(hash) % AVATARS.length
  return AVATARS[index]
}

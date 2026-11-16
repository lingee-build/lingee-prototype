// 把旧版 Lingee 原型（应用开发原型/lingee）构建产物同步进本工程。
// 用法：npm run sync:legacy  [源工程目录]
// 源工程默认取 ../../应用开发原型/lingee，也可用第一个参数或 LEGACY_PROTOTYPE_DIR 覆盖。
// 产物是 viteSingleFile 打出的单个 index.html，拷贝到 public/legacy/ 下，
// 由 src/pages/dev/legacy/LegacyFrame.tsx 以 ?view=apps|collab 嵌入。
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, renameSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = resolve(
  process.argv[2] || process.env.LEGACY_PROTOTYPE_DIR || resolve(root, '../../应用开发原型/lingee'),
);
if (!existsSync(resolve(srcDir, 'package.json'))) {
  console.error(`源工程不存在：${srcDir}`);
  process.exit(1);
}

// 源工程的 node_modules 平时是指向 node_modules.nosync 的软链（规避 iCloud 同步），
// 但 macOS 禁止在 .nosync 目录里创建点开头的内容，vite 写 .vite-temp 会 EPERM，
// 构建期间临时换回真实目录，结束后恢复软链（与源工程 scripts/fix-nosync.mjs 的规则一致）。
const nm = resolve(srcDir, 'node_modules');
const nosync = resolve(srcDir, 'node_modules.nosync');
const isSymlink = (p) => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };
let swapped = false;
if (isSymlink(nm) && existsSync(nosync)) {
  unlinkSync(nm);
  renameSync(nosync, nm);
  swapped = true;
}
try {
  execFileSync('npm', ['run', 'build'], { cwd: srcDir, stdio: 'inherit' });
} finally {
  if (swapped) {
    renameSync(nm, nosync);
    symlinkSync('node_modules.nosync', nm);
  }
}

const outDir = resolve(root, 'public/legacy');
mkdirSync(outDir, { recursive: true });
copyFileSync(resolve(srcDir, 'dist/index.html'), resolve(outDir, 'index.html'));
console.log(`已同步旧版原型产物 → ${outDir}/index.html`);

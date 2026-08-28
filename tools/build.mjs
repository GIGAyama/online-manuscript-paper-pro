#!/usr/bin/env node
/**
 * ビルド — 原本（src/ と tools/）から、配信する生成物を作る。
 *
 * なぜビルドするのか:
 *   以前は React・ReactDOM・Babel・Tailwind をブラウザへ CDN から読み込み、
 *   2,400 行の JSX を「開くたびに」ブラウザの中で翻訳していた。
 *   学校のネットワークは unpkg.com / cdn.tailwindcss.com / cdnjs を塞いで
 *   いることがあり、1 本でも届かないと画面が白いまま何も出ない。
 *   @babel/standalone だけで約 3MB あった。
 *
 * 生成物（手で編集しない）:
 *   vendor/libs.js … react / react-dom / peerjs / diff-match-patch / sweetalert2
 *   css/app.css    … Tailwind が生成した CSS ＋ tools/extra.css
 *   js/app.js      … src/app.jsx をコンパイルした JS
 *
 * 原本（ここを直す）:
 *   src/app.jsx / tools/extra.css / tailwind.config.js / index.html
 *
 * ⚠️ 生成物をコミットしている。原本を直してビルドを走らせずに push すると、
 *    配信される画面だけが古いまま残る。tools/check-generated.mjs がそれを止める。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { transformSync } from '@babel/core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const kb = (s) => (Buffer.byteLength(s, 'utf8') / 1024).toFixed(1) + ' KB';
const BANNER = '/* 生成物。手で編集しない（npm run build で作り直す） */\n';

// ── ① vendor/libs.js：実行コードは自分側に持つ ──
const VENDOR = [
  ['react', 'node_modules/react/umd/react.production.min.js'],
  ['react-dom', 'node_modules/react-dom/umd/react-dom.production.min.js'],
  // 児童どうしで原稿を回すための P2P。仲介サーバー（PeerServer）だけは外にある
  ['peerjs', 'node_modules/peerjs/dist/peerjs.min.js'],
  ['sweetalert2', 'node_modules/sweetalert2/dist/sweetalert2.all.min.js'],
];
mkdirSync(join(ROOT, 'vendor'), { recursive: true });
let libs = BANNER;
for (const [name, rel] of VENDOR) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) throw new Error(`${name} が見つかりません: ${rel}（npm ci を実行してください）`);
  libs += `\n/* ${name} */\n` + readFileSync(p, 'utf8').replace(/\/\/#\s*sourceMappingURL=.*$/gm, '');
}
/* 添削の差分（diff_match_patch）。
   以前は cdnjs の 2012 年版を読んでいた。あちらは素の <script> 向けで、
   グローバルに diff_match_patch を置く。npm の diff-match-patch は CommonJS で、
   末尾が module.exports['diff_match_patch'] = … になっている。
   そのまま読むと module が無くて落ちるので、受け皿を用意して画面が使う名前へ移す。 */
libs +=
  '\n/* diff-match-patch（CommonJS を素の script 向けに包んでいる） */\n' +
  '(function () {\n  var module = { exports: {} }, exports = module.exports;\n' +
  readFileSync(join(ROOT, 'node_modules/diff-match-patch/index.js'), 'utf8') +
  '\n  window.diff_match_patch = module.exports.diff_match_patch;\n' +
  '  window.DIFF_DELETE = module.exports.DIFF_DELETE;\n' +
  '  window.DIFF_INSERT = module.exports.DIFF_INSERT;\n' +
  '  window.DIFF_EQUAL = module.exports.DIFF_EQUAL;\n})();\n';
writeFileSync(join(ROOT, 'vendor/libs.js'), libs);

// ── ② css/app.css：使うクラスだけを先に作る（ブラウザ内で CSS を生成しない） ──
const tmp = mkdtempSync(join(tmpdir(), 'omp-build-'));
const inCss = join(tmp, 'in.css');
const outCss = join(tmp, 'out.css');
writeFileSync(inCss, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
execFileSync(
  join(ROOT, 'node_modules/.bin/tailwindcss'),
  ['-c', join(ROOT, 'tailwind.config.js'), '-i', inCss, '-o', outCss, '--minify'],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);
const css = readFileSync(outCss, 'utf8') + '\n' + readFileSync(join(ROOT, 'tools/extra.css'), 'utf8');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(join(ROOT, 'css'), { recursive: true });
writeFileSync(join(ROOT, 'css/app.css'), BANNER + css);

// ── ③ js/app.js：JSX の翻訳はビルド時に 1 回だけ ──
const { code } = transformSync(readFileSync(join(ROOT, 'src/app.jsx'), 'utf8'), {
  filename: 'app.jsx',
  presets: [['@babel/preset-react', { runtime: 'classic' }]],
  comments: false,
  compact: false,
  babelrc: false,
  configFile: false,
});
mkdirSync(join(ROOT, 'js'), { recursive: true });
writeFileSync(join(ROOT, 'js/app.js'), BANNER + code);

console.log('ビルド完了');
console.log('  vendor/libs.js', kb(libs));
console.log('  css/app.css   ', kb(css));
console.log('  js/app.js     ', kb(code));

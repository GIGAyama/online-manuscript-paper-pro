#!/usr/bin/env node
/**
 * GIGA Standard v4 品質ゲート
 *
 * このリポジトリが「一度直した項目を、次の改修で静かに壊し戻していないか」を機械的に見張る。
 * 人間がレビューで気づけない類の後退（manifest の id を相対パスに戻す、
 * sw.js がキャッシュを全消しするコードに戻る、100vh 単独指定が復活する）を
 * CI で止めるのが目的なので、判定は「実際に効く形になっているか」で書く。
 *
 * 依存パッケージなしで動く（node scripts/check-project.mjs）。
 * 検査を緩めたいときはコードを消さず、quality.config.json の
 * securityExceptions に理由を書いて明示的に許可すること。
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'quality.config.json'), 'utf8'));
const allowed = new Set((cfg.securityExceptions || []).map((e) => e.rule));

const results = [];
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const has = (p) => existsSync(join(ROOT, p));
const sizeOf = (p) => statSync(join(ROOT, p)).size;
const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

function check(id, label, fn) {
  let ok = false;
  let detail = '';
  try {
    const r = fn();
    ok = r === true || (r && r.ok === true);
    detail = (r && r.detail) || '';
  } catch (e) {
    ok = false;
    detail = e.message;
  }
  results.push({ id, label, ok, detail, waived: !ok && allowed.has(id) });
}

// ---- A. 法務・配布 -------------------------------------------------------
check('license', 'LICENSE がある', () => has('LICENSE'));
check('gitignore', '.gitignore がある', () => has('.gitignore'));
check('dependabot', '.github/dependabot.yml がある', () => has('.github/dependabot.yml'));
check('docs', 'README.md と MANUAL.md が両方ある', () => has('README.md') && has('MANUAL.md'));

// ---- B/C. セキュリティ・堅牢性 -------------------------------------------
const html = read(cfg.entry);
const sw = read(cfg.serviceWorker);

check('no-localstorage-clear', 'localStorage.clear() を使っていない',
  () => !/localStorage\s*\.\s*clear\s*\(/.test(html));

check('no-wildcard-postmessage', "postMessage の宛先が '*' でない",
  () => !/postMessage\s*\([^)]*['"]\*['"]/.test(html));

check('no-hardcoded-secret', 'APIキーらしき文字列が直書きされていない', () => {
  // Google API キーは AIza で始まる39文字。ソースに現れたら即アウト。
  const hit = html.match(/AIza[0-9A-Za-z_-]{20,}/);
  return { ok: !hit, detail: hit ? '疑わしい文字列を検出' : '' };
});

// コメントは判定から外す。「localStorage には触れない」と説明文に書いただけで
// 違反扱いになると、正しい注意書きを消す方向に力が働いてしまう。
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

check('sw-no-localstorage', 'sw.js が localStorage に触れていない',
  () => !/localStorage/.test(stripComments(sw)));

check('sw-scoped-cache-delete', 'sw.js が自アプリ接頭辞のキャッシュだけを削除する', () => {
  if (!/caches\.keys\s*\(/.test(sw)) return { ok: true, detail: 'caches.keys() を使っていない' };
  // caches.keys() を使うなら、必ず接頭辞での絞り込みが同居していること。
  // これが無い＝同一オリジンの他アプリのキャッシュまで消している。
  return /startsWith\s*\(\s*CACHE_PREFIX/.test(sw);
});

check('pagehide-flush', 'pagehide で保存を確定している（Chromebook のタブ破棄対策）',
  () => /addEventListener\(\s*['"]pagehide['"]/.test(html));

check('csp-present', 'CSP が入っている',
  () => /Content-Security-Policy/i.test(html));

// ---- D. 表示 -------------------------------------------------------------
check('viewport-fit', 'viewport に viewport-fit=cover がある',
  () => /name=["']viewport["'][^>]*viewport-fit=cover/.test(html));

check('viewport-zoomable', '拡大が禁止されていない（user-scalable=no / maximum-scale が無い）', () => {
  const m = html.match(/<meta[^>]*name=["']viewport["'][^>]*>/);
  if (!m) return false;
  return !/user-scalable\s*=\s*no/.test(m[0]) && !/maximum-scale/.test(m[0]);
});

check('dvh', '100vh の単独使用がない（dvh のフォールバックとして書かれている）', () => {
  const lines = html.split('\n');
  const bad = [];
  lines.forEach((line, i) => {
    if (!/100vh/.test(line)) return;
    // 同じ行、または直後の行に dvh があればフォールバックとして正しい
    const near = line + '\n' + (lines[i + 1] || '');
    if (!/dvh/.test(near)) bad.push(i + 1);
  });
  return { ok: bad.length === 0, detail: bad.length ? `行 ${bad.join(', ')}` : '' };
});

check('safe-area', 'safe-area-inset を使っている',
  () => /safe-area-inset/.test(html));

check('visual-viewport', 'visualViewport でソフトキーボードに追従している',
  () => /visualViewport/.test(html));

check('fluid-type', 'clamp() による可変文字サイズがある',
  () => /clamp\(/.test(html));

check('reduced-motion', 'prefers-reduced-motion に対応している',
  () => /prefers-reduced-motion/.test(html));

check('touch-action', 'touch-action を指定している',
  () => /touch-action/.test(html));

check('tap-target', '44px 以上のタップ領域を指定している',
  () => /min-height:\s*44px/.test(html));

check('print-css', '印刷用CSSがある',
  () => /@media\s+print/.test(html));

check('canvas-dpr', 'Canvas を使う場合は devicePixelRatio 補正がある', () => {
  if (!/getContext\(\s*['"]2d['"]/.test(html)) return { ok: true, detail: 'Canvas 未使用' };
  return /devicePixelRatio/.test(html);
});

// ---- E. PWA --------------------------------------------------------------
const manifest = JSON.parse(read(cfg.manifest));

check('manifest-absolute-id', 'manifest の id/scope/start_url がリポジトリ名の絶対パス', () => {
  const want = `/${cfg.repoName}/`;
  const bad = [];
  for (const key of ['id', 'scope', 'start_url']) {
    const v = manifest[key];
    // id はマニフェストの置き場所ではなくオリジンを基準に解決される。
    // './' のままだと同一オリジンの他アプリと同じ識別子になり、取り違え事故が起きる。
    if (typeof v !== 'string' || !v.startsWith(want)) bad.push(`${key}=${v}`);
  }
  return { ok: bad.length === 0, detail: bad.join(' / ') };
});

check('manifest-icons', 'アイコン4種（any 192/512・maskable 192/512）が揃っている', () => {
  const need = ['192x192 any', '512x512 any', '192x192 maskable', '512x512 maskable'];
  const got = (manifest.icons || []).map((i) => `${i.sizes} ${i.purpose || 'any'}`);
  const missing = need.filter((n) => !got.includes(n));
  return { ok: missing.length === 0, detail: missing.join(' / ') };
});

check('apple-touch-icon', 'apple-touch-icon がある（iOS は maskable 非対応）',
  () => has(join(cfg.iconDir, 'apple-touch-icon.png')) && /apple-touch-icon/.test(html));

check('install-prompt-early', 'beforeinstallprompt を head の最上部で捕まえている', () => {
  const at = html.indexOf('beforeinstallprompt');
  if (at < 0) return { ok: false, detail: '捕捉していない' };
  // 外部スクリプト（CDN）の読み込みより前にあること。
  // 後ろだと通信が遅い端末で合図を取りこぼし、インストールボタンが出なくなる。
  const firstScript = html.search(/<script[^>]+src=/);
  return {
    ok: firstScript < 0 || at < firstScript,
    detail: firstScript >= 0 && at > firstScript ? '外部スクリプトより後ろにある' : '',
  };
});

check('install-button', 'アプリ内にインストールボタンがある',
  () => /pwa-installable/.test(html) && /__deferredInstallPrompt/.test(html));

check('update-toast', '更新の通知を出している',
  () => /あたらしい\s*バージョン/.test(html));

check('sw-skip-waiting-message', 'SKIP_WAITING メッセージで更新を適用できる',
  () => /SKIP_WAITING/.test(sw) && /SKIP_WAITING/.test(html));

check('offline-page', 'offline.html があり、sw.js が先読みしている',
  () => has(cfg.offlinePage) && sw.includes('offline.html'));

check('app-version', 'sw.js に APP_VERSION がある',
  () => /APP_VERSION\s*=\s*['"][^'"]+['"]/.test(sw));

check('ios-install-doc', 'MANUAL に iOS のホーム画面追加手順がある',
  () => /ホーム画面に追加/.test(read('MANUAL.md')));

// ---- F. 性能 -------------------------------------------------------------
check('entry-size', `${cfg.entry} が ${cfg.limits.maxFileLines}行 / ${kb(cfg.limits.maxFileBytes)} 以内`, () => {
  const lines = html.split('\n').length;
  const bytes = sizeOf(cfg.entry);
  return {
    ok: lines <= cfg.limits.maxFileLines && bytes <= cfg.limits.maxFileBytes,
    detail: `${lines}行 / ${kb(bytes)}`,
  };
});

check('icon-size', 'アイコン画像が目安のサイズ以内', () => {
  const bad = [];
  const icon512 = join(cfg.iconDir, 'icon-512.png');
  const maskable512 = join(cfg.iconDir, 'maskable-512.png');
  for (const p of [icon512, maskable512]) {
    if (has(p) && sizeOf(p) > cfg.limits.maxIcon512Bytes) bad.push(`${p} ${kb(sizeOf(p))}`);
  }
  if (has('favicon.png') && sizeOf('favicon.png') > cfg.limits.maxFaviconBytes) {
    bad.push(`favicon.png ${kb(sizeOf('favicon.png'))}`);
  }
  return { ok: bad.length === 0, detail: bad.join(' / ') };
});

check('image-size', `画像が ${kb(cfg.limits.maxImageBytes)} 以内`, () => {
  const bad = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = join(dir, name.name);
      if (name.isDirectory()) {
        if (['.git', 'node_modules', '.assets-original'].includes(name.name)) continue;
        walk(rel);
      } else if (/\.(png|jpe?g|gif|webp)$/i.test(name.name)) {
        if (sizeOf(rel) > cfg.limits.maxImageBytes) bad.push(`${rel} ${kb(sizeOf(rel))}`);
      }
    }
  };
  walk('.');
  return { ok: bad.length === 0, detail: bad.join(' / ') };
});

check('initial-js-budget', '初回JSが 300KB 以内', () => {
  // 外部CDNを数える。ブラウザ上でBabel変換している間は必ず超える。
  const cdn = [...html.matchAll(/<script[^>]+src=["'](https?:\/\/[^"']+)["']/g)].map((m) => m[1]);
  return { ok: cdn.length === 0, detail: cdn.length ? `外部スクリプト ${cdn.length} 本` : '' };
});

// ---- 出力 ---------------------------------------------------------------
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - [...s].reduce((a, c) => a + (c.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)));
let failed = 0;
let waived = 0;

console.log(`\n品質ゲート: ${cfg.appName}\n${'='.repeat(64)}`);
for (const r of results) {
  let mark;
  if (r.ok) mark = '[32m OK [0m';
  else if (r.waived) { mark = '[33m 免除[0m'; waived++; }
  else { mark = '[31m NG [0m'; failed++; }
  console.log(`${mark} ${pad(r.label, 52)}${r.detail}`);
}

if (waived) {
  console.log(`\n免除した項目（quality.config.json に理由を明記済み）:`);
  for (const e of cfg.securityExceptions) {
    if (results.some((r) => r.id === e.rule && r.waived)) console.log(`  - ${e.rule}: ${e.reason}`);
  }
}

console.log(`${'='.repeat(64)}`);
console.log(`合格 ${results.filter((r) => r.ok).length} / 免除 ${waived} / 不合格 ${failed}\n`);
process.exit(failed > 0 ? 1 : 0);

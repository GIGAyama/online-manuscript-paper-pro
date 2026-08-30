/* オンライン原稿用紙 Pro - Service Worker */
/*
 * 【最重要】activate では自アプリ以外のキャッシュを削除しない。
 *   旧配信元の gigayama.github.io は数十個のアプリが同一オリジンを共有していた。
 *   同居する配置に戻したときに他アプリを巻き込まないよう、
 *   CACHE_PREFIX で始まるキャッシュだけを掃除する。
 *   以前はここで caches.keys() の結果を全部消していた。そのため
 *   このアプリを開くたびに、同じ端末に入っている他の GIGA アプリの
 *   キャッシュまで巻き添えで消え、それらがオフラインで起動しなくなっていた。
 *
 * この Service Worker は localStorage を一切さわらない。
 *   児童の作文（genko_pro_*）にも、アプリ間で共有する study.records.v1 にも触れない。
 */
const CACHE_PREFIX = 'genko-pro-';
// APP_VERSION は手で上げない。node tools/build-sw.mjs が先読み対象の中身から自動で決める
const APP_VERSION = 'v2dda5dac'; /* __APP_VERSION__ */
const CACHE_NAME = CACHE_PREFIX + APP_VERSION;

const APP_SHELL = [
  './',
  './index.html',
  // 利用規約・プライバシーの行き先を出す部品。並べておかないと、圏外で開いた
  // ときだけリンクが 1 本も出ない（行き先そのものは開けなくても、どこにあるかは
  // 見えているほうがいい）。
  './web/giga-app-links.js',
  './offline.html',
  './manifest.webmanifest',
  './favicon.png',
  // 自己ホストにしたライブラリ・アイコン・書体（生成物）。
  // ⚠️ ここから漏れると「オフラインでは素の HTML が半分だけ動く」になり、
  //    しかも画面は出るので気づけない。
  './vendor/libs.js',
  './vendor/icons.css',
  './css/app.css',
  './css/fonts.css',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

// 実行時キャッシュを許可する外部ホスト。
//
// ⚠️ 2026-08-28、ライブラリ・アイコン・書体をすべて自己ホストにしたので、
//    ここに並べる CDN は 1 つも要らなくなった。空のままにしておくこと。
//    書き足すということは、また外から取りはじめたということである。
//
//    書体そのもの（fonts/*.woff2）は先読みに入れていない。入れると先読みが
//    重くなるが、画面が出れば必ず取りにいくので、その 1 回で下の実行時
//    キャッシュに入る。2 回目からはオフラインでも同じように出る。
const RUNTIME_CACHE_HOSTS = [];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // cache.addAll は1本でも失敗すると全体が巻き戻り、
    // オフライン起動そのものができなくなる。1本ずつ入れて取りこぼしを許容する。
    await Promise.all(APP_SHELL.map((url) =>
      cache.add(new Request(url, { cache: 'reload' }))
           .catch((err) => console.warn('[sw] precache skipped', url, err))
    ));
    // ここで skipWaiting() は呼ばない。
    // 新しい版はいったん待機させ、画面側のトーストで
    // 「さいしんに する」を児童が押したときに初めて入れ替える。
    // 黙って入れ替えると、作文を書いている最中に中身が変わって驚かせてしまう。
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        // ← 自アプリ接頭辞のものだけを削除する。ここを外すと
        //    同一オリジンの他アプリを巻き添えにする。
        .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // PeerJSシグナリングやGemini APIなどの動的通信はキャッシュしない
  const isSameOrigin = url.origin === self.location.origin;
  const isRuntimeHost = RUNTIME_CACHE_HOSTS.includes(url.hostname);
  if (!isSameOrigin && !isRuntimeHost) return;

  // ページ本体はネットワーク優先（更新を確実に取得）、オフライン時はキャッシュへフォールバック
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // エラーページ(404/5xx)をオフライン用に焼き込まないようokのときだけ保存する
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        // index.html すら入っていない（初回起動が圏外だった等）ときに
        // ブラウザ既定の白い恐竜画面を見せないよう offline.html を出す。
        .catch(async () =>
          (await caches.match('./index.html')) || (await caches.match('./offline.html'))
        )
    );
    return;
  }

  // 静的アセットはキャッシュ優先 + バックグラウンド更新（stale-while-revalidate）
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && (response.ok || response.type === 'opaque')) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// 画面側で「さいしんに する」が押されたときだけ待機を解除する
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

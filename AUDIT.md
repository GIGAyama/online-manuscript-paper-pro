# ✅ GIGA Standard v4 監査：オンライン原稿用紙 Pro

- 対象リポジトリ：`GIGAyama/online-manuscript-paper-pro`
- 監査日：2026-08-08
- 監査時点のコミット：`e692f88`
- **アプリの型：A型（単一 HTML 完結）**
  `vite.config.*` なし／`.gs` なし／`manifest.json`（MV3）なし。
  ただし React + Babel standalone を CDN から読み、ブラウザ内で JSX を変換している
  （＝実質「ビルドのない B 型」。§H に別掲）。
- ファイル構成：`index.html`（2,219 行 / 151.8KB）、`sw.js`、`manifest.webmanifest`、
  `icons/`、`favicon.png`、`README.md`、`MANUAL.md`、`.github/workflows/deploy-pages.yml`

判定の凡例：✅ 適合 ／ ⚠️ 部分的 ／ ❌ 不適合 ／ — 非該当

---

## A. 法務・配布

| # | 項目 | 判定 | 実測 | 対応 |
|---|---|:--:|---|:--:|
| A1 | LICENSE 実ファイル | ❌ | ファイルが存在しない。README には「MIT」と記載があるだけ | P0 |
| A2 | .gitignore | ❌ | 存在しない | P0 |
| A3 | dependabot.yml | ❌ | 存在しない | P0 |
| A4 | README.md / MANUAL.md 両方 | ✅ | 両方あり。MANUAL に「9. こまったときは」章あり | — |

補足：`git ls-files` に `.clasp.json` / `.env` は**含まれていない**（秘密ファイルのコミットなし）。

---

## B. セキュリティ

| # | 項目 | 判定 | 実測 | 対応 |
|---|---|:--:|---|:--:|
| B1 | CSP（connect-src が最小） | ❌ | `Content-Security-Policy` の記述 **0 件** | P1（要検証・§停止条件参照） |
| B2 | 秘密情報・IDの直書きなし | ✅ | Gemini API キーは `localStorage['gemini_api_key']`、先生用設定画面から入力（index.html:216, 1674-1719）。直書きなし | — |
| B3 | OAuthスコープ最小 | — | GAS を使わないため非該当 | — |
| B4 | postMessage の宛先が `*` でない | ✅ | `postMessage(..., '*')` の該当 0 件 | — |
| B5 | サーバー側5段ガード | — | サーバーを持たない P2P 構成のため非該当 | — |

補足（報告のみ・今回は変更しない）：
P2P（PeerJS）で受信したデータは `normalizeDraft()` で必ず整形してから使っており、
「受信データは壊れている前提」という原則自体は守られている。
ただし PIN コードは Part I §4 の言う「宛先であって認証ではない」に該当するため、
**児童が他人の作文を読めない保証はアプリ構造に依存**する。README への明記を P3 で提案。

---

## C. 堅牢性

| # | 項目 | 判定 | 実測 | 対応 |
|---|---|:--:|---|:--:|
| C1 | LockService + try/finally | — | GAS 非該当 | — |
| C2 | 自動復旧 | ✅ | `safeParse` / `normalizeDraft` / `normalizeSettings` で壊れた localStorage から復帰する（index.html:104-135） | — |
| C3 | pagehide で記録確定 | ⚠️ | `pagehide` の該当 **0 件**。ただし `activeDraft` は変更のたび即 `localStorage` へ書くため実害は小さい（index.html:1792）。Chromebook のタブ破棄対策として明示的な確定を追加する | P1 |
| C4 | 通信失敗時のリトライと明示 | ⚠️ | `localStorage` 満杯時のトーストあり（index.html:1781-1786）。Gemini API 失敗時はエラーメッセージのみでリトライなし | P3（報告のみ） |
| C5 | localStorage.clear() を使っていない | ✅ | 該当 0 件 | — |

---

## D. 表示（Part I §2）

| # | 項目 | 判定 | 実測 | 対応 |
|---|---|:--:|---|:--:|
| D1 | viewport に viewport-fit=cover | ⚠️ | `viewport-fit=cover` はある。**しかし `maximum-scale=1.0, user-scalable=no` が付いている**（index.html:5）。Part I §2-1 は「原稿用紙・読書記録など文章を読む画面には付けない」と明示 → **拡大できないのはアクセシビリティ上の後退** | P1 |
| D2 | 100dvh を使用 | ✅ | `body { height:100vh; height:100dvh; }`（index.html:63）＋ `h-[100dvh]`。フォールバック順も正しい | — |
| D2b | visualViewport でソフトキーボード対応 | ❌ | 該当 0 件。**本アプリは縦書き入力が主機能**であり、Part I §2-2 が名指しで挙げる「原稿用紙・入力系で頻発」する問題 | P1 |
| D3 | safe-area-inset を適用 | ⚠️ | `body` の4辺のみ（index.html:63）。固定ヘッダ／フッタ側の内訳指定なし | P1 |
| D4 | clamp() による fluid type | ❌ | `clamp(` の該当 **0 件**。Tailwind の固定クラスのみ | P1 |
| D5 | Canvas に devicePixelRatio 補正 | — | `getContext('2d')` の該当 0 件（Canvas 未使用。原稿用紙は DOM グリッド＋CSS 罫線） | — |
| D6 | 320px 幅で横スクロールが出ない | ⚠️ | 未検証（P1 で実測する） | P1 |
| D7 | 画像に width/height、150KB以下 | ⚠️ | `<img>` タグ **0 件**（CLS の懸念なし）。ただしアイコン画像が超過 → §F/P2 | P2 |
| D8 | コントラスト 4.5:1 以上 | ⚠️ | 目視・自動測定とも未実施。Tailwind の `text-slate-500` on white ＝ 約 4.76:1 で最低ラインは満たす見込み | P3（報告のみ） |
| D9 | タップ領域 44px 以上・touch-action | ❌ | `touch-action` **0 件**、`overscroll-behavior` **0 件**、`-webkit-tap-highlight-color` **0 件**。ダブルタップズームの 300ms 遅延が残っている | P1 |
| D10 | prefers-reduced-motion 対応 | ❌ | 該当 **0 件**。モーダル／トーストにアニメーション3種あり（index.html:155-162） | P1 |
| D11 | 提示モード | — | 個々の児童が自分の作文を書くアプリで、一斉提示の用途がない。**個人の作文＝個人情報であり、電子黒板への既定表示はむしろ不適切**のため非該当と判断 | — |
| D12 | 印刷CSS | ✅ | `@media print` 2 ブロック（index.html:141-147, 193-205）。A4 横・行媒体・原稿用紙罫線まで作り込まれている | — |

---

## E. PWA（Part I §3）

| # | 項目 | 判定 | 実測 | 対応 |
|---|---|:--:|---|:--:|
| E1 | manifest の id/scope/start_url がリポジトリ名絶対パス | ❌ | **`"id": "./"`, `"start_url": "./"`, `"scope": "./"`。最重要違反。** `gigayama.github.io` は数十個のアプリが同一オリジンを共有しており、相対値のままだと別アプリと取り違えられる事故が起きる | **P1 最優先** |
| E1b | manifest の必須項目 | ⚠️ | `dir` / `display_override` / `launch_handler` / `categories` が欠落 | P1 |
| E2 | アイコン4種 + apple-touch-icon | ✅ | 192/512/maskable-192/maskable-512/apple-touch-icon すべて存在 | — |
| E3 | beforeinstallprompt を head 最上部で捕捉 | ❌ | 該当 **0 件**。捕捉していないため、インストール導線が Chrome 任せになっている | P1 |
| E4 | インストールボタンをアプリ内に設置 | ❌ | 存在しない | P1 |
| E5 | sw.js が自アプリ接頭辞のキャッシュのみ削除 | ✅ | `k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME`（sw.js:47-52）。**過去の修正済み**（commit 69669e3） | — |
| E6 | sw.js が localStorage に触れていない | ✅ | 該当 0 件 | — |
| E7 | 更新通知 | ❌ | `updatefound` / `SKIP_WAITING` の該当 **0 件**。`skipWaiting()` を install で即実行しているため、更新はページ再訪時に無言で入れ替わる。児童への告知がない | P1 |
| E8 | offline.html | ❌ | 存在しない。`navigate` 失敗時は `caches.match('./index.html')` のみで、未キャッシュ時は白画面 | P1 |
| E9 | APP_VERSION を更新した | ⚠️ | 現在 `'v3'`（sw.js:12）。今回のリリースで上げる必要あり | P1 |
| E10 | iOS の「ホーム画面に追加」手順を MANUAL に記載 | ⚠️ | MANUAL に PWA インストール手順の節が見当たらない（「1. はじめに」に動作環境の記載はある） | P3 |
| E11 | `<meta name="color-scheme">` | ❌ | 該当 0 件 | P1 |

---

## F. アクセシビリティ・性能

| # | 項目 | 判定 | 実測 | 対応 |
|---|---|:--:|---|:--:|
| F1 | alt / aria-label / aria-live | ⚠️ | `<img>` が 0 件のため alt は非該当。aria 属性の網羅性は未確認 | P3 |
| F2 | キーボードのみで全機能に到達 | ⚠️ | ショートカットは MANUAL 3-11 に記載あり。モーダルのフォーカストラップは未確認 | P3 |
| F3 | 初回JS 300KB以下 | ❌ | **大幅超過。** CDN から以下を毎回読む：`@babel/standalone`（約 2.9MB, 非圧縮）／`react` + `react-dom`（約 140KB）／`peerjs`（約 120KB）／`sweetalert2`／`diff_match_patch`／`cdn.tailwindcss.com`（JIT 版・約 100KB）。**加えて `index.html` 内の 2,100 行の JSX をブラウザ上で毎回 Babel 変換している** | §H（要相談） |
| F4 | 1ファイル 5,000行 / 400KB 以内 | ✅ | `index.html` 2,219 行 / 151.8KB。**行数・容量とも基準内** | — |
| F5 | 総アセット（初回）1MB 以下 | ⚠️ | 自ホスト分は 866KB だが、うち **画像が 671KB**（下表）。CDN 分を足すと大幅超過 | P2 / §H |

### 画像の実測

| ファイル | 現在 | 基準 | 判定 |
|---|---:|---:|:--:|
| `favicon.png` | **250.7 KB** | 30 KB | ❌ |
| `icons/icon-512.png` | **211.2 KB** | 60 KB | ❌ |
| `icons/maskable-512.png` | **125.0 KB** | 60 KB | ❌ |
| `icons/icon-192.png` | 33.9 KB | — | ⚠️ |
| `icons/apple-touch-icon.png` | 30.3 KB | — | ⚠️ |
| `icons/maskable-192.png` | 20.7 KB | — | ✅ |

---

## G. 学習ログ（学習系のみ）

| # | 項目 | 判定 | 実測 | 対応 |
|---|---|:--:|---|:--:|
| G1 | study.v1 準拠 | — | `study.records.v1` を書いていない。本アプリは「作文を書く道具」であり、正誤や所要時間で測る学習ドリルではないため**非該当**と判断 | — |
| G2 | 中断記録・5分ルール | — | 同上 | — |

なお、既存の localStorage キーはすべて `genko_pro_` 接頭辞で統一されており、
`study.records.v1` を巻き込む書き込みも削除も**行っていない**（Part I §5 の禁止事項に抵触しない）。

---

## H. 構造上の重い課題（自動では直さない・人間の判断が要る）

### H1. ブラウザ内 Babel 変換（最重要・F3 の原因）

```html
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
...
<script type="text/babel">   <!-- 約 2,100 行の JSX -->
```

- 起動のたびに **約 2.9MB の Babel を落とし、2,100 行を端末上でコンパイル**している。
  メモリ 4GB の Chromebook で 40 人が一斉に開くと、初回表示が数秒〜十数秒になる。
- 解消するには **Vite（B型）へ移す＝ビルド工程の導入**が必要で、
  `index.html` の構造が全面的に変わる。Part III 絶対安全規則 4「1つのPRに1つの目的だけ」と
  §停止条件「テストが無い状態で 100 行超の変更が必要なとき」に真正面から当たる。
- **→ 今回の /rollout では手を付けない。別案件として起票することを提案する。**

### H2. CSP と CDN 依存

- 上記の 6 本の CDN（tailwind / unpkg / cdnjs / jsdelivr / fonts.googleapis / fonts.gstatic）に
  加え、`type="text/babel"` は `unsafe-eval` を、Tailwind CDN は `unsafe-inline` を要求する。
- つまり **H1 を解消しない限り、意味のある CSP は書けない**
  （`script-src 'unsafe-eval' 'unsafe-inline' https://*` は CSP を入れないのと大差ない）。
- Part I §P1-9 の「確認できない環境なら投入せず、手順書として PR に添える」に従い、
  **今回は CSP を投入しない。** H1 と同時に対応すべき項目として記録する。

### H3. リポジトリ系統の整理（Part III「作業開始前に人間が決めること」）

`online-manuscript-paper` / `-lite` / `-pro` / `Online-Publisher-pro` の 4 系統の
正本をどれにするかは未決。本監査は `-pro` 単体のみを対象とした。

---

## 判定サマリ

| フェーズ | 内容 | 破壊リスク | 今回実施 |
|---|---|:--:|:--:|
| **P0** | LICENSE / .gitignore / dependabot.yml | なし | ✅ 実施 |
| **P1** | manifest の id/scope/start_url、viewport、visualViewport、safe-area、fluid type、タッチ、reduced-motion、beforeinstallprompt、インストールボタン、更新通知、offline.html、APP_VERSION、pagehide | 小〜中 | ✅ 実施 |
| **P2** | 画像圧縮（671KB → 目標 100KB 台） | 小（画質は人間が確認） | ✅ 実施 |
| **P3** | MANUAL に PWA 導入手順、README に不足節 | なし | ✅ 実施 |
| **P4** | 品質ゲート（`scripts/check-project.mjs`） | なし | ✅ 実施 |
| **H1** | ブラウザ内 Babel → Vite 移行 | **大** | ❌ 見送り（要相談） |
| **H2** | CSP 投入 | **大**（H1 依存） | ❌ 見送り（要相談） |

### ❌ のまま残すものとその理由

- **B1（CSP）** … H2 のとおり、H1 を直さない限り実効性のある CSP が書けない。
  中途半端な CSP は「入っているのに守っていない」状態を作り、かえって危険。
- **F3（初回JS 300KB）** … H1 のとおり、解消にはビルド工程の導入が必要。
  1 PR / 1 目的の原則と停止条件に抵触するため、別案件として提案する。

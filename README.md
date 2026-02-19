# オンライン原稿用紙 Pro - GIGA Edition

GIGA スクール端末（Chromebook）対応のオンライン原稿用紙 Web アプリケーション。  
Google Apps Script (GAS) + Google Sheets をバックエンドに、児童の作文作成から教師の添削・評価までをワンストップで行えます。

## 主な機能

### 児童向け
- **原稿用紙プレビュー** — 縦書き原稿用紙をリアルタイムにプレビュー表示
- **下書き保存 / 提出** — サーバー保存 + LocalStorage による自動保存
- **文字数カウンター** — リアルタイムで文字数を表示
- **禁則処理** — 追い出し方式 / ぶら下がり方式を設定で切替可能
- **返却通知** — 先生からの返却をベルアイコンでお知らせ
- **添削の確認** — 先生のコメントをタップで確認、修正完了マーク

### 教師向け
- **ダッシュボード** — 児童の作文一覧をフィルタリング・検索
- **添削機能** — ドラッグ選択でコメント付き添削
- **AI 添削** — Gemini API による自動添削（API キー設定が必要）
- **一括完了** — チェック済み作文を一括で「完了」に変更
- **一括印刷** — 選択した作文をまとめて印刷
- **評価・返却** — 再提出 / 完了のステータス管理

### 共通
- **用紙設定** — 20 文字 × 20 行（高学年）/ 15 文字 × 16 行（低学年）
- **印刷** — 原稿用紙フォーマットでの印刷対応

## 技術スタック

| 項目 | 技術 |
|------|------|
| バックエンド | Google Apps Script |
| データストア | Google Sheets |
| フロントエンド | HTML / CSS / JavaScript |
| UI フレームワーク | Bootstrap 5.3.0, Bootstrap Icons |
| フォント | Zen Old Mincho (Google Fonts) |
| ダイアログ | SweetAlert2 |
| 差分検出 | diff-match-patch |
| AI 添削 | Gemini API (2.5 Flash) |

## セットアップ

### 1. GAS プロジェクト作成

1. [Google Apps Script](https://script.google.com/) で新しいプロジェクトを作成
2. 以下のファイルをプロジェクトに追加:
   - `code.gs` — サーバーサイドロジック
   - `index.html` — メインHTML
   - `css.html` — スタイルシート
   - `js.html` — クライアントサイドロジック

### 2. スコープ設定

GAS エディタ → プロジェクト設定 → `appsscript.json` を表示:

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
```

### 3. デプロイ

- GAS エディタ → デプロイ → 新しいデプロイ → ウェブアプリ
- アクセス権: 「全員」に設定

### 4. 初期設定

| 設定項目 | 方法 |
|----------|------|
| 教師パスワード | GAS → プロジェクト設定 → スクリプトプロパティ → `TEACHER_PASSWORD`（デフォルト: `admin`） |
| Gemini API キー | アプリ内の設定画面（歯車アイコン）→ 教師ログイン後に入力 |

## ファイル構成

```
├── code.gs      # GAS サーバーサイド（DB操作・認証・AI連携）
├── index.html   # HTML テンプレート（児童/教師ビュー）
├── css.html     # CSS（原稿用紙・印刷・レスポンシブ）
├── js.html      # JavaScript（状態管理・UI制御・通信）
└── README.md
```

## セキュリティ

- 教師パスワードは `ScriptProperties` で管理（ソースコードに平文保存しない）
- 添削コメントの表示時に HTML エスケープ処理（XSS 対策）
- 児童の個人情報は Google Sheets 内に閉じて管理

## ライセンス

MIT License

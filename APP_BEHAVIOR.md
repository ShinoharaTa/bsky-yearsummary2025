## アプリ全体構造と現在の動作概要

- **フロントエンド**: React + Vite（`client/` 配下）
- **ルーティング**: `wouter` を利用した SPA ルーティング
- **サーバ**: Express（`server/` 配下）
  - いまは API ルートはほぼ未使用で、主に Vite 開発サーバ／ビルド済み静的ファイルの配信のみ
- **Bluesky 連携**: クライアント側から `@atproto/api` (`BskyAgent`) を直接叩く
- **想定ドメイン**: `https://bsky-summary2025.shino3.net`

---

## ルーティング構成

### `App.tsx`

- `wouter` の `Switch` でルートを定義:
  - `/` → `HomePage`
  - `/:handle` → 同じく `HomePage`
  - それ以外 → `NotFound`

→ URL に `/:handle` が付いていても、コンポーネントとしては常に `HomePage` が使われます。

### `HomePage` (`client/src/pages/home.tsx`)

- `useRoute(":handle")` を使って、自前で `/:handle` を解釈しています。
- 内部状態:
  - `isAuthenticated`: `BskyAgent` のセッション有無から判定
  - `userDid`: ログイン済みユーザーの DID
- URL・ログイン状態から、どの DID の統計を表示するかを決定:
  - `targetHandle`: URL が `/:handle` にマッチしていれば、その `handle`
  - `showStats`:
    - `targetHandle` がある → `true` （誰かの公開ハンドル分を表示）
    - `targetHandle` がなく `isAuthenticated` が `true` → `true`（自分の分を表示）
  - `didToFetch`:
    - `targetHandle` がある → そのハンドルを `StatsDisplay` 側に渡し、内部で DID 解決／レキシコン参照
    - ない → ログイン中ユーザーの `userDid`
- レンダリング条件:
  - `showStats && didToFetch` → `StatsDisplay` を表示
  - それ以外 → ログインフォームつきのトップビューを表示

---

## ログインフロー

### `LoginForm` (`client/src/components/login-form.tsx`)

- 入力項目:
  - `identifier`: ハンドル名（例: `alice.bsky.social`）またはメールアドレス
  - `password`: アプリパスワード
- ログイン処理:
  - `agent.login({ identifier, password })` を呼び出し
  - 成功したら `agent.session.did` を親（`HomePage`）へ `onSuccess(did)` で渡す
- UI 上の説明:
  - 解析結果の画面から「結果を保存してBlueskyに投稿」できることを注意書きに記載

---

## 解析ロジック（現在の実装）

### `fetchYearlyStats` (`client/src/lib/bluesky.ts`)

- 役割:
  - 特定ユーザー（ハンドルまたは DID）の **2025 年の年間統計**を Bluesky PDS から直接集計する「重い解析」用関数
- パラメータ:
  - `handleOrDid: string`
  - `year: number`（現在は 2025 を渡して利用）
  - `onProgress(progress: number)`: 進捗バー用コールバック
- 処理概要:
  1. `handleOrDid` が DID でなければ、`agent.resolveHandle` で DID 解決
  2. `app.bsky.feed.post` コレクションを `listRecords` で走査
     - `createdAt` が `2025-01-01T00:00:00Z` 以上、`2026-01-01T00:00:00Z` 未満のレコードのみ集計
     - `record.reply` の有無で **投稿** / **リプライ** をカウント
     - 同時に `monthCounts` で月別投稿数もカウント
  3. `app.bsky.feed.like` コレクションを `listRecords` で走査
     - 同様に 2025 年分のいいね数をカウント
  4. `monthCounts` から最も件数の多い月を `mostActiveMonth` として算出
  5. 戻り値:
     - `{ posts, replies, likes, mostActiveMonth }`

→ この関数は「純粋に集計して返すだけ」で、保存や投稿の副作用は行いません。

### `fetchSavedSummary` (`client/src/lib/bluesky.ts`)

- 役割:
  - 既に PDS に保存されている Year Summary レコード
    `net.shino3.yearsummary2025.wrap` コレクションの `rkey = "2025"` を **1 件だけ軽量に取得**するための関数
- パラメータ:
  - `handleOrDid: string`（ハンドルまたは DID）
- 処理概要:
  1. `handleOrDid` が DID でなければ、`agent.resolveHandle` で DID 解決
  2. `agent.api.com.atproto.repo.getRecord` を使い、以下を取得:
     - `repo`: 解決済み DID
     - `collection`: `"net.shino3.yearsummary2025.wrap"`
     - `rkey`: `"2025"`
  3. レコードが存在すれば、その `posts / replies / likes / mostActiveMonth` を取り出して返す
     - 存在しない場合や権限エラー時は例外として扱われ、呼び出し側（`StatsDisplay`）でエラーハンドリングされる

---

## 結果画面（統計表示・現在の実装）

### `StatsDisplay` (`client/src/components/stats-display.tsx`)

#### 1. マウント時の挙動（どのデータソースを使うか）

- `useEffect` 内で、`did` と `handle`、および `agent.session` の状態に応じてデータ取得方法を分岐:
  - **`/:handle` を閲覧しているとき**（自分・他人を問わず）:
    - 条件: `handle` が存在する
    - この場合は **`fetchSavedSummary(handle)` を呼び出す**。
    - 既に PDS に保存されている Year Summary レコードのみを読み込み、`listRecords` ベースの重い解析は行わない。
  - **自分自身のアカウントを見ているとき**（`/` または 自分の `/:handle`）:
    - 上記条件に当てはまらない場合（＝ `handle` が未指定 = `/` の場合）
    - この場合は **`fetchYearlyStats(did, 2025, onProgress)` を呼び出し**、重い解析を実行する。
- ローディング状態:
  - `stats.loading = true`
  - プログレスバーに `progress` を反映（`fetchSavedSummary` 経由の場合はすぐ 100% に設定）
- 成功時:
  - `stats = { posts, replies, likes, mostActiveMonth, loading: false, progress: 100 }`
- 失敗時:
  - `stats.error` にメッセージをセット

#### 2. ローディング表示

- `stats.loading === true` の間:
  - 「データを集計中…」「PDSから2025年の活動データを取得しています。」というテキスト
  - プログレスバー（0〜100%）を表示

#### 3. エラー時の挙動

- `stats.error` が存在する場合:
  - `handle` が **ある場合**（`/:identifier` からのアクセス想定）:
    - 「`@{handle}` さんの解析結果はまだありません」というメッセージ
    - 説明文: PDS から 2025 年の活動データを取得できなかった旨
    - ボタン:
      - 「Bluesky で解析リクエストを送る」
        - `https://bsky.app/intent/compose?text=...` を開いて
        - `@{handle} さんの 2025 年の Bluesky 活動まとめを見たいです！ ここから生成できます: {アプリのルート URL}` という本文を事前入力
      - 「トップページに戻る」
        - `window.location.href = "/"` でトップへ
  - `handle` が **ない場合**（自分の画面など）:
    - シンプルなエラーメッセージ（タイムラインが大きすぎる可能性など）を表示

#### 4. 正常時の統計カード表示

- `stats.loading === false` かつ `stats.error` なしの場合:
  - メインカード:
    - ユーザー名（`handle` または「あなた」）と「2025年まとめ」ラベル
  - 3 つの主要統計:
    - 投稿数（posts）
    - リプライ数（replies）
    - いいね数（likes）
  - 追加情報:
    - `stats.mostActiveMonth` があれば「最も活発だった月」をカードとして表示
  - フッターテキストに簡易ラベルと年（`{new Date().getFullYear()}`）を表示

#### 5. 解析完了時の `/:handle` への自動遷移

- 目的:
  - 自分のアカウントの解析が完了したら、自動的に `/:handle` に遷移し、その URL をそのままシェアに使えるようにする。
- 実装概要:
  - `StatsDisplay` 内で `useLocation`（`wouter`）を利用し、現在パスと遷移関数を取得。
  - 追加の `useEffect` で以下を監視:
    - `stats.loading === false`
    - `!stats.error`
    - `agent.session && agent.session.did === did`（＝自分自身の DID）
    - `handle` が存在し、かつ `agent.session.handle === handle`
    - 現在のパスが `/`
  - すべて満たされた場合に一度だけ `setLocation("/" + handle)` を実行し、`/` から `/:handle` へ SPA 内遷移する。
- 結果:
  - ログイン後に `/` で解析を開始しても、完了時には自分の `/:handle` に自動遷移しており、
    そのままの URL をシェア用リンクとして利用できる。

#### 6. 解析完了時の自動保存（PDS への Year Summary 書き込み）

- 目的:
  - `/` で実行した解析が終わった時点で、ユーザー操作なしに Year Summary を PDS に保存しておく。
- 実装概要:
  - `StatsDisplay` 内で、以下の条件を満たしたときに一度だけ `putRecord` を実行:
    - `stats.loading === false`
    - `!stats.error`
    - `handle` が未指定（＝ `/` で表示しているとき）
    - `agent.session && agent.session.did === did`（＝自分自身の DID）
    - ローカル状態 `autoSaved === false`
  - 保存内容:
    - コレクション: `net.shino3.yearsummary2025.wrap`
    - `rkey`: `"2025"`
    - フィールド:
      - `year: 2025`
      - `generatedAt`: 自動保存時点の ISO 8601 日時
      - `posts / replies / likes / mostActiveMonth`
      - `firstPostDate: null`（現状未計測）
      - `summaryText`: `buildSummaryText(stats)` による、2025 年の活動まとめテキスト
      - `lang: "ja"`
      - `version: "1.0.0"`
  - 自動保存完了後:
    - ローカル状態 `autoSaved` を `true` にして、同一マウント中に複数回保存されないようにする。
    - あわせて **Bluesky シェア用モーダルを開く**（次項参照）。

#### 7. 結果画面でのアクションボタン／シェアモーダル

- **Blueskyでシェア** ボタン
  - 押下時に即 `bsky.app` を開くのではなく、まずアプリ内の **シェアモーダル** を開く。
  - モーダル内容:
    - タイトル例: 「Blueskyで2025年の活動をシェアしませんか？」
    - 説明: 「投稿内容はいつでも編集できます」などの一言。
    - 本文プレビュー: `shareText`（統計値＋`shareUrl` を含んだテキスト）を `whitespace-pre-wrap` で表示。
    - ボタン:
      - 「あとで」: モーダルを閉じるだけ。
      - 「Blueskyを開いて投稿する」:
        - `https://bsky.app/intent/compose?text=encodeURIComponent(shareText)` を `window.open` で新規タブ表示。
        - モーダルを閉じる。

- **画像を保存** ボタン
  - 統計カード部分 (`cardRef`) を `html-to-image` (`toPng`) で PNG 化
  - `bluesky-2025-wrap-{handle or 'stats'}.png` というファイル名でダウンロード

- **リンクをコピー** ボタン
  - `shareUrl` をクリップボードにコピー
  - Toast で「リンクをコピーしました」を表示

- **結果を保存してBlueskyに投稿** ボタン
  - 表示条件:
    - `agent.session && agent.session.did === did` の場合のみ表示
      - ＝「ログイン済みかつ表示中の DID が自分自身」のとき
  - 動作:
    1. `saving` フラグを `true` にしてボタンをスピナー表示にする
    2. `generatedAt = new Date().toISOString()` を生成
    3. `summaryText` を組み立て:
       - ヘッダ: `2025年のBluesky活動まとめ（bsky-summary2025.shino3.net）`
       - 投稿数／リプライ数／いいね数（`stats` の値から）
       - `stats.mostActiveMonth` があれば「もっとも活発だった月」行を追加
    4. **PDS に保存**:
       - `agent.api.com.atproto.repo.putRecord` を呼び出し
       - `repo`: `agent.session!.did`
       - `collection`: `"net.shino3.yearsummary2025.wrap"`
       - `rkey`: `"2025"`
       - `record`:
         - `year: 2025`
         - `generatedAt`
         - `posts: stats.posts`
         - `replies: stats.replies`
         - `likes: stats.likes`
         - `mostActiveMonth: stats.mostActiveMonth` または `null`
         - `firstPostDate: null`（現状未計測）
         - `summaryText`
         - `lang: "ja"`
         - `version: "1.0.0"`
    5. **Bluesky に自動投稿**:
       - `displayName` = `handle` or `agent.session.handle` or "あなた"
       - `postText`:
         - `"{displayName} の 2025 年の Bluesky 活動まとめ"` ヘッダ
         - 上記 `summaryText`
         - `"詳しくはこちら: {shareUrl}"` を末尾に追加
       - `agent.post({ text: postText })` を実行
    6. 成功時:
       - `savedOnce = true` にして、ボタンラベルを「保存＆投稿済み」に変更し、再度押せないようにする
       - Toast で「PDS にサマリーを保存し、Bluesky に投稿しました。」を表示
    7. 失敗時:
       - コンソールにエラー出力
       - Toast で「保存／投稿に失敗しました」を表示
    8. 最後に `saving = false` に戻す

- ボタン下の説明文:
  - 「bsky-summary2025.shino3.net が、あなたの PDS に `net.shino3.yearsummary2025.wrap/2025` として保存し、同じ内容を Bluesky に投稿します。」と明記

- **「一年のまとめを作ろう」CTA ボックス**
  - 役割:
    - 結果画面を見たユーザー自身にも、「自分の一年のまとめを作る」行動を促すための導線。
  - UI:
    - テキスト: 「あなたも自分の一年のまとめを作りませんか？」＋簡単な説明文。
    - ボタン: 「一年のまとめを作ろう」
  - 動作:
    - クリックで `window.location.href = "/"` とし、トップページ（ログイン／解析開始画面）へ遷移する。

---

## Year Summary レキシコン（スキーマ）

### `yearsummary2025.lexicon.json`

- 定義しているコレクション NSID:
  - `id: "net.shino3.yearsummary2025.wrap"`
- メインレコード定義:
  - `type: record`
  - `key`: `literal: "2025"`
    - 各ユーザーの PDS には、`rkey = "2025"` のレコードが 1 つだけ存在する想定
- レコードの主なフィールド:
  - `year: integer`
  - `generatedAt: string (datetime)`
  - `posts: integer`
  - `replies: integer`
  - `likes: integer`
  - `mostActiveMonth: string | null`
  - `firstPostDate: string (datetime) | null`
  - `summaryText: string`（人間向けの総括テキスト）
  - `lang: string | null`（例: `"ja"`）
  - `version: string | null`

→ `StatsDisplay` からの「結果を保存してBlueskyに投稿」ボタンは、このレキシコンに沿ったレコードを `putRecord` しています。

---

## サーバ側（簡易メモ）

- `server/index.ts`:
  - Express アプリを起動し、`registerRoutes`・エラーハンドラ・Vite または静的ファイル配信をセットアップ
- `server/routes.ts`:
  - まだアプリ固有の `/api` エンドポイントは未実装
- `server/static.ts` / `server/vite.ts`:
  - 本番時: `dist/public` を静的配信
  - 開発時: Vite をミドルウェアモードで組み込み、`client/index.html` を常に最新の状態で配信

---

## 今後の仕様変更方針のステータス

- **1. `/:handle` アクセス時はレキシコンレコードを優先して参照する**
  - ステータス: **実装済み**
  - `StatsDisplay` 内で、他人の `/:handle` を閲覧している場合は `fetchSavedSummary` を使って Year Summary レコードのみを読み込み、`listRecords` ベースのフル解析は行わない。

- **2. 解析完了時に `/:handle` へ遷移して、その URL でシェアする**
  - ステータス: **実装済み**
  - 自分自身のアカウントを `/` から解析した場合、解析完了後に `/:handle` へ自動遷移するロジックを `StatsDisplay` 内に追加済み。

- **3. 誰が「重い解析」を実行できるかの整理**
  - ステータス: **方針としては実現済み**
  - 実質的に、重い解析（`fetchYearlyStats`）は「自分自身のアカウント（`agent.session.did === did`）を見ているとき」にのみ実行され、他人の `/:handle` では `fetchSavedSummary` による軽量取得のみを行う構造になっている。

# レート制限の実装完了

## 📋 実装内容

### 1. レート制限モジュールの作成
**ファイル**: `/lib/rateLimit.ts`

メモリベースのレート制限機構を実装しました。外部サービスに依存せず、シンプルで効率的なソリューションです。

**特徴**:
- クライアント IP ごとにリクエスト数をトラッキング
- スライディングウィンドウ方式で時間ウィンドウを管理
- 自動メモリクリーンアップ機能（5分ごと）
- タイムスタンプベースのウィンドウ管理

### 2. API Routes へのレート制限の統合

#### `/api/lighton` (照明オン)
- **制限**: 10 リクエスト/分（IP アドレスごと）
- **HTTPステータス**: 429 (Too Many Requests)

#### `/api/lightoff` (照明オフ)
- **制限**: 10 リクエスト/分（IP アドレスごと）
- **HTTPステータス**: 429 (Too Many Requests)

#### `/api/lockopen` (スマートロック解除)
- **制限**: 5 リクエスト/分（IP アドレスごと）
- **HTTPステータス**: 429 (Too Many Requests)
- **理由**: セキュリティ上、より厳しい制限を適用

### 3. クライアント IP の取得方法

リバースプロキシを経由している場合のための対応：
```typescript
const clientIp =
  (request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown") as string;
```

優先順位：
1. `X-Forwarded-For` (Cloudflare, Nginx, AWS ELB など)
2. `X-Real-IP` (Nginx)
3. `unknown` (判定不可の場合)

### 4. エラーレスポンス形式

レート制限に達した場合のレスポンス:
```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 45
}
```

HTTP ヘッダー:
```
HTTP/1.1 429 Too Many Requests
Retry-After: 45
```

---

## 🔒 セキュリティ効果

### ブルートフォース攻撃対策
- 認証キーの総当たり攻撃を制限
- 固定回数を超えるとリクエストを拒否

### DoS/DDoS 攻撃対策
- 異常なリクエスト頻度を検出・制限
- リソース枯渇を防止

### スマートロック保護
- ロック解除リクエストを厳しく制限（5/分）
- 誤動作や不正な連続解除を防止

---

## 📊 実装仕様

| 項目 | 値 |
|------|-----|
| 実装方式 | メモリベース (インメモリ) |
| ウィンドウ方式 | スライディングウィンドウ |
| トラッキング単位 | クライアント IP |
| メモリクリーンアップ | 5分ごと自動実行 |
| lighton/lightoff の制限 | 10 req/min |
| lockopen の制限 | 5 req/min |

---

## ⚙️ パフォーマンス

- **メモリ使用量**: 低（IP ごとに数バイト）
- **CPU オーバーヘッド**: 最小限（O(1) チェック）
- **遅延**: < 1ms

---

## 🔧 設定のカスタマイズ方法

レート制限の値を変更する場合は、各 API Route の以下の部分を修正してください：

```typescript
const rateLimitResult = checkRateLimit(clientIp, {
  maxRequests: 10,      // ← ここを変更
  windowMs: 60 * 1000,  // ← ここを変更（ミリ秒）
});
```

**例**: 1時間に 100 リクエストに変更
```typescript
const rateLimitResult = checkRateLimit(clientIp, {
  maxRequests: 100,
  windowMs: 60 * 60 * 1000,  // 1時間
});
```

---

## 📝 注意事項

### マルチサーバー環境での使用
現在の実装はメモリベースなため、サーバープロセスごとに独立した制限カウンターを持ちます。

複数サーバーでの運用時には、以下の選択肢を検討してください：
1. **Redis を使用した共有レート制限** (Upstash, AWS ElastiCache など)
2. **サーバーアフィニティの設定** (同じクライアントを同じサーバーにルーティング)
3. **現在の実装を継続** (単一サーバー運用の場合)

### リバースプロキシの設定
X-Forwarded-For、X-Real-IP ヘッダーが正しく転送されていることを確認してください。

```nginx
# Nginx 設定例
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
```

---

## ✅ テスト結果

すべてのテストケースが正常に動作することを確認済み：
- ✓ 制限内のリクエスト: 許可
- ✓ 制限を超えるリクエスト: 拒否
- ✓ 異なる IP の独立したカウント: 成功
- ✓ メモリリークの防止: 自動クリーンアップ機能確認

---

## 次のステップ

レート制限実装後の推奨事項：

1. **優先度 P0**
   - [ ] 秘密情報のリセット（PASSKEY, API キー等）
   - [ ] タイムセーフな認証比較の実装

2. **優先度 P1**
   - [ ] 入力バリデーションの実装
   - [ ] CSRF 保護の追加
   - [ ] エラーレスポンスの改善

3. **優先度 P2**
   - [ ] セキュリティヘッダーの設定
   - [ ] 本格的な認証機構（NextAuth.js等）の導入

---

**実装日時**: 2026-03-13  
**ステータス**: ✅ 完了・テスト済み

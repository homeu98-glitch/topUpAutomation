# topUpAutomation 項目記憶

## 部署結構（重要）
- Vercel 單一 function 部署：`api/` 目錄只可以有一個 entry（`api/index.js` catch-all）。所有 route handler 必須放喺 root `routes/`，唔可以放 `api/`（否則 Vercel 會當每個有 `export default` 嘅檔係獨立 Serverless Function，爆 Hobby 12 個上限）。
- `server.js`（root）：本地開發用 Express 單體，`npm start` 跑；import `./routes/...`。
- `api/index.js`：Vercel 正式部署用 catch-all，動態 `import("../routes/...")`，包晒所有 route。
- `public/*.js` 嘅 `/api/...` 係 HTTP URL，永遠唔使改（由 catch-all 處理）。
- `vercel.json` 個 cron `/api/cron/auto-approve` 經 catch-all 處理。
- catch-all `api/index.js` 必須保留 `bodyParser: false` + 手動 `readJsonBody()` parse JSON（唔可以靠 Vercel auto-parse，因為 catch-all 關咗 bodyParser）；只有 3 個 multipart route（analyze / customer/submit / customer/submit-raw）要靠 formidable 讀 raw stream，所以 catch-all 唔可以開 auto bodyParser 同時又要保護 multipart。

## 環境 / 部署平台
- Vercel（Hobby）做正式部署；另 Render（render.yaml）跑 `npm start`。
- Hobby 嘅「單次部署最多 12 Serverless Function」硬上限至今未改（2025-2026 只改咗 CPU/記憶體/呼叫次數計費模型）。

## AI 供應商切換守則（重要）
- 切 AI 供應商（Aliyun ↔ OpenRouter ↔ Gemini）時，唔可以只改 `AI_BASE_URL` + `AI_API_KEY`：
  - OpenRouter key 必須以 `sk-or-` 開頭；Gemini native key 係 `AIza…`（但本 project 嘅 `requestChatCompletion` 係 OpenAI-compatible `/chat/completions` + `Bearer` header，只支援 OpenRouter / Aliyun compatible-mode，唔支援 Gemini native `?key=` 格式）。
  - `AI_MODEL` / `AI_OCR_MODEL` / `AI_TEXT_MODEL` / `AI_VL_FALLBACK_MODEL` 四個都要係該供應商有嘅 model ID，否則 auth 過咗都會 404。OpenRouter 上可用 `google/gemini-2.5-flash`、`google/gemma-3-12b-it:free` 等。
  - OpenRouter 嘅 `401 Missing Authentication header` 對「無效 key」同「冇 header」都會報同一句，唔可以當做 key 冇 set。

## 帳號架構（2026-10-16 確認）
- `60000000` = **POC 時代遺留嘅本地店主帳號**：`DEFAULT_OWNER_CODE='60000000'` / `DEFAULT_OWNER_PASSWORD='0000'` / `DEFAULT_OWNER_SHOP_NAME='表嫂美食'`（topup-service.js L33-38），schema.sql seed row `('POC001','表嫂美食','60000000','0000')`。
- Ledger SSO provisioning（`provisionMembershipShop` L1511-1566）按 name 匹配到種子行，**只更新 code/external_shop_id/auth_source/owner_external_id，`owner_login` 維持 '60000000' 不變** ⇒ 商店身份已係 Ledger 65273599（`shops.code`，前端「店舖編號」綁 code），剩 owner_login 遺留。
- `findOwnerByLogin` L1206-1220 有硬編碼後門：login='60000000' 按店名搵店並返回預設密碼 '0000' ⇒ 本地登入路徑仍然有效（清理帳號必須一齊封）。
- `exchangeMembershipLoginToken` L1656：session ownerLogin = `claims.owner_login || claims.owner_code || shop.owner_login || claims.sub` ⇒ SSO 批核嘅 approved_by 多數落到 60000000。
- `60000000` 亦曾出現喺 `transactions.customer_code`（會員編號欄），即同時係會員編號。
- 清理待辦：① 封本地後門 ② 若 Ledger claims 持續帶 owner_login='60000000' 要 Ledger 側改 ③ approved_by 歷史數據不受影響。

# topUpAutomation 項目記憶

## 部署結構（重要）
- Vercel 單一 function 部署：`api/` 目錄只可以有一個 entry（`api/index.js` catch-all）。所有 route handler 必須放喺 root `routes/`，唔可以放 `api/`（否則 Vercel 會當每個有 `export default` 嘅檔係獨立 Serverless Function，爆 Hobby 12 個上限）。
- `server.js`（root）：本地開發用 Express 單體，`npm start` 跑；import `./routes/...`。
- `api/index.js`：Vercel 正式部署用 catch-all，動態 `import("../routes/...")`，包晒所有 route。
- `public/*.js` 嘅 `/api/...` 係 HTTP URL，永遠唔使改（由 catch-all 處理）。
- `vercel.json` 個 cron `/api/cron/auto-approve` 經 catch-all 處理。

## 環境 / 部署平台
- Vercel（Hobby）做正式部署；另 Render（render.yaml）跑 `npm start`。
- Hobby 嘅「單次部署最多 12 Serverless Function」硬上限至今未改（2025-2026 只改咗 CPU/記憶體/呼叫次數計費模型）。

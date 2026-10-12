# Top Up Automation POC

This is a lightweight proof of concept for Macau top-up users and shop owners:

- customer portal: login, pick a shop, upload screenshots, run AI extraction, and send the result for approval
- owner portal: login, review pending submissions, approve transactions, and view dashboard/history

## What is included

- Traditional Chinese upload page with a simple Google-style visual direction
- Customer login with 8-digit member code
- Shop selector for the customer portal
- Owner login and review back office
- Auto-attempt to open the gallery on page load
- Multiple image selection with a maximum of 10 files
- Faster server-side image compression before storage
- AI-based extraction for:
  - 商戶名稱
  - 原交易訂單號
  - 交易金額
  - 實際交易時間
  - 訂單狀態
  - 支付方式
- Total amount summary with explicit send-for-approval action
- Owner dashboard with pending review and history tabs

## Project structure

- `server.js`: local Express development server
- `public/index.html`: customer portal
- `public/owner.html`: owner back office
- `public/index.html`: Main page
- `public/styles.css`: Styling
- `public/app.js`: customer interactions
- `public/owner.js`: owner back office interactions
- `api/`: Vercel API routes
- `lib/`: shared backend logic
- `supabase/schema.sql`: required database schema and sample seed rows

## Environment

Copy `.env.example` to `.env` and set:

- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_MODEL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `SESSION_SECRET`

The current POC is configured for an OpenAI-compatible vision endpoint.

## Run

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Important deployment note

This project is not a pure static website.

- The upload and AI recognition flow requires the Node.js backend in `server.js`
- If you open only the frontend on a static host such as GitHub Pages, the `POST /api/analyze` request will fail because there is no backend there
- For production, deploy the backend to a server platform such as Vercel, Railway, Render, Fly.io, ECS, or another Node-capable environment
- If frontend and backend are hosted separately, set `window.APP_CONFIG.apiBaseUrl` in `public/index.html`

## Vercel + Supabase

This repo now supports Vercel API routing and Supabase Storage.

### Vercel

- `vercel.json` rewrites `/api/*` to the Node handler in `api/index.js`
- `public/` is served as static frontend content
- `server.js` is reused by both local development and Vercel

### Supabase

- If `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET` are set, compressed images are uploaded to Supabase Storage
- If those values are missing, the app falls back to local `storage/` for local development
- For Vercel, use Supabase Storage because Vercel local filesystem is not suitable for persistent image storage

Create a public storage bucket such as `topup-images` in Supabase before deploying.

Run `supabase/schema.sql` in your Supabase SQL editor before using owner login, approval, dashboard, and history features.

## Fastest working deployment

The quickest path with your current setup is to deploy the whole repo to Vercel and store images in Supabase Storage.

1. Create a public Supabase Storage bucket, for example `topup-images`
2. In Vercel, import this repository
3. Add these environment variables in Vercel:
   - `AI_BASE_URL`
   - `AI_API_KEY`
   - `AI_MODEL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET`
4. Deploy

After deployment, open the Vercel URL directly. That URL will host both the frontend and backend together.

## Alternative Render deployment

If you prefer Render instead of Vercel:

1. Create a new Render account and connect GitHub
2. Select this repository
3. Render will detect `render.yaml`
4. Set these environment variables in Render:
   - `AI_BASE_URL`
   - `AI_API_KEY`
   - `AI_MODEL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET`
5. Deploy

After deployment, open the Render URL directly. That URL will host both the frontend and backend together.

If you still want to keep GitHub Pages for the frontend, open it like this:

```text
https://your-account.github.io/your-repo/?apiBaseUrl=https://your-render-service.onrender.com
```

## Notes

- The 8-digit member code is not enforced yet, but the frontend already accepts `?memberCode=12345678` for future integration.
- Browser security may block automatic opening of the file picker on some devices. A manual select button is included as fallback.
- Uploaded images are compressed and saved into `storage/` for POC purposes.

## POS / macau-ledger iframe embed

Owner and customer pages can load inside **macau-ledger** or **macauPosSystem** iframes.

| Setting | Production (Vercel HTTPS) | Local `npm start` (HTTP) |
|---------|----------------------------|---------------------------|
| Session cookie | `SameSite=None; Secure` (default) | Set `SESSION_COOKIE_SAMESITE=lax` in `.env` |
| Frame embed | `Content-Security-Policy: frame-ancestors …` via `vercel.json` | `lib/embed-policy.js` middleware in `server.js` |

Optional env:

- `TOPUP_FRAME_ANCESTORS` — extra parent origins (space/comma separated)
- `SESSION_COOKIE_SAMESITE` — `none` (default), `lax`, or `strict`

**macau-ledger SSO / webhooks are unchanged.** Same `SITEA_SSO_*` JWT flow and `SITEA_CALLBACK_*` webhooks; only cookie + CSP headers differ so third-party iframes can keep the owner session.

## Server-side auto-approve (no browser required)

`vercel.json` runs **`GET /api/cron/auto-approve` once per day** (`0 0 * * *`, UTC) — daily frequency is the maximum allowed on the Vercel Hobby plan. It calls `runAutoApprovalSweep()` in the database for every shop with `auto_approve_enabled = true`.

Once a merchant enables auto-approve in the owner UI, **approval continues even if nobody keeps the owner page or POS open** — but only up to once per day while on the Hobby plan. The in-browser countdown in `owner.js` is only for live refresh; the cron job is authoritative for background approvals.

> **Note:** The original design called for a per-minute sweep. The daily schedule is a Hobby-plan compromise. To restore near-real-time auto-approve, either upgrade to Vercel Pro (allows `* * * * *`) or move the trigger off Vercel cron to an external scheduler (e.g. cron-job.org / EasyCron) hitting `/api/cron/auto-approve` every minute — and add an auth token to that endpoint first, since it is currently unauthenticated.

## Auto-approve: verification status & risk policy

Auto-approve is now driven by the AI pipeline's per-transaction **verification status** rather than a single hard-coded "green" flag. Merchants choose which statuses are safe to auto-approve; everything else still requires manual review.

### Verification status enum (5 values)

`lib/topup-service.js → computeTransactionVerificationStatus()` produces one of these for every pending transaction:

| Status | Meaning | Typical trigger |
|--------|---------|-----------------|
| `verified_amount_and_id` | 單號與金額都已核實 — 在 mPay 後台找到完全一致的交易 | 客戶截圖清晰、AI 完整讀取、與後台完全對上 |
| `verified_id_only` | 單號核實但金額有差異 — 後台金額被採用作正確值 | 後台金額與客戶自填金額不一致 |
| `no_match` | 找不到對應的後台交易 — 單號在 mPay 後台不存在 | 客戶提供別家單號、單號被改過、後台延遲 |
| `no_order_id` | 圖中根本沒有可讀的單號 — 視為非交易截圖 | 空白、截到別的畫面、相片、模糊 |
| `ai_skipped` | AI 沒讀到任何欄位 — 額度滿或管線被跳過 | 額度耗盡、模型錯誤、手動跳過 |

Legacy `null` (no order number at all) is normalized to `no_order_id` so the UI always has a color and label.

### `shops.auto_approve_settings` JSON column

Added in `supabase/schema.sql`. The whole auto-approve policy for a shop lives in a single jsonb column so future knobs (e.g. per-shop flag, transaction count cap) can be added without further migrations.

```jsonc
{
  "allowed_statuses": ["verified_amount_and_id"],   // 商家勾選要自動核准的狀態
  "max_amount": 5000,                                // 單筆金額上限(MOP);超過則不自動批
  "cooldown_seconds": 30,                            // 同一商家兩次自動核准之間的最短間隔
  "last_auto_approved_at": null                      // 由系統寫入,商家不需手動設定
}
```

Default values come from env vars (see below). Validation is enforced server-side by `normalizeAutoApproveSettings()` and `sanitizeAutoApproveSettingsPatch()` — unknown statuses are dropped, types are coerced, and only whitelisted keys are accepted from API input.

### Backend sweep logic (`runAutoApprovalSweep`)

For each shop with `auto_approve_enabled = true` and per-tx in `pending`:

1. If `now - last_auto_approved_at < cooldown_seconds`, **skip the whole shop** (one cooldown, not one per tx).
2. If `txTotalAmount > max_amount`, skip that tx.
3. If `tx.verificationStatus ∉ allowed_statuses`, skip that tx.
4. Otherwise, look up the backoffice row to get the trusted amount, then call the same approval pipeline as the owner button.

`last_auto_approved_at` is updated **after every successful approval** so a single bad tx can't burn the whole shop's quota.

### Risk confirmation modal (10-second countdown)

Merchants who opt in to any of the three risky statuses (`no_match`, `no_order_id`, `ai_skipped`) are required to confirm via a native `<dialog>` modal **before the checkbox sticks**. Implementation: `public/risk-confirm.js`.

- `RISKY_AUTO_APPROVE_STATUSES = ["no_match", "no_order_id", "ai_skipped"]`
- Each status has tailored copy explaining what the customer could have done and what the merchant is giving up.
- The "I understand and accept the risk" button is **disabled for 10 seconds** with a live countdown; the merchant can also press Cancel/Close to abort.
- On cancel, the corresponding checkbox is **automatically un-ticked** so the setting is never silently saved.
- On accept, the checkbox stays checked, the settings API call is made, and a single confirmation toast appears (not per-status spam).
- Green/yellow (`verified_amount_and_id` / `verified_id_only`) silently enable — no toast, no modal.

### Environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `AUTO_APPROVE_DEFAULT_MAX_AMOUNT` | `5000` | Default `max_amount` written to new `auto_approve_settings` rows |
| `AUTO_APPROVE_DEFAULT_COOLDOWN_SECONDS` | `30` | Default `cooldown_seconds` between two auto-approvals in the same shop |

Both are read at module load in `lib/topup-service.js`. Changing them after deploy only affects **newly inserted rows** — existing shops keep whatever they last saved.

### Safety reminders

- The amount cap and cooldown are **hard guards** — the server enforces them even if the merchant's UI is bypassed.
- The risk modal is **the only** friction between a merchant and enabling risky auto-approve; treat it as a guard, not a guarantee.
- `verified_amount_and_id` is still the recommended default; widening to other statuses is a conscious decision the merchant must make in the settings dialog.
- On the Hobby plan the cron runs at most once per day (`0 0 * * *`), so approvals can lag up to ~24h behind a pending transaction. More frequent sweeps don't help because the cooldown gates back-to-back approvals anyway — but the daily ceiling is a plan limit, not a design choice.

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

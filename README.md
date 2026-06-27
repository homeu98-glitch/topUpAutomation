# Top Up Automation POC

This is a lightweight proof of concept for Macau top-up users to upload payment screenshots, run AI extraction, and review transaction details in a simple Traditional Chinese interface.

## What is included

- Traditional Chinese upload page with a simple Google-style visual direction
- Auto-attempt to open the gallery on page load
- Multiple image selection with a maximum of 10 files
- Server-side image compression before storage
- AI-based extraction for:
  - 商戶名稱
  - 原交易訂單號
  - 交易金額
  - 實際交易時間
  - 訂單狀態
  - 支付方式
- Horizontal preview slider with click-to-expand image modal
- Total amount summary

## Project structure

- `server.js`: Express server, upload handling, compression, AI proxy
- `public/index.html`: Main page
- `public/styles.css`: Styling
- `public/app.js`: Frontend interactions
- `storage/`: Compressed uploaded images

## Environment

Copy `.env.example` to `.env` and set:

- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_MODEL`

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
- For production, deploy the backend to a server platform such as Railway, Render, Fly.io, ECS, or another Node-capable environment
- If frontend and backend are hosted separately, set `window.APP_CONFIG.apiBaseUrl` in `public/index.html`

## Fastest working deployment

The quickest path is to deploy the whole repo to Render as a web service.

1. Create a new Render account and connect GitHub
2. Select this repository
3. Render will detect `render.yaml`
4. Set these environment variables in Render:
   - `AI_BASE_URL`
   - `AI_API_KEY`
   - `AI_MODEL`
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

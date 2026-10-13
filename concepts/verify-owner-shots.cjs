const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("C:/Users/surface/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");

const ROOT = "C:/dev/macauPos/topUpAutomation/public";
const RECEIPT = "C:/dev/macauPos/topUpAutomation/concepts/receipt-bg.jpg";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

const server = http.createServer((req, res) => {
  let url = req.url.split("?")[0];
  if (url === "/") url = "/owner.html";
  if (url.startsWith("/api/")) { res.writeHead(404); res.end("{}"); return; }
  const fp = path.join(ROOT, url);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(fp)] || "application/octet-stream" });
    res.end(data);
  });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

server.listen(0, async () => {
  const port = server.address().port;
  const receiptB64 = fs.readFileSync(RECEIPT).toString("base64");
  const receiptDataUrl = `data:image/jpeg;base64,${receiptB64}`;
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true });
  await page.goto(`http://localhost:${port}/owner.html`, { waitUntil: "networkidle0" });
  await sleep(800);

  // Inject mock data + open the real overlay (validates real HTML + CSS layout)
  await page.evaluate((dataUrl) => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const o = document.getElementById("mobileApproveOverlay");
    document.getElementById("maBgImg").src = dataUrl;
    document.getElementById("maLightboxImg").src = dataUrl;
    set("maAvatar", "陳");
    set("maName", "陳大文");
    set("maPhone", "6393 6541");
    set("maMember", "63936541");
    set("maAmount", "MOP 110.00");
    const s = document.getElementById("maStatus");
    s.textContent = "✓ 已比對 mPay 後台黃金金額 MOP 110.00，一致";
    s.className = "ma-status ma-status-ok";
    o.classList.remove("hidden");
    o.setAttribute("aria-hidden", "false");
  }, receiptDataUrl);
  await sleep(400);
  await page.screenshot({ path: "concepts/real-shot-main.png" });

  // Edit sheet open
  await page.evaluate(() => document.getElementById("maEdit").classList.add("open"));
  await sleep(400);
  await page.screenshot({ path: "concepts/real-shot-edit.png" });

  // Lightbox open
  await page.evaluate(() => {
    document.getElementById("maEdit").classList.remove("open");
    document.getElementById("maLightbox").classList.add("open");
  });
  await sleep(400);
  await page.screenshot({ path: "concepts/real-shot-lightbox.png" });

  await browser.close();
  server.close();
  console.log("DONE");
});

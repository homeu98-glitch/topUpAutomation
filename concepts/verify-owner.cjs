const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("C:/Users/surface/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");

const ROOT = "C:/dev/macauPos/topUpAutomation/public";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

const server = http.createServer((req, res) => {
  let url = req.url.split("?")[0];
  if (url === "/") url = "/owner.html";
  if (url.startsWith("/api/")) {
    res.writeHead(404);
    res.end("{}");
    return;
  }
  const fp = path.join(ROOT, url);
  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(fp)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(0, async () => {
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  await page.goto(`http://localhost:${port}/owner.html`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));
  const overlayInfo = await page.evaluate(() => {
    const o = document.getElementById("mobileApproveOverlay");
    if (!o) return { exists: false };
    const ids = ["maBgImg", "maViewHint", "maCloseBtn", "maHistoryBtn", "maAvatar", "maName", "maPhone", "maMember", "maPenBtn", "maAmount", "maStatus", "maRejectBtn", "maAcceptBtn", "maEdit", "maEditInput", "maEditNote", "maEditCancel", "maEditSave", "maLightbox", "maLightboxClose", "maLightboxImg", "maToast", "maToastMsg", "maToastUndo"];
    const missing = ids.filter((id) => !document.getElementById(id));
    return { exists: true, hidden: o.classList.contains("hidden"), missing };
  });
  console.log("OVERLAY", JSON.stringify(overlayInfo));
  console.log("ERRORS", JSON.stringify(errors));
  await browser.close();
  server.close();
});

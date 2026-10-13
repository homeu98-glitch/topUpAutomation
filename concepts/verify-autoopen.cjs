const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("C:/Users/surface/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");

const ROOT = "C:/dev/macauPos/topUpAutomation/public";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const PNG1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQAY3Y2wAAAAAElFTkSuQmCC";

const mockPending = {
  id: "tx-1", customer_code: "63936541", customer_full_name: "陳大文", customer_phone: "6393 6541",
  total_amount: 110, status: "pending", submitted_at: new Date().toISOString(), item_count: 1,
  verificationStatus: "verified_amount_and_id",
  items: [{ previewUrl: PNG1, selectedAmount: 110, manualAmount: 110, extracted: { amount: 110 }, verificationStatus: "verified_amount_and_id", verificationBackofficeAmount: 110 }],
};

// cases: { name, width, hasPending, isMobile }
const CASES = [
  { name: "mobile + pending", width: 390, height: 844, hasPending: true, mobile: true },
  { name: "desktop + pending", width: 1280, height: 900, hasPending: true, mobile: false },
  { name: "mobile + no pending", width: 390, height: 844, hasPending: false, mobile: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runCase(c) {
  const server = http.createServer((req, res) => {
    let url = req.url.split("?")[0];
    if (url === "/") url = "/owner.html";
    const fp = path.join(ROOT, url);
    fs.readFile(fp, (err, data) => {
      if (err) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "Content-Type": types[path.extname(fp)] || "application/octet-stream" });
      res.end(data);
    });
  });

  return await new Promise((resolve) => {
    server.listen(0, async () => {
      const port = server.address().port;
      const browser = await puppeteer.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
      const page = await browser.newPage();
      await page.setViewport({ width: c.width, height: c.height, deviceScaleFactor: 2, isMobile: c.mobile });

      const apiSeen = [];
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const url = req.url();
        if (url.includes("/api/")) {
          let body = {};
          if (url.includes("/api/auth/me")) body = { user: { role: "owner", shopName: "表嫂美食", shopCode: "60000000", ownerLogin: "60000000" } };
          else if (url.includes("transactions")) body = { rows: c.hasPending ? [mockPending] : [], total: c.hasPending ? 1 : 0, page: 1, pageSize: 20, pageCount: 1 };
          else if (url.includes("settings")) body = { settings: {} };
          else if (url.includes("dashboard")) body = { stats: {} };
          else body = {};
          apiSeen.push(url.replace("https://top-up-automation.vercel.app", "") + " => " + JSON.stringify(body).slice(0, 60));
          // CORS headers so the browser accepts the (cross-origin, intercepted) response.
          // Fetch uses credentials:"include" so we must echo the exact Origin (wildcard '*' is rejected).
          const origin = req.headers()["origin"] || "*";
          return req.respond({
            status: 200,
            contentType: "application/json",
            headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" },
            body: JSON.stringify(body),
          });
        }
        req.continue();
      });
      page.on("console", (m) => { if (m.type() === "error") console.log(`  [${c.name}] CONSOLE ERROR`, m.text()); });
      page.on("pageerror", (e) => console.log(`  [${c.name}] PAGEERROR`, e.message));

      await page.goto(`http://localhost:${port}/owner.html`, { waitUntil: "networkidle0" });
      await sleep(1500);
      const info = await page.evaluate(() => ({
        overlayHidden: document.getElementById("mobileApproveOverlay").classList.contains("hidden"),
        mm: window.matchMedia("(max-width: 760px)").matches,
        cards: document.querySelectorAll(".owner-mobile-card").length,
        listChildren: document.getElementById("transactionList").childElementCount,
        maName: document.getElementById("maName").textContent,
        maAmount: document.getElementById("maAmount").textContent,
        appHidden: document.getElementById("ownerApp").classList.contains("hidden"),
      }));
      console.log(`\n=== ${c.name} ===`);
      console.log("  API SEEN:", JSON.stringify(apiSeen));
      console.log("  INFO:", JSON.stringify(info));
      const expectOpen = c.mobile && c.hasPending;
      const actualOpen = !info.overlayHidden;
      console.log(`  EXPECT overlay open=${expectOpen}  ACTUAL open=${actualOpen}  => ${expectOpen === actualOpen ? "PASS" : "FAIL"}`);
      await browser.close();
      server.close();
      resolve({ name: c.name, pass: expectOpen === actualOpen, info, apiSeen });
    });
  });
}

(async () => {
  const results = [];
  for (const c of CASES) results.push(await runCase(c));
  console.log("\n================ SUMMARY ================");
  let allPass = true;
  for (const r of results) { console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}`); if (!r.pass) allPass = false; }
  console.log(allPass ? "\nALL PASS" : "\nSOME FAILED");
})();

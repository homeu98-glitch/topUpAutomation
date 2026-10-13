const puppeteer = require("C:/Users/surface/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
const path = require("path");

const fileUrl = "file://" + path.resolve("concepts/mobile-approval-v2.html");
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-color-profile=srgb"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 3 });
  await page.goto(fileUrl, { waitUntil: "networkidle0" });
  await sleep(600);

  const shot = async (name) => {
    const el = await page.$(".phone");
    await el.screenshot({ path: `concepts/shot-v2-${name}.png` });
    console.log("captured", name);
  };

  // 1) Main sheet over customer receipt background
  await shot("main");

  // 2) Edit sheet open
  await page.click("#penBtn");
  await sleep(500);
  await shot("edit");

  // 3) History sheet open
  await page.click("#cancelEdit");
  await sleep(400);
  await page.click("#historyBtn");
  await sleep(500);
  await shot("history");

  // 4) Full-screen receipt viewer (lightbox)
  await page.click("#histBack");
  await sleep(400);
  await page.click("#lbHint");
  await sleep(400);
  await shot("lightbox");

  await browser.close();
  console.log("ALL DONE v2");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

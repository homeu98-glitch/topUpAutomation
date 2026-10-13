const puppeteer = require("C:/Users/surface/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
const path = require("path");

const fileUrl = "file://" + path.resolve("concepts/mobile-swipe-approval.html");
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const topCardEval = `
  (() => { const cs = document.querySelectorAll('.card'); return cs[cs.length-1]; })()
`;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-color-profile=srgb"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 3 });
  await page.goto(fileUrl, { waitUntil: "networkidle0" });
  await sleep(400);

  const shot = async (name) => {
    const el = await page.$(".phone");
    await el.screenshot({ path: `concepts/shot-${name}.png` });
    console.log("captured", name);
  };

  // 1) Front (default, verified card t1)
  await shot("front");

  // 2) Swipe-right accept overlay (center the stamp so it stays in frame)
  await page.evaluate(`(() => {
    const c = ${topCardEval};
    c.style.transform = "translateX(95px) rotate(6deg)";
    const ov = c.querySelector(".ov.accept");
    ov.style.opacity = 1;
    ov.style.left = "50%"; ov.style.right = "auto"; ov.style.top = "30%";
    ov.style.transform = "translateX(-50%) rotate(-8deg)";
  })()`);
  await sleep(200);
  await shot("accept");

  // reset transform for next
  await page.evaluate(`(() => {
    const c = ${topCardEval};
    c.style.transform = "";
    const ov = c.querySelector(".ov.accept");
    ov.style.opacity = 0; ov.style.left = "auto"; ov.style.right = "18px"; ov.style.top = "22px";
    ov.style.transform = "rotate(12deg)";
  })()`);
  await sleep(150);

  // 3) Edit back-face
  await page.evaluate(`(() => { const c = ${topCardEval}; c.classList.add("flipped"); })()`);
  await sleep(450);
  await shot("edit");

  // flip back
  await page.evaluate(`(() => { const c = ${topCardEval}; c.classList.remove("flipped"); })()`);
  await sleep(450);

  // 4) Swipe-left reject overlay (center the stamp so it stays in frame)
  await page.evaluate(`(() => {
    const c = ${topCardEval};
    c.style.transform = "translateX(-95px) rotate(-6deg)";
    const ov = c.querySelector(".ov.reject");
    ov.style.opacity = 1;
    ov.style.left = "auto"; ov.style.right = "50%"; ov.style.top = "30%";
    ov.style.transform = "translateX(50%) rotate(8deg)";
  })()`);
  await sleep(200);
  await shot("reject");

  // reset
  await page.evaluate(`(() => {
    const c = ${topCardEval};
    c.style.transform = "";
    const ov = c.querySelector(".ov.reject");
    ov.style.opacity = 0; ov.style.left = "18px"; ov.style.right = "auto"; ov.style.top = "22px";
    ov.style.transform = "rotate(-12deg)";
  })()`);
  await sleep(150);

  // 5) Advance to the "amount mismatch" card (t3) -> reject twice
  await page.click("#btnReject");
  await sleep(550);
  await page.click("#btnReject");
  await sleep(550);
  await shot("mismatch");

  await browser.close();
  console.log("ALL DONE");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

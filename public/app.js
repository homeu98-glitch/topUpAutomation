const fileInput = document.getElementById("fileInput");
const selectButton = document.getElementById("selectButton");
const fallbackSelectButton = document.getElementById("fallbackSelectButton");
const uploadButton = document.getElementById("uploadButton");
const introCard = document.getElementById("introCard");
const selectedCard = document.getElementById("selectedCard");
const selectedPreviewList = document.getElementById("selectedPreviewList");
const selectionCount = document.getElementById("selectionCount");
const loadingCard = document.getElementById("loadingCard");
const errorCard = document.getElementById("errorCard");
const resultCard = document.getElementById("resultCard");
const totalAmount = document.getElementById("totalAmount");
const sliderTrack = document.getElementById("sliderTrack");
const detailList = document.getElementById("detailList");
const imageDialog = document.getElementById("imageDialog");
const dialogImage = document.getElementById("dialogImage");
const closeDialogButton = document.getElementById("closeDialogButton");

let selectedFiles = [];
const statusBanner = document.getElementById("statusBanner");
const defaultUploadButtonText = uploadButton.textContent;

function resolveApiBaseUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("apiBaseUrl");
  const fromConfig = window.APP_CONFIG?.apiBaseUrl || "";
  return (fromQuery || fromConfig || "").replace(/\/$/, "");
}

const apiBaseUrl = resolveApiBaseUrl();

function getMemberCode() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("memberCode");
  return value && /^\d{8}$/.test(value) ? value : "";
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `MOP ${amount.toFixed(2)}`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function resetError() {
  errorCard.classList.add("hidden");
  errorCard.textContent = "";
}

function showError(message) {
  errorCard.textContent = message;
  errorCard.classList.remove("hidden");
}

function showStatus(message, type = "info") {
  if (!statusBanner) return;
  statusBanner.textContent = message;
  statusBanner.dataset.type = type;
  statusBanner.classList.remove("hidden");
}

function hideStatus() {
  if (!statusBanner) return;
  statusBanner.classList.add("hidden");
  statusBanner.textContent = "";
  delete statusBanner.dataset.type;
}

async function parseApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  const normalizedText = text.trim();

  if (
    normalizedText.toLowerCase().startsWith("<!doctype") ||
    normalizedText.toLowerCase().startsWith("<html") ||
    normalizedText.toLowerCase().includes("the page could not be found") ||
    normalizedText.toLowerCase().includes("cannot post /api/analyze")
  ) {
    throw new Error("目前前端頁面已打開，但後端 API 沒有正常運行。若你是用 GitHub Pages 開啟，圖片上傳功能不會工作，因為它需要 Node.js 後端。");
  }

  throw new Error(normalizedText || "伺服器回傳了非 JSON 格式內容，請檢查後端是否正常啟動。");
}

async function checkBackendAvailability(showInlineError = false) {
  const healthUrl = `${apiBaseUrl}/api/health`;

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) {
      throw new Error("health-check-failed");
    }

    hideStatus();
    return true;
  } catch {
    let message = "";
    if (window.location.hostname.endsWith("github.io")) {
      message =
        "你現在開的是 GitHub Pages 靜態頁面，這裡沒有 Node.js 後端，所以無法上傳辨識。請改用 Vercel 網址，或用 `?apiBaseUrl=你的後端網址` 連到真正的後端。";
    } else {
      message = "目前後端 API 未連通，請確認 Vercel 部署成功，且環境變數已設定完成。";
    }
    showStatus(message, "warning");
    if (showInlineError) {
      showError(message);
    }
    return false;
  }
}

function setUploadingState(isUploading, label = defaultUploadButtonText) {
  uploadButton.disabled = isUploading;
  uploadButton.textContent = label;
  loadingCard.classList.toggle("hidden", !isUploading);
}

function openPicker() {
  fileInput.click();
}

function renderSelectedFiles() {
  selectedPreviewList.innerHTML = "";

  if (!selectedFiles.length) {
    selectedCard.classList.add("hidden");
    introCard.classList.remove("hidden");
    return;
  }

  introCard.classList.add("hidden");
  selectedCard.classList.remove("hidden");
  selectionCount.textContent = `${selectedFiles.length} 張`;

  selectedFiles.forEach((file) => {
    const item = document.createElement("div");
    item.className = "selected-item";

    const image = document.createElement("img");
    image.src = URL.createObjectURL(file);
    image.alt = file.name;

    const body = document.createElement("div");
    body.className = "selected-item-body";
    body.innerHTML = `
      <div><strong>${file.name}</strong></div>
      <div class="field-note">${formatBytes(file.size)}</div>
    `;

    item.append(image, body);
    selectedPreviewList.appendChild(item);
  });
}

function createDetailRow(label, value, extraClass = "") {
  const row = document.createElement("tr");
  row.innerHTML = `
    <th>${label}</th>
    <td class="${extraClass}">${value ?? "未能辨識"}</td>
  `;
  return row;
}

function showImageDialog(src, alt) {
  dialogImage.src = src;
  dialogImage.alt = alt;
  imageDialog.showModal();
}

function renderResults(payload) {
  resultCard.classList.remove("hidden");
  totalAmount.textContent = formatCurrency(payload.totalAmount);
  sliderTrack.innerHTML = "";
  detailList.innerHTML = "";

  payload.items.forEach((item, index) => {
    const previewCard = document.createElement("div");
    previewCard.className = "slider-item";

    const button = document.createElement("button");
    button.type = "button";
    button.addEventListener("click", () => {
      showImageDialog(item.previewUrl, `交易截圖 ${index + 1}`);
    });

    const img = document.createElement("img");
    img.src = item.previewUrl;
    img.alt = `交易截圖 ${index + 1}`;

    const body = document.createElement("div");
    body.className = "slider-item-body";
    body.innerHTML = `
      <div><strong>第 ${index + 1} 張</strong></div>
      <div class="field-note">${item.fileName}</div>
    `;

    button.appendChild(img);
    previewCard.append(button, body);
    sliderTrack.appendChild(previewCard);

    const detailCard = document.createElement("section");
    detailCard.className = "card detail-card";

    const statusValue = item.extracted.orderStatus || "未能辨識";
    const statusClass = statusValue === "交易成功" ? "status-success" : "status-unknown";

    const table = document.createElement("table");
    const tbody = document.createElement("tbody");
    tbody.append(
      createDetailRow("商戶名稱", item.extracted.merchantName),
      createDetailRow("原交易訂單號", item.extracted.transactionOrderNo),
      createDetailRow("交易金額", item.extracted.amount),
      createDetailRow("實際交易時間", item.extracted.transactionTime),
      createDetailRow("訂單狀態", statusValue, statusClass),
      createDetailRow("支付方式", item.extracted.paymentMethod)
    );
    table.appendChild(tbody);

    const confidenceText =
      typeof item.extracted.confidence === "number"
        ? `辨識信心：${Math.round(item.extracted.confidence * 100)}%`
        : "辨識信心：未提供";

    detailCard.innerHTML = `
      <div class="section-header">
        <h3>交易明細 ${index + 1}</h3>
        <span class="pill">${formatCurrency(item.extracted.amount)}</span>
      </div>
      <p class="detail-note">${confidenceText}</p>
    `;
    detailCard.appendChild(table);

    const compressionNote = document.createElement("p");
    compressionNote.className = "compression-note";
    compressionNote.textContent = `壓縮後儲存：${formatBytes(item.originalSize)} → ${formatBytes(item.compressedSize)}`;
    detailCard.appendChild(compressionNote);

    detailList.appendChild(detailCard);
  });
}

async function uploadFiles() {
  resetError();

  if (!selectedFiles.length) {
    showError("請先選擇至少一張圖片。");
    return;
  }

  if (selectedFiles.length > 10) {
    showError("一次最多只可上傳 10 張圖片。");
    return;
  }

  setUploadingState(true, "檢查服務中...");

  const backendReady = await checkBackendAvailability(true);
  if (!backendReady) {
    setUploadingState(false);
    return;
  }

  setUploadingState(true, "辨識中...");

  try {
    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("images", file));

    const memberCode = getMemberCode();
    if (memberCode) {
      formData.append("memberCode", memberCode);
    }

    const response = await fetch(`${apiBaseUrl}/api/analyze`, {
      method: "POST",
      body: formData,
    });

    const payload = await parseApiResponse(response);
    if (!response.ok) {
      throw new Error(payload.error || "上傳失敗");
    }

    renderResults(payload);
  } catch (error) {
    showError(error instanceof Error ? error.message : "系統錯誤，請稍後再試。");
  } finally {
    setUploadingState(false);
  }
}

selectButton.addEventListener("click", openPicker);
fallbackSelectButton.addEventListener("click", openPicker);
uploadButton.addEventListener("click", uploadFiles);

fileInput.addEventListener("change", (event) => {
  resetError();

  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  if (files.length > 10) {
    showError("一次最多只可選擇 10 張圖片。");
    fileInput.value = "";
    return;
  }

  selectedFiles = files;
  renderSelectedFiles();
});

closeDialogButton.addEventListener("click", () => imageDialog.close());
imageDialog.addEventListener("click", (event) => {
  const rect = imageDialog.getBoundingClientRect();
  const clickedInside =
    rect.top <= event.clientY &&
    event.clientY <= rect.top + rect.height &&
    rect.left <= event.clientX &&
    event.clientX <= rect.left + rect.width;

  if (!clickedInside) {
    imageDialog.close();
  }
});

window.addEventListener("load", () => {
  checkBackendAvailability();
  setTimeout(() => {
    openPicker();
  }, 350);
});

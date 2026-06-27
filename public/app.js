const apiBaseUrl = (() => {
  const params = new URLSearchParams(window.location.search);
  return (params.get("apiBaseUrl") || window.APP_CONFIG?.apiBaseUrl || "").replace(/\/$/, "");
})();

const state = {
  shops: [],
  user: null,
  selectedFiles: [],
  analyzedPayload: null,
  authMode: "customer",
};

const fileInput = document.getElementById("fileInput");
const shopSelect = document.getElementById("shopSelect");
const memberCodeInput = document.getElementById("memberCodeInput");
const customerPasswordInput = document.getElementById("customerPasswordInput");
const customerLoginButton = document.getElementById("customerLoginButton");
const ownerCodeInput = document.getElementById("ownerCodeInput");
const ownerPasswordInput = document.getElementById("ownerPasswordInput");
const ownerLoginButton = document.getElementById("ownerLoginButton");
const customerModeButton = document.getElementById("customerModeButton");
const ownerModeButton = document.getElementById("ownerModeButton");
const customerLoginPane = document.getElementById("customerLoginPane");
const ownerLoginPane = document.getElementById("ownerLoginPane");
const customerLoginCard = document.getElementById("customerLoginCard");
const customerInfoCard = document.getElementById("customerInfoCard");
const customerPortal = document.getElementById("customerPortal");
const customerLogoutButton = document.getElementById("customerLogoutButton");
const currentMemberBadge = document.getElementById("currentMemberBadge");
const selectButton = document.getElementById("selectButton");
const fallbackSelectButton = document.getElementById("fallbackSelectButton");
const uploadButton = document.getElementById("uploadButton");
const confirmResultButton = document.getElementById("confirmResultButton");
const submitStatusCard = document.getElementById("submitStatusCard");
const introCard = document.getElementById("introCard");
const selectedCard = document.getElementById("selectedCard");
const selectedPreviewList = document.getElementById("selectedPreviewList");
const selectionCount = document.getElementById("selectionCount");
const loadingCard = document.getElementById("loadingCard");
const errorCard = document.getElementById("errorCard");
const resultCard = document.getElementById("resultCard");
const totalAmount = document.getElementById("totalAmount");
const detailList = document.getElementById("detailList");
const statusBanner = document.getElementById("statusBanner");
const imageDialog = document.getElementById("imageDialog");
const dialogImage = document.getElementById("dialogImage");
const closeDialogButton = document.getElementById("closeDialogButton");
const defaultUploadButtonText = uploadButton.textContent;
const defaultConfirmButtonText = confirmResultButton.textContent;

function formatCurrency(value) {
  return `MOP ${Number(value || 0).toFixed(2)}`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function showError(message) {
  errorCard.textContent = message;
  errorCard.classList.remove("hidden");
}

function resetError() {
  errorCard.classList.add("hidden");
  errorCard.textContent = "";
}

function showStatus(message, type = "info") {
  statusBanner.textContent = message;
  statusBanner.dataset.type = type;
  statusBanner.classList.remove("hidden");
}

function hideStatus() {
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
  throw new Error(text || "伺服器回傳格式錯誤");
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await parseApiResponse(response);
  if (!response.ok) {
    throw new Error(payload.error || "請求失敗");
  }
  return payload;
}

function setUploadingState(isUploading, label = defaultUploadButtonText) {
  uploadButton.disabled = isUploading;
  uploadButton.textContent = label;
  loadingCard.classList.toggle("hidden", !isUploading);
}

function setConfirmState(isSubmitting, label = defaultConfirmButtonText) {
  confirmResultButton.disabled = isSubmitting || !state.analyzedPayload;
  confirmResultButton.textContent = label;
}

function showImageDialog(src, alt) {
  dialogImage.src = src;
  dialogImage.alt = alt;
  imageDialog.showModal();
}

function resetResults() {
  state.analyzedPayload = null;
  resultCard.classList.add("hidden");
  detailList.innerHTML = "";
  totalAmount.textContent = formatCurrency(0);
  submitStatusCard.classList.add("hidden");
  submitStatusCard.textContent = "";
  setConfirmState(false);
}

function renderShopOptions() {
  shopSelect.innerHTML = state.shops
    .map((shop) => `<option value="${shop.id}">${shop.name}</option>`)
    .join("");

  const selectedShopId = shopSelect.value || state.user?.shopId || state.shops[0]?.id || "";
  if (selectedShopId) {
    shopSelect.value = selectedShopId;
  }
}

function renderAuthMode() {
  const isCustomer = state.authMode === "customer";
  customerModeButton.classList.toggle("active", isCustomer);
  ownerModeButton.classList.toggle("active", !isCustomer);
  customerLoginPane.classList.toggle("hidden", !isCustomer);
  ownerLoginPane.classList.toggle("hidden", isCustomer);
}

function renderCustomerSession() {
  const isLoggedIn = state.user?.role === "customer";
  customerLoginCard.classList.toggle("hidden", isLoggedIn);
  customerInfoCard.classList.toggle("hidden", !isLoggedIn);
  customerPortal.classList.toggle("hidden", !isLoggedIn);

  if (!isLoggedIn) {
    currentMemberBadge.textContent = "未登入";
    return;
  }

  currentMemberBadge.textContent = `會員 ${state.user.memberCode}`;
  renderShopOptions();
}

function createDetailRow(label, value, extraClass = "") {
  const row = document.createElement("tr");
  row.innerHTML = `<th>${label}</th><td class="${extraClass}">${value ?? "未能辨識"}</td>`;
  return row;
}

function renderSelectedFiles() {
  selectedPreviewList.innerHTML = "";

  if (!state.selectedFiles.length) {
    selectedCard.classList.add("hidden");
    introCard.classList.remove("hidden");
    return;
  }

  introCard.classList.add("hidden");
  selectedCard.classList.remove("hidden");
  selectionCount.textContent = `${state.selectedFiles.length} 張`;

  state.selectedFiles.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "selected-item";

    const previewUrl = URL.createObjectURL(file);
    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "selected-item-button";
    previewButton.addEventListener("click", () => showImageDialog(previewUrl, file.name));

    const image = document.createElement("img");
    image.src = previewUrl;
    image.alt = file.name;
    previewButton.appendChild(image);

    const badge = document.createElement("div");
    badge.className = "selected-item-badge";
    badge.textContent = `交易明細 ${index + 1}`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "selected-item-remove";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `刪除 ${file.name}`);
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      state.selectedFiles = state.selectedFiles.filter((_, fileIndex) => fileIndex !== index);
      fileInput.value = "";
      resetResults();
      renderSelectedFiles();
    });

    const body = document.createElement("div");
    body.className = "selected-item-body";
    body.innerHTML = `<div><strong>${file.name}</strong></div><div class="field-note">${formatBytes(file.size)}</div>`;

    item.append(previewButton, badge, removeButton, body);
    selectedPreviewList.appendChild(item);
  });
}

function renderResults(payload) {
  state.analyzedPayload = payload;
  resultCard.classList.remove("hidden");
  submitStatusCard.classList.add("hidden");
  totalAmount.textContent = formatCurrency(payload.totalAmount);
  detailList.innerHTML = "";
  setConfirmState(false);

  payload.items.forEach((item, index) => {
    const card = document.createElement("section");
    card.className = "card detail-card compact-card";

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

    card.innerHTML = `
      <div class="section-header">
        <h3>交易明細 ${index + 1}</h3>
        <span class="pill">${formatCurrency(item.extracted.amount)}</span>
      </div>
      <p class="detail-note">辨識信心：${typeof item.extracted.confidence === "number" ? `${Math.round(item.extracted.confidence * 100)}%` : "未提供"}</p>
      <p class="detail-note">金額判定：${item.extracted.amountReason || "取候選金額中的最大值"}</p>
    `;
    card.appendChild(table);
    detailList.appendChild(card);
  });
}

async function checkBackendAvailability(showInlineError = false) {
  try {
    await apiFetch("/api/health");
    hideStatus();
    return true;
  } catch {
    const message = "目前後端 API 未連通，請確認 Vercel 部署成功，且環境變數已設定完成。";
    showStatus(message, "warning");
    if (showInlineError) showError(message);
    return false;
  }
}

async function loadShops() {
  try {
    const payload = await apiFetch("/api/shops");
    state.shops = payload.shops || [];
  } catch {
    state.shops = [{ id: "fallback-shop", name: "表嫂美食" }];
  }
  renderShopOptions();
}

async function loadSession() {
  const payload = await apiFetch("/api/auth/me");
  state.user = payload.user;
  if (state.user?.role === "owner") {
    window.location.href = "/owner.html";
    return;
  }
  renderCustomerSession();
}

async function loginCustomer(memberCode = memberCodeInput.value.trim(), password = customerPasswordInput.value.trim(), silent = false) {
  resetError();

  if (!/^\d{8}$/.test(memberCode)) {
    showError("請輸入 8 位會員編號");
    return;
  }
  if (!/^\d{4}$/.test(password)) {
    showError("請輸入 4 位密碼");
    return;
  }

  customerLoginButton.disabled = true;
  try {
    const payload = await apiFetch("/api/auth/customer-login", {
      method: "POST",
      body: JSON.stringify({
        memberCode,
        password,
      }),
    });
    state.user = payload.user;
    renderCustomerSession();
    if (!silent) {
      showStatus("登入成功，請先選擇充值店舖，再上傳付款截圖。", "info");
      setTimeout(() => openPicker(), 250);
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "登入失敗");
  } finally {
    customerLoginButton.disabled = false;
  }
}

async function logoutCustomer() {
  await apiFetch("/api/auth/logout", { method: "POST" });
  state.user = null;
  state.selectedFiles = [];
  memberCodeInput.value = "";
  customerPasswordInput.value = "";
  resetResults();
  renderSelectedFiles();
  renderCustomerSession();
  showStatus("已登出", "info");
}

function openPicker() {
  if (state.user?.role !== "customer") {
    showError("請先登入客戶帳號");
    return;
  }
  fileInput.click();
}

async function analyzeFiles() {
  resetError();
  submitStatusCard.classList.add("hidden");

  if (!state.selectedFiles.length) {
    showError("請先選擇至少一張圖片。");
    return;
  }

  if (!shopSelect.value || shopSelect.value === "fallback-shop") {
    showError("請先選擇有效店舖。");
    return;
  }

  setUploadingState(true, "檢查服務中...");
  const ready = await checkBackendAvailability(true);
  if (!ready) {
    setUploadingState(false);
    return;
  }

  setUploadingState(true, "辨識中...");

  try {
    const formData = new FormData();
    state.selectedFiles.forEach((file) => formData.append("images", file));
    if (state.user?.memberCode) {
      formData.append("memberCode", state.user.memberCode);
    }

    const response = await fetch(`${apiBaseUrl}/api/analyze`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const payload = await parseApiResponse(response);
    if (!response.ok) throw new Error(payload.error || "辨識失敗");
    renderResults(payload);
  } catch (error) {
    showError(error instanceof Error ? error.message : "系統錯誤，請稍後再試。");
  } finally {
    setUploadingState(false);
  }
}

async function submitForApproval() {
  resetError();
  if (!state.analyzedPayload || !state.selectedFiles.length) {
    showError("請先完成辨識再送審");
    return;
  }
  if (!shopSelect.value || shopSelect.value === "fallback-shop") {
    showError("請先選擇有效店舖。");
    return;
  }

  setConfirmState(true, "送審中...");
  try {
    const formData = new FormData();
    state.selectedFiles.forEach((file) => formData.append("images", file));
    formData.append("analyzedData", JSON.stringify(state.analyzedPayload));
    formData.append("shopId", shopSelect.value);

    const response = await fetch(`${apiBaseUrl}/api/customer/submit`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const payload = await parseApiResponse(response);
    if (!response.ok) throw new Error(payload.error || "送審失敗");

    submitStatusCard.textContent = `已成功送交店主審核。交易編號：${payload.transactionId}`;
    submitStatusCard.classList.remove("hidden");
    setConfirmState(true, "已送審");
  } catch (error) {
    setConfirmState(false);
    showError(error instanceof Error ? error.message : "送審失敗");
  }
}

async function loginOwnerFromMain() {
  resetError();
  if (!/^\d{8}$/.test(ownerCodeInput.value.trim())) {
    showError("請輸入 8 位店主帳號");
    return;
  }
  if (!/^\d{4}$/.test(ownerPasswordInput.value.trim())) {
    showError("請輸入 4 位密碼");
    return;
  }

  ownerLoginButton.disabled = true;
  try {
    await apiFetch("/api/auth/owner-login", {
      method: "POST",
      body: JSON.stringify({
        login: ownerCodeInput.value.trim(),
        password: ownerPasswordInput.value.trim(),
      }),
    });
    window.location.href = "/owner.html";
  } catch (error) {
    showError(error instanceof Error ? error.message : "店主登入失敗");
  } finally {
    ownerLoginButton.disabled = false;
  }
}

async function optimizeImageFile(file) {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1080;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.75));
    bitmap.close?.();
    if (!blob || blob.size >= file.size) {
      return file;
    }
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

async function optimizeSelectedFiles(files) {
  showStatus("正在優化圖片大小，以加快辨識速度...", "info");
  const optimizedFiles = await Promise.all(files.map((file) => optimizeImageFile(file)));
  hideStatus();
  return optimizedFiles;
}

shopSelect.addEventListener("change", async () => {
  if (state.user?.role === "customer") {
    const selectedShop = state.shops.find((shop) => shop.id === shopSelect.value);
    if (selectedShop) {
      showStatus(`已選擇店舖：${selectedShop.name}`, "info");
    }
  }
});

customerLoginButton.addEventListener("click", () => loginCustomer());
ownerLoginButton.addEventListener("click", loginOwnerFromMain);
customerLogoutButton.addEventListener("click", logoutCustomer);
selectButton.addEventListener("click", openPicker);
fallbackSelectButton.addEventListener("click", openPicker);
uploadButton.addEventListener("click", analyzeFiles);
confirmResultButton.addEventListener("click", submitForApproval);
customerModeButton.addEventListener("click", () => {
  state.authMode = "customer";
  renderAuthMode();
});
ownerModeButton.addEventListener("click", () => {
  state.authMode = "owner";
  renderAuthMode();
});

fileInput.addEventListener("change", async (event) => {
  resetError();
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  if (files.length > 10) {
    showError("一次最多只可選擇 10 張圖片。");
    fileInput.value = "";
    return;
  }

  state.selectedFiles = await optimizeSelectedFiles(files);
  resetResults();
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

  if (!clickedInside) imageDialog.close();
});

window.addEventListener("load", async () => {
  try {
    renderAuthMode();
    await Promise.all([loadShops(), loadSession(), checkBackendAvailability()]);
  } catch (error) {
    showError(error instanceof Error ? error.message : "初始化失敗");
  }
});

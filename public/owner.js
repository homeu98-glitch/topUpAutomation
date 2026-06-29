const apiBaseUrl = (() => {
  const params = new URLSearchParams(window.location.search);
  return (params.get("apiBaseUrl") || window.APP_CONFIG?.apiBaseUrl || "").replace(/\/$/, "");
})();

const state = {
  user: null,
  mode: "pending",
  page: 1,
  pageSize: "20",
  total: 0,
  pageCount: 1,
  transactions: [],
  selectedIds: new Set(),
  autoApproveEnabled: false,
  autoApproveIntervalSeconds: 300,
  authBooting: true,
  searchTerm: "",
  pendingCount: 0,
  isLoadingOwnerData: false,
  autoApproveRemainingSeconds: 0,
};
const OWNER_POLL_INTERVAL_MS = 3000;
let ownerPollTimer = null;
let statusHideTimer = null;
let autoApproveCountdownTimer = null;

const ownerStatusBanner = document.getElementById("ownerStatusBanner");
const ownerErrorCard = document.getElementById("ownerErrorCard");
const ownerAuthBootCard = document.getElementById("ownerAuthBootCard");
const ownerHeaderSession = document.getElementById("ownerHeaderSession");
const ownerLoginCard = document.getElementById("ownerLoginCard");
const ownerApp = document.getElementById("ownerApp");
const ownerLoginInput = document.getElementById("ownerLoginInput");
const ownerPasswordInput = document.getElementById("ownerPasswordInput");
const ownerLoginButton = document.getElementById("ownerLoginButton");
const ownerLogoutButton = document.getElementById("ownerLogoutButton");
const autoApproveButton = document.getElementById("autoApproveButton");
const pendingTabBadge = document.getElementById("pendingTabBadge");
const ownerShopBadge = document.getElementById("ownerShopBadge");
const ownerLoginBadge = document.getElementById("ownerLoginBadge");
const customerSearchInput = document.getElementById("customerSearchInput");
const customerSearchButton = document.getElementById("customerSearchButton");
const customerSearchClearButton = document.getElementById("customerSearchClearButton");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const batchApproveButton = document.getElementById("batchApproveButton");
const refreshDashboardButton = document.getElementById("refreshDashboardButton");
const pendingTabButton = document.getElementById("pendingTabButton");
const historyTabButton = document.getElementById("historyTabButton");
const dashboardCards = document.getElementById("dashboardCards");
const transactionTableBody = document.getElementById("transactionTableBody");
const selectAllCheckbox = document.getElementById("selectAllCheckbox");
const prevPageButton = document.getElementById("prevPageButton");
const nextPageButton = document.getElementById("nextPageButton");
const paginationInfo = document.getElementById("paginationInfo");
const ownerImageDialog = document.getElementById("ownerImageDialog");
const ownerDialogImage = document.getElementById("ownerDialogImage");
const ownerCloseDialogButton = document.getElementById("ownerCloseDialogButton");
const ownerDetailDialog = document.getElementById("ownerDetailDialog");
const ownerDetailContent = document.getElementById("ownerDetailContent");
const ownerCloseDetailButton = document.getElementById("ownerCloseDetailButton");
const autoApproveDialog = document.getElementById("autoApproveDialog");
const closeAutoApproveDialogButton = document.getElementById("closeAutoApproveDialogButton");
const autoApproveStateBadge = document.getElementById("autoApproveStateBadge");
const autoApproveIntervalInput = document.getElementById("autoApproveIntervalInput");
const disableAutoApproveButton = document.getElementById("disableAutoApproveButton");
const confirmAutoApproveButton = document.getElementById("confirmAutoApproveButton");
const ownerLoadingOverlay = document.getElementById("ownerLoadingOverlay");
const ownerLoadingText = document.getElementById("ownerLoadingText");

function formatCurrency(value) {
  return `MOP ${Number(value || 0).toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-Hant");
}

function showError(message) {
  ownerErrorCard.textContent = message;
  ownerErrorCard.classList.remove("hidden");
}

function resetError() {
  ownerErrorCard.classList.add("hidden");
  ownerErrorCard.textContent = "";
}

function showStatus(message, durationMs = 0) {
  if (statusHideTimer) {
    clearTimeout(statusHideTimer);
    statusHideTimer = null;
  }
  ownerStatusBanner.textContent = message;
  ownerStatusBanner.classList.remove("hidden");
  if (durationMs > 0) {
    statusHideTimer = setTimeout(() => {
      hideStatus();
    }, durationMs);
  }
}

function hideStatus() {
  if (statusHideTimer) {
    clearTimeout(statusHideTimer);
    statusHideTimer = null;
  }
  ownerStatusBanner.classList.add("hidden");
  ownerStatusBanner.textContent = "";
}

function setOwnerLoading(visible, text = "正在刷新資料...") {
  ownerLoadingText.textContent = text;
  ownerLoadingOverlay.classList.toggle("hidden", !visible);
}

function extractMembershipToken() {
  const query = new URLSearchParams(window.location.search);
  if (query.get("membershipToken")) return query.get("membershipToken");
  if (query.get("token")) return query.get("token");
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  return hashParams.get("membershipToken") || hashParams.get("token") || "";
}

function clearMembershipTokenFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("membershipToken");
  url.searchParams.delete("token");
  url.hash = "";
  window.history.replaceState({}, document.title, url.toString());
}

function setAuthBooting(isBooting) {
  state.authBooting = isBooting;
  document.body.classList.toggle("owner-auth-booting", isBooting);
  ownerAuthBootCard.classList.toggle("hidden", !isBooting);
}

function showImageDialog(src, alt) {
  ownerDialogImage.src = src;
  ownerDialogImage.alt = alt;
  ownerImageDialog.showModal();
}

function showDetailDialog(transaction) {
  ownerDetailContent.innerHTML = `
    <div class="section-header">
      <h3>交易明細</h3>
      <span class="pill">${transaction.customer_code}</span>
    </div>
    <div class="detail-edit-summary">
      <label class="edit-field prominent-edit-field">
        <span>總金額</span>
        <input id="detailTotalAmountInput" class="text-input" type="number" min="0" step="0.01" value="${Number(transaction.total_amount || 0).toFixed(2)}" />
      </label>
      <div class="detail-dialog-actions">
        <button id="saveDetailButton" class="secondary-button" type="button">儲存修改</button>
        ${transaction.status === "pending" ? `<button id="saveAndApproveButton" class="primary-button" type="button">儲存並核准</button>` : ""}
      </div>
    </div>
    <div class="detail-list owner-detail-list">
      ${(transaction.items || [])
        .map(
          (item, index) => `
            <section class="card compact-card owner-detail-card">
              <div class="section-header">
                <h3>交易明細 ${index + 1}</h3>
                <span class="pill">${formatCurrency(item?.extracted?.amount)}</span>
              </div>
              <div class="owner-item-grid">
                <button class="thumb-button detail-thumb-button" type="button" data-src="${item.previewUrl}" data-alt="交易明細 ${index + 1}">
                  <img src="${item.previewUrl}" alt="交易明細 ${index + 1}" />
                </button>
                <span>客戶提交金額：${formatCurrency(item?.selectedAmount || item?.manualAmount || item?.extracted?.amount)}</span>
                <label class="edit-field prominent-edit-field">
                  <span>可編輯金額</span>
                  <input class="text-input detail-amount-input" type="number" min="0" step="0.01" data-index="${index}" value="${Number(item?.extracted?.amount || 0).toFixed(2)}" />
                </label>
                <span>商戶：${item?.extracted?.merchantName || "-"}</span>
                <span>訂單號：${item?.extracted?.transactionOrderNo || "-"}</span>
                <span>金額：${item?.extracted?.amount || "-"}</span>
                <span>時間：${item?.extracted?.transactionTime || "-"}</span>
                <span>狀態：${item?.extracted?.orderStatus || "-"}</span>
                <span>支付方式：${item?.extracted?.paymentMethod || "-"}</span>
                ${item?.validation?.isShopMismatch ? `<span class="warning-text">商戶名稱與店舖名稱不完全一致，請人工確認</span>` : ""}
                ${item?.validation?.isAbnormal ? `<span class="warning-text">aborormal：缺少 ${item.validation.missingKeys?.join("、") || "關鍵資料"}</span>` : ""}
              </div>
            </section>
          `
        )
        .join("")}
    </div>
  `;
  ownerDetailDialog.showModal();
  ownerDetailContent.querySelectorAll(".detail-thumb-button").forEach((button) => {
    button.addEventListener("click", () => showImageDialog(button.dataset.src, button.dataset.alt || "交易圖片"));
  });
  const totalInput = ownerDetailContent.querySelector("#detailTotalAmountInput");
  const amountInputs = [...ownerDetailContent.querySelectorAll(".detail-amount-input")];
  amountInputs.forEach((input) => {
    input.addEventListener("input", () => {
      if (totalInput?.dataset.manual === "true") return;
      const sum = amountInputs.reduce((acc, current) => acc + Number(current.value || 0), 0);
      totalInput.value = sum.toFixed(2);
    });
  });
  totalInput?.addEventListener("input", () => {
    totalInput.dataset.manual = "true";
  });
  ownerDetailContent.querySelector("#saveDetailButton")?.addEventListener("click", () => {
    saveDetailChanges(transaction.id, false);
  });
  ownerDetailContent.querySelector("#saveAndApproveButton")?.addEventListener("click", () => {
    saveDetailChanges(transaction.id, true);
  });
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

function renderOwnerSession() {
  const isLoggedIn = state.user?.role === "owner";
  if (state.authBooting) {
    ownerLoginCard.classList.add("hidden");
    ownerApp.classList.add("hidden");
    ownerHeaderSession.classList.add("hidden");
    return;
  }
  ownerLoginCard.classList.toggle("hidden", isLoggedIn);
  ownerApp.classList.toggle("hidden", !isLoggedIn);
  ownerHeaderSession.classList.toggle("hidden", !isLoggedIn);

  if (!isLoggedIn) {
    ownerShopBadge.textContent = "未登入";
    ownerLoginBadge.textContent = "-";
    return;
  }

  ownerShopBadge.textContent = state.user.shopName || "未命名店舖";
  ownerLoginBadge.textContent = state.user.ownerLogin || "-";
  autoApproveButton.textContent = state.autoApproveEnabled
    ? `自動核准中（${Math.max(0, state.autoApproveRemainingSeconds || state.autoApproveIntervalSeconds)} 秒）`
    : "設定自動核准";
  pendingTabBadge.textContent = String(state.pendingCount || 0);
  pendingTabBadge.classList.toggle("hidden", !state.pendingCount);
}

function syncAutoApproveDialog() {
  autoApproveStateBadge.textContent = state.autoApproveEnabled ? "已啟用" : "未啟用";
  autoApproveIntervalInput.value = String(state.autoApproveIntervalSeconds || 300);
  disableAutoApproveButton.classList.toggle("hidden", !state.autoApproveEnabled);
}

function stopAutoApproveCountdown() {
  if (autoApproveCountdownTimer) {
    clearInterval(autoApproveCountdownTimer);
    autoApproveCountdownTimer = null;
  }
}

function resetAutoApproveCountdown() {
  state.autoApproveRemainingSeconds = Math.max(1, Number(state.autoApproveIntervalSeconds) || 300);
  renderOwnerSession();
}

function startAutoApproveCountdown() {
  stopAutoApproveCountdown();
  if (state.user?.role !== "owner" || !state.autoApproveEnabled) return;
  if (!state.autoApproveRemainingSeconds || state.autoApproveRemainingSeconds > state.autoApproveIntervalSeconds) {
    resetAutoApproveCountdown();
  }

  autoApproveCountdownTimer = setInterval(async () => {
    if (document.hidden || state.isLoadingOwnerData) return;
    state.autoApproveRemainingSeconds = Math.max(0, state.autoApproveRemainingSeconds - 1);
    renderOwnerSession();

    if (state.autoApproveRemainingSeconds > 0) return;

    stopAutoApproveCountdown();
    const ok = await loadOwnerData({
      showOverlay: true,
      loadingText: "自動核准中，正在刷新資料...",
      runAutoApprove: true,
    });
    if (ok && state.autoApproveEnabled) {
      resetAutoApproveCountdown();
      startAutoApproveCountdown();
    }
  }, 1000);
}

function renderDashboard(stats) {
  dashboardCards.innerHTML = `
    <article class="card stat-card"><div class="summary-label">上傳筆數</div><div class="summary-value small-value">${stats.uploadCount}</div></article>
    <article class="card stat-card"><div class="summary-label">上傳客戶數</div><div class="summary-value small-value">${stats.customerCount}</div></article>
    <article class="card stat-card"><div class="summary-label">充值總額</div><div class="summary-value small-value">${formatCurrency(stats.totalAmount)}</div></article>
    <article class="card stat-card"><div class="summary-label">已核准總額</div><div class="summary-value small-value">${formatCurrency(stats.approvedAmount)}</div></article>
    <article class="card stat-card"><div class="summary-label">已拒絕筆數</div><div class="summary-value small-value">${stats.rejectedCount}</div></article>
  `;
}

function renderPagination() {
  paginationInfo.textContent =
    state.pageSize === "all"
      ? `共 ${state.total} 筆`
      : `第 ${state.page} / ${state.pageCount} 頁，共 ${state.total} 筆`;
  prevPageButton.disabled = state.page <= 1 || state.pageSize === "all";
  nextPageButton.disabled = state.page >= state.pageCount || state.pageSize === "all";
}

function renderTransactions(transactions) {
  if (!transactions.length) {
    const emptyLabel = state.searchTerm ? "搜尋結果" : state.mode === "pending" ? "待審核" : "歷史";
    transactionTableBody.innerHTML = `<tr><td colspan="8"><div class="empty-state">目前沒有${emptyLabel}資料。</div></td></tr>`;
    renderPagination();
    selectAllCheckbox.checked = false;
    batchApproveButton.disabled = true;
    return;
  }

  transactionTableBody.innerHTML = transactions
    .map(
      (transaction) => `
        <tr>
          <td>
            ${transaction.status === "pending" ? `<input class="row-checkbox" data-id="${transaction.id}" type="checkbox" ${state.selectedIds.has(transaction.id) ? "checked" : ""} />` : ""}
          </td>
          <td>${formatDateTime(transaction.submitted_at)}</td>
          <td>${transaction.customer_code}</td>
          <td>
            <div class="thumb-list">
              ${(transaction.items || [])
              .map(
                (item, index) => `
                  <div class="thumb-with-amount">
                    <button class="thumb-button" type="button" data-src="${item.previewUrl}" data-alt="交易明細 ${index + 1}">
                      <img src="${item.previewUrl}" alt="交易明細 ${index + 1}" />
                    </button>
                    <span class="thumb-amount">${formatCurrency(item?.selectedAmount || item?.manualAmount || item?.extracted?.amount)}</span>
                  </div>
                `
              )
              .join("")}
            </div>
          </td>
          <td>${transaction.item_count}</td>
          <td>${formatCurrency(transaction.total_amount)}</td>
          <td>
            <div class="status-stack">
              <span class="pill ${transaction.status === "approved" ? "approved-pill" : transaction.status === "rejected" ? "rejected-pill" : ""}">${transaction.status === "approved" ? "已核准" : transaction.status === "rejected" ? "已拒絕" : "待審核"}</span>
              ${
                (transaction.items || []).some((item) => item?.validation?.isAbnormal)
                  ? `<span class="warning-text">aborormal</span>`
                  : ""
              }
            </div>
          </td>
          <td>
            <div class="table-actions">
              <button class="secondary-button detail-button" data-id="${transaction.id}" type="button">明細</button>
              ${transaction.status === "pending" ? `<button class="primary-button approve-button" data-id="${transaction.id}" type="button">核准</button>` : ""}
              ${transaction.status === "pending" ? `<button class="secondary-button reject-button" data-id="${transaction.id}" type="button">拒絕</button>` : ""}
              ${transaction.status === "rejected" ? `<button class="secondary-button revoke-button" data-id="${transaction.id}" type="button">撤回</button>` : ""}
            </div>
          </td>
        </tr>
      `
    )
    .join("");

  renderPagination();
  selectAllCheckbox.checked =
    transactions.length > 0 &&
    transactions.every((transaction) => transaction.status !== "pending" || state.selectedIds.has(transaction.id));
  batchApproveButton.disabled = !state.selectedIds.size || (state.mode !== "pending" && !state.searchTerm);

  transactionTableBody.querySelectorAll(".thumb-button").forEach((button) => {
    button.addEventListener("click", () => {
      showImageDialog(button.dataset.src, button.dataset.alt || "交易圖片");
    });
  });

  transactionTableBody.querySelectorAll(".detail-button").forEach((button) => {
    button.addEventListener("click", () => {
      const transaction = state.transactions.find((row) => row.id === button.dataset.id);
      if (transaction) {
        showDetailDialog(transaction);
      }
    });
  });

  transactionTableBody.querySelectorAll(".row-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.selectedIds.add(checkbox.dataset.id);
      } else {
        state.selectedIds.delete(checkbox.dataset.id);
      }
      batchApproveButton.disabled = !state.selectedIds.size || state.mode !== "pending";
    });
  });

  transactionTableBody.querySelectorAll(".approve-button").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        await apiFetch("/api/owner/approve", {
          method: "POST",
          body: JSON.stringify({ transactionId: button.dataset.id }),
        });
        await loadOwnerData({ showOverlay: true, loadingText: "正在核准並刷新資料...", showRefreshStatus: true });
      } catch (error) {
        showError(error instanceof Error ? error.message : "核准失敗");
        button.disabled = false;
      }
    });
  });

  transactionTableBody.querySelectorAll(".reject-button").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        await apiFetch("/api/owner/reject", {
          method: "POST",
          body: JSON.stringify({ transactionId: button.dataset.id }),
        });
        await loadOwnerData({ showOverlay: true, loadingText: "正在拒絕並刷新資料...", showRefreshStatus: true });
      } catch (error) {
        showError(error instanceof Error ? error.message : "拒絕失敗");
        button.disabled = false;
      }
    });
  });

  transactionTableBody.querySelectorAll(".revoke-button").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        await apiFetch("/api/owner/revoke", {
          method: "POST",
          body: JSON.stringify({ transactionId: button.dataset.id }),
        });
        await loadOwnerData({ showOverlay: true, loadingText: "正在撤回並刷新資料...", showRefreshStatus: true });
      } catch (error) {
        showError(error instanceof Error ? error.message : "撤回失敗");
        button.disabled = false;
      }
    });
  });
}

async function runOwnerAutoApprovalSweep() {
  if (!state.autoApproveEnabled) {
    return { approvedCount: 0 };
  }
  try {
    return await apiFetch("/api/owner/auto-approve-sweep", {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch {
    return { approvedCount: 0 };
  }
}

async function loadOwnerData(options = {}) {
  const {
    showOverlay = false,
    loadingText = "正在刷新資料...",
    showRefreshStatus = false,
    runAutoApprove = false,
  } = options;

  if (state.isLoadingOwnerData) return;
  state.isLoadingOwnerData = true;
  if (showOverlay) {
    setOwnerLoading(true, loadingText);
  }
  resetError();
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.searchTerm) {
    params.set("customerCode", state.searchTerm);
  }

  const transactionQuery = new URLSearchParams({
    ...Object.fromEntries(params),
    mode: state.searchTerm ? "all" : state.mode,
  });

  try {
    let sweepResult = { approvedCount: 0 };
    if (runAutoApprove && state.autoApproveEnabled) {
      sweepResult = await runOwnerAutoApprovalSweep();
      if ((sweepResult.approvedCount || 0) > 0 && !showOverlay) {
        setOwnerLoading(true, "自動核准中，正在刷新資料...");
      }
    }

    const [dashboardPayload, transactionsPayload, settingsPayload, pendingPayload] = await Promise.all([
      apiFetch(`/api/owner/dashboard?${params.toString()}`),
      apiFetch(`/api/owner/transactions?${transactionQuery.toString()}`),
      apiFetch("/api/owner/settings"),
      apiFetch("/api/owner/transactions?page=1&pageSize=1&mode=pending"),
    ]);

    renderDashboard(dashboardPayload.stats);
    state.transactions = transactionsPayload.rows || [];
    state.total = transactionsPayload.total || 0;
    state.pageCount = transactionsPayload.pageCount || 1;
    state.page = transactionsPayload.page || 1;
    state.pendingCount = pendingPayload.total || 0;
    state.autoApproveEnabled = Boolean(settingsPayload.settings?.auto_approve_enabled);
    state.autoApproveIntervalSeconds = Number(settingsPayload.settings?.auto_approve_interval_minutes || 300);
    if (!state.autoApproveEnabled) {
      state.autoApproveRemainingSeconds = 0;
      stopAutoApproveCountdown();
    } else if (!state.autoApproveRemainingSeconds || state.autoApproveRemainingSeconds > state.autoApproveIntervalSeconds) {
      resetAutoApproveCountdown();
    }
    syncAutoApproveDialog();
    renderOwnerSession();
    renderTransactions(state.transactions);

    if ((sweepResult.approvedCount || 0) > 0) {
      showStatus(`已自動核准 ${sweepResult.approvedCount} 筆，列表已刷新`, 2500);
    } else if (showRefreshStatus) {
      showStatus("列表已刷新", 1800);
    }
    return true;
  } catch (error) {
    showError(error instanceof Error ? error.message : "讀取資料失敗");
    return false;
  } finally {
    state.isLoadingOwnerData = false;
    setOwnerLoading(false);
  }
}

function stopOwnerPolling() {
  if (ownerPollTimer) {
    clearInterval(ownerPollTimer);
    ownerPollTimer = null;
  }
}

function startOwnerPolling() {
  stopOwnerPolling();
  if (state.user?.role !== "owner") return;
  ownerPollTimer = setInterval(async () => {
    if (document.hidden || state.isLoadingOwnerData) return;
    await loadOwnerData();
  }, OWNER_POLL_INTERVAL_MS);
}

async function saveDetailChanges(transactionId, approveAfterSave) {
  const totalAmount = ownerDetailContent.querySelector("#detailTotalAmountInput")?.value || "";
  const itemAmounts = [...ownerDetailContent.querySelectorAll(".detail-amount-input")].map((input) => input.value);

  try {
    const saveButton = ownerDetailContent.querySelector("#saveDetailButton");
    const approveButton = ownerDetailContent.querySelector("#saveAndApproveButton");
    if (saveButton) saveButton.disabled = true;
    if (approveButton) approveButton.disabled = true;

    await apiFetch("/api/owner/update-transaction", {
      method: "POST",
      body: JSON.stringify({ transactionId, totalAmount, itemAmounts }),
    });

    if (approveAfterSave) {
      await apiFetch("/api/owner/approve", {
        method: "POST",
        body: JSON.stringify({ transactionId }),
      });
      showStatus("已儲存交易並完成核准");
    } else {
      showStatus("已儲存交易修改");
    }

    ownerDetailDialog.close();
    await loadOwnerData({ showOverlay: true, loadingText: "正在刷新資料...", showRefreshStatus: true });
  } catch (error) {
    showError(error instanceof Error ? error.message : "儲存修改失敗");
  }
}

async function loginOwner() {
  resetError();
  ownerLoginButton.disabled = true;

  try {
    const payload = await apiFetch("/api/auth/owner-login", {
      method: "POST",
      body: JSON.stringify({
        login: ownerLoginInput.value.trim(),
        password: ownerPasswordInput.value,
      }),
    });
    state.user = payload.user;
    renderOwnerSession();
    hideStatus();
    await loadOwnerData({ showOverlay: true, loadingText: "正在載入店舖資料..." });
    startAutoApproveCountdown();
    startOwnerPolling();
  } catch (error) {
    showError(error instanceof Error ? error.message : "登入失敗");
  } finally {
    ownerLoginButton.disabled = false;
  }
}

async function logoutOwner() {
  stopOwnerPolling();
  stopAutoApproveCountdown();
  await apiFetch("/api/auth/logout", { method: "POST" });
  state.user = null;
  state.searchTerm = "";
  customerSearchInput.value = "";
  state.pendingCount = 0;
  state.autoApproveRemainingSeconds = 0;
  renderOwnerSession();
  transactionTableBody.innerHTML = "";
  dashboardCards.innerHTML = "";
  state.selectedIds.clear();
  showStatus("已登出");
}

async function loadSession() {
  const payload = await apiFetch("/api/auth/me");
  state.user = payload.user;
  if (state.user?.role === "customer") {
    window.location.href = "/";
    return;
  }
  renderOwnerSession();
  if (state.user?.role === "owner") {
    await loadOwnerData({ showOverlay: true, loadingText: "正在載入店舖資料..." });
    startAutoApproveCountdown();
    startOwnerPolling();
  }
}

async function loginOwnerFromMembershipToken(token) {
  resetError();
  try {
    const payload = await apiFetch("/api/auth/membership-login", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    if (payload.user?.role === "customer") {
      window.location.href = "/";
      return;
    }
    state.user = payload.user;
    clearMembershipTokenFromUrl();
    renderOwnerSession();
    hideStatus();
    await loadOwnerData({ showOverlay: true, loadingText: "正在載入店舖資料..." });
    startAutoApproveCountdown();
    startOwnerPolling();
  } catch (error) {
    showError(error instanceof Error ? error.message : "主系統登入失敗");
  } finally {
    setAuthBooting(false);
    renderOwnerSession();
  }
}

pendingTabButton.addEventListener("click", async () => {
  state.mode = "pending";
  state.page = 1;
  state.selectedIds.clear();
  pendingTabButton.classList.add("active");
  historyTabButton.classList.remove("active");
  await loadOwnerData({ showOverlay: true, loadingText: "正在刷新待審核資料...", showRefreshStatus: true });
});

historyTabButton.addEventListener("click", async () => {
  state.mode = "history";
  state.page = 1;
  state.selectedIds.clear();
  historyTabButton.classList.add("active");
  pendingTabButton.classList.remove("active");
  await loadOwnerData({ showOverlay: true, loadingText: "正在刷新歷史紀錄...", showRefreshStatus: true });
});

pageSizeSelect.addEventListener("change", async () => {
  state.pageSize = pageSizeSelect.value;
  state.page = 1;
  state.selectedIds.clear();
  await loadOwnerData({ showOverlay: true, loadingText: "正在刷新資料...", showRefreshStatus: true });
});

customerSearchButton.addEventListener("click", async () => {
  state.searchTerm = customerSearchInput.value.trim();
  state.page = 1;
  state.selectedIds.clear();
  await loadOwnerData({ showOverlay: true, loadingText: "正在搜尋資料...", showRefreshStatus: true });
});

customerSearchInput.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  state.searchTerm = customerSearchInput.value.trim();
  state.page = 1;
  state.selectedIds.clear();
  await loadOwnerData({ showOverlay: true, loadingText: "正在搜尋資料...", showRefreshStatus: true });
});

customerSearchClearButton.addEventListener("click", async () => {
  customerSearchInput.value = "";
  state.searchTerm = "";
  state.page = 1;
  state.selectedIds.clear();
  await loadOwnerData({ showOverlay: true, loadingText: "正在刷新資料...", showRefreshStatus: true });
});

prevPageButton.addEventListener("click", async () => {
  if (state.page <= 1) return;
  state.page -= 1;
  state.selectedIds.clear();
  await loadOwnerData({ showOverlay: true, loadingText: "正在切換頁面...", showRefreshStatus: true });
});

nextPageButton.addEventListener("click", async () => {
  if (state.page >= state.pageCount) return;
  state.page += 1;
  state.selectedIds.clear();
  await loadOwnerData({ showOverlay: true, loadingText: "正在切換頁面...", showRefreshStatus: true });
});

selectAllCheckbox.addEventListener("change", () => {
  if (selectAllCheckbox.checked) {
    state.transactions
      .filter((transaction) => transaction.status === "pending")
      .forEach((transaction) => state.selectedIds.add(transaction.id));
  } else {
    state.transactions.forEach((transaction) => state.selectedIds.delete(transaction.id));
  }
  renderTransactions(state.transactions);
});

batchApproveButton.addEventListener("click", async () => {
  if (!state.selectedIds.size) return;
  try {
    batchApproveButton.disabled = true;
    await apiFetch("/api/owner/batch-approve", {
      method: "POST",
      body: JSON.stringify({ transactionIds: [...state.selectedIds] }),
    });
    state.selectedIds.clear();
    await loadOwnerData({ showOverlay: true, loadingText: "正在批次核准並刷新資料...", showRefreshStatus: true });
  } catch (error) {
    showError(error instanceof Error ? error.message : "批次核准失敗");
  } finally {
    batchApproveButton.disabled = false;
  }
});

async function updateAutoApproveSettings(autoApproveEnabled) {
  const intervalSeconds = Math.max(1, Number(autoApproveIntervalInput.value) || state.autoApproveIntervalSeconds || 300);
  try {
    confirmAutoApproveButton.disabled = true;
    disableAutoApproveButton.disabled = true;
    await apiFetch("/api/owner/settings", {
      method: "POST",
      body: JSON.stringify({ autoApproveEnabled, autoApproveIntervalSeconds: intervalSeconds }),
    });
    state.autoApproveEnabled = autoApproveEnabled;
    state.autoApproveIntervalSeconds = intervalSeconds;
    state.autoApproveRemainingSeconds = autoApproveEnabled ? intervalSeconds : 0;
    syncAutoApproveDialog();
    renderOwnerSession();
    if (autoApproveEnabled) {
      startAutoApproveCountdown();
    } else {
      stopAutoApproveCountdown();
    }
    showStatus(autoApproveEnabled ? `已開啟自動核准，間隔 ${intervalSeconds} 秒` : "已關閉自動核准", 2200);
    if (!autoApproveEnabled) {
      autoApproveDialog.close();
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "更新自動核准失敗");
  } finally {
    confirmAutoApproveButton.disabled = false;
    disableAutoApproveButton.disabled = false;
  }
}

autoApproveButton.addEventListener("click", () => {
  syncAutoApproveDialog();
  autoApproveDialog.showModal();
});

confirmAutoApproveButton.addEventListener("click", async () => {
  await updateAutoApproveSettings(true);
});

disableAutoApproveButton.addEventListener("click", async () => {
  await updateAutoApproveSettings(false);
});

ownerLoginButton.addEventListener("click", loginOwner);
ownerLogoutButton.addEventListener("click", logoutOwner);
refreshDashboardButton.addEventListener("click", async () => {
  await loadOwnerData({ showOverlay: true, loadingText: "正在刷新資料...", showRefreshStatus: true, runAutoApprove: true });
});
ownerCloseDialogButton.addEventListener("click", () => ownerImageDialog.close());
ownerCloseDetailButton.addEventListener("click", () => ownerDetailDialog.close());
closeAutoApproveDialogButton.addEventListener("click", () => autoApproveDialog.close());
ownerImageDialog.addEventListener("click", (event) => {
  const rect = ownerImageDialog.getBoundingClientRect();
  const clickedInside =
    rect.top <= event.clientY &&
    event.clientY <= rect.top + rect.height &&
    rect.left <= event.clientX &&
    event.clientX <= rect.left + rect.width;
  if (!clickedInside) ownerImageDialog.close();
});
ownerDetailDialog.addEventListener("click", (event) => {
  const rect = ownerDetailDialog.getBoundingClientRect();
  const clickedInside =
    rect.top <= event.clientY &&
    event.clientY <= rect.top + rect.height &&
    rect.left <= event.clientX &&
    event.clientX <= rect.left + rect.width;
  if (!clickedInside) ownerDetailDialog.close();
});
autoApproveDialog.addEventListener("click", (event) => {
  const rect = autoApproveDialog.getBoundingClientRect();
  const clickedInside =
    rect.top <= event.clientY &&
    event.clientY <= rect.top + rect.height &&
    rect.left <= event.clientX &&
    event.clientX <= rect.left + rect.width;
  if (!clickedInside) autoApproveDialog.close();
});

window.addEventListener("load", async () => {
  try {
    await loadSession();
    if (!state.user) {
      const membershipToken = extractMembershipToken();
      if (membershipToken) {
        await loginOwnerFromMembershipToken(membershipToken);
        return;
      }
    }
    setAuthBooting(false);
    renderOwnerSession();
  } catch (error) {
    setAuthBooting(false);
    renderOwnerSession();
    showError(error instanceof Error ? error.message : "初始化失敗");
  }
});

document.addEventListener("visibilitychange", async () => {
  if (document.hidden || state.user?.role !== "owner") return;
  await loadOwnerData();
});

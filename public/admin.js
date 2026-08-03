const apiBaseUrl = (() => {
  const params = new URLSearchParams(window.location.search);
  return (params.get("apiBaseUrl") || window.APP_CONFIG?.apiBaseUrl || "").replace(/\/$/, "");
})();

const state = {
  user: null,
  authBooting: true,
  mode: "pending",
  page: 1,
  pageSize: "50",
  total: 0,
  pageCount: 1,
  searchTerm: "",
  transactions: [],
  shops: [],
  selectedShopId: "",
  selectedIds: new Set(),
  autoApproveEnabled: false,
  autoApproveIntervalSeconds: 300,
  autoApproveAllowedStatuses: ["verified_amount_and_id"],
  autoApproveBulkShopIds: [],
};

const adminErrorCard = document.getElementById("adminErrorCard");
const adminAuthBootCard = document.getElementById("adminAuthBootCard");
const adminLoginCard = document.getElementById("adminLoginCard");
const adminApp = document.getElementById("adminApp");
const adminHeaderSession = document.getElementById("adminHeaderSession");
const adminNameBadge = document.getElementById("adminNameBadge");
const adminLoginInput = document.getElementById("adminLoginInput");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const adminLoginButton = document.getElementById("adminLoginButton");
const adminLogoutButton = document.getElementById("adminLogoutButton");
const adminDashboardCards = document.getElementById("adminDashboardCards");
const adminPendingTabButton = document.getElementById("adminPendingTabButton");
const adminHistoryTabButton = document.getElementById("adminHistoryTabButton");
const adminShopSelect = document.getElementById("adminShopSelect");
const adminCustomerSearchInput = document.getElementById("adminCustomerSearchInput");
const adminCustomerSearchButton = document.getElementById("adminCustomerSearchButton");
const adminCustomerSearchClearButton = document.getElementById("adminCustomerSearchClearButton");
const adminPageSizeSelect = document.getElementById("adminPageSizeSelect");
const adminBatchApproveButton = document.getElementById("adminBatchApproveButton");
const adminAutoApproveSweepButton = document.getElementById("adminAutoApproveSweepButton");
const adminRefreshButton = document.getElementById("adminRefreshButton");
const adminTransactionTableBody = document.getElementById("adminTransactionTableBody");
const adminSelectAllCheckbox = document.getElementById("adminSelectAllCheckbox");
const adminPrevPageButton = document.getElementById("adminPrevPageButton");
const adminNextPageButton = document.getElementById("adminNextPageButton");
const adminPaginationInfo = document.getElementById("adminPaginationInfo");
const adminImageDialog = document.getElementById("adminImageDialog");
const adminDialogImage = document.getElementById("adminDialogImage");
const adminCloseDialogButton = document.getElementById("adminCloseDialogButton");
const adminDetailDialog = document.getElementById("adminDetailDialog");
const adminDetailContent = document.getElementById("adminDetailContent");
const adminCloseDetailButton = document.getElementById("adminCloseDetailButton");
const adminLoadingOverlay = document.getElementById("adminLoadingOverlay");
const adminLoadingText = document.getElementById("adminLoadingText");
const adminAutoApproveDialog = document.getElementById("adminAutoApproveDialog");
const adminCloseAutoApproveDialogButton = document.getElementById("adminCloseAutoApproveDialogButton");
const adminAutoApproveDialogTitle = document.getElementById("adminAutoApproveDialogTitle");
const adminAutoApproveStateBadge = document.getElementById("adminAutoApproveStateBadge");
const adminAutoApproveDialogNote = document.getElementById("adminAutoApproveDialogNote");
const adminAutoApproveIntervalInput = document.getElementById("adminAutoApproveIntervalInput");
const adminBulkShopPicker = document.getElementById("adminBulkShopPicker");
const adminBulkShopList = document.getElementById("adminBulkShopList");
const adminAutoApproveAllowVerified = document.getElementById("adminAutoApproveAllowVerified");
const adminAutoApproveAllowIdOnly = document.getElementById("adminAutoApproveAllowIdOnly");
const adminAutoApproveAllowAiSkipped = document.getElementById("adminAutoApproveAllowAiSkipped");
const adminAutoApproveAllowNoMatch = document.getElementById("adminAutoApproveAllowNoMatch");
const adminDisableAutoApproveButton = document.getElementById("adminDisableAutoApproveButton");
const adminSaveAutoApproveButton = document.getElementById("adminSaveAutoApproveButton");
const adminRunAutoApproveNowButton = document.getElementById("adminRunAutoApproveNowButton");
const adminConfirmAutoApproveButton = document.getElementById("adminConfirmAutoApproveButton");

function formatCurrency(value) {
  return `MOP ${Number(value || 0).toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-Hant");
}

function getVerificationMeta(status) {
  if (status === "ai_skipped") {
    return { tagClass: "ai-skipped-tag", thumbClass: "ai-skipped-thumb", label: "AI 未辨識，需人工核對" };
  }
  if (status === "verified_amount_and_id") {
    return { tagClass: "verified-tag", thumbClass: "verified-thumb", label: "單號及金額已核實" };
  }
  if (status === "verified_id_only") {
    return { tagClass: "partial-verified-tag", thumbClass: "partial-verified-thumb", label: "僅單號已核實（需人工核對金額）" };
  }
  if (status === "no_match") {
    return { tagClass: "failed-tag", thumbClass: "failed-thumb", label: "單號不匹配" };
  }
  return null;
}

function showError(message) {
  adminErrorCard.textContent = message;
  adminErrorCard.classList.remove("hidden");
}

function resetError() {
  adminErrorCard.classList.add("hidden");
  adminErrorCard.textContent = "";
}

function setAuthBooting(isBooting) {
  state.authBooting = isBooting;
  document.body.classList.toggle("owner-auth-booting", isBooting);
  adminAuthBootCard.classList.toggle("hidden", !isBooting);
}

function setLoading(visible, text = "正在讀取資料...") {
  adminLoadingText.textContent = text;
  adminLoadingOverlay.classList.toggle("hidden", !visible);
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

function renderSession() {
  const isAdmin = state.user?.role === "admin";
  adminHeaderSession.classList.toggle("hidden", !isAdmin);
  adminLoginCard.classList.toggle("hidden", isAdmin || state.authBooting);
  adminApp.classList.toggle("hidden", !isAdmin);
  adminNameBadge.textContent = isAdmin ? `${state.user.fullName || "管理員"} (${state.user.adminLogin || "-"})` : "未登入";
}

function renderShops() {
  adminShopSelect.innerHTML = [`<option value="">全部商家</option>`]
    .concat(
      state.shops.map(
        (shop) =>
          `<option value="${shop.id}" ${String(state.selectedShopId) === String(shop.id) ? "selected" : ""}>${shop.name}</option>`
      )
    )
    .join("");
}

function getCurrentAutoApproveAllowedStatuses() {
  const selected = [];
  if (adminAutoApproveAllowVerified?.checked) selected.push("verified_amount_and_id");
  if (adminAutoApproveAllowIdOnly?.checked) selected.push("verified_id_only");
  if (adminAutoApproveAllowAiSkipped?.checked) selected.push("ai_skipped");
  if (adminAutoApproveAllowNoMatch?.checked) selected.push("no_match");
  return selected;
}

function renderAdminBulkShopList() {
  if (!adminBulkShopList) return;
  adminBulkShopList.innerHTML = (state.shops || [])
    .map((shop) => {
      const checked = state.autoApproveBulkShopIds.includes(shop.id) ? "checked" : "";
      return `<label class="check-row"><input class="admin-bulk-shop-checkbox" type="checkbox" value="${shop.id}" ${checked} /> ${shop.name}</label>`;
    })
    .join("");
  adminBulkShopList.querySelectorAll(".admin-bulk-shop-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const next = new Set(state.autoApproveBulkShopIds);
      if (checkbox.checked) next.add(checkbox.value);
      else next.delete(checkbox.value);
      state.autoApproveBulkShopIds = [...next];
      syncAdminAutoApproveDialog();
    });
  });
}

function syncAdminAutoApproveDialog() {
  const isBulkMode = !state.selectedShopId;
  const selectedShop = state.shops.find((shop) => String(shop.id) === String(state.selectedShopId));
  adminAutoApproveDialogTitle.textContent = isBulkMode ? "批量設定自動核准" : `${selectedShop?.name || "商家"} 自動核准設定`;
  adminAutoApproveStateBadge.textContent = isBulkMode ? `已選 ${state.autoApproveBulkShopIds.length} 家商家` : state.autoApproveEnabled ? "已啟用" : "未啟用";
  adminAutoApproveDialogNote.textContent = isBulkMode
    ? "可一次設定多家商家的自動核准，並立即對所選商家執行一次。"
    : "管理員可替該商家設定自動核准，並立即執行一次。";
  adminAutoApproveIntervalInput.value = String(state.autoApproveIntervalSeconds || 300);
  adminBulkShopPicker.classList.toggle("hidden", !isBulkMode);
  adminDisableAutoApproveButton.textContent = isBulkMode ? "批量停止" : "停止自動核准";
  if (adminAutoApproveAllowVerified) adminAutoApproveAllowVerified.checked = state.autoApproveAllowedStatuses.includes("verified_amount_and_id");
  if (adminAutoApproveAllowIdOnly) adminAutoApproveAllowIdOnly.checked = state.autoApproveAllowedStatuses.includes("verified_id_only");
  if (adminAutoApproveAllowAiSkipped) adminAutoApproveAllowAiSkipped.checked = state.autoApproveAllowedStatuses.includes("ai_skipped");
  if (adminAutoApproveAllowNoMatch) adminAutoApproveAllowNoMatch.checked = state.autoApproveAllowedStatuses.includes("no_match");
  if (isBulkMode) renderAdminBulkShopList();
  const shouldDisableActions = isBulkMode && !state.autoApproveBulkShopIds.length;
  adminRunAutoApproveNowButton.disabled = shouldDisableActions;
  adminConfirmAutoApproveButton.disabled = shouldDisableActions;
  adminSaveAutoApproveButton.disabled = shouldDisableActions;
  adminDisableAutoApproveButton.disabled = shouldDisableActions;
}

function renderDashboard(stats) {
  if (!stats) return;
  adminDashboardCards.innerHTML = `
    <article class="card stat-card"><div class="summary-label">上傳筆數</div><div class="summary-value">${stats.uploadCount || 0}</div></article>
    <article class="card stat-card"><div class="summary-label">上傳客戶數</div><div class="summary-value">${stats.customerCount || 0}</div></article>
    <article class="card stat-card"><div class="summary-label">充值總額</div><div class="summary-value">${formatCurrency(stats.totalAmount)}</div></article>
    <article class="card stat-card"><div class="summary-label">已核准筆數</div><div class="summary-value">${stats.approvedCount || 0}</div></article>
    <article class="card stat-card"><div class="summary-label">已核准總額</div><div class="summary-value">${formatCurrency(stats.approvedAmount)}</div></article>
    <article class="card stat-card"><div class="summary-label">已拒絕筆數</div><div class="summary-value">${stats.rejectedCount || 0}</div></article>
  `;
}

function showImageDialog(src, alt, verificationStatus = "") {
  adminDialogImage.classList.remove("ai-skipped-preview", "verified-preview", "partial-verified-preview", "failed-preview");
  const verificationMeta = getVerificationMeta(verificationStatus);
  if (verificationMeta?.thumbClass === "verified-thumb") adminDialogImage.classList.add("verified-preview");
  if (verificationMeta?.thumbClass === "partial-verified-thumb") adminDialogImage.classList.add("partial-verified-preview");
  if (verificationMeta?.thumbClass === "failed-thumb") adminDialogImage.classList.add("failed-preview");
  if (verificationMeta?.thumbClass === "ai-skipped-thumb") adminDialogImage.classList.add("ai-skipped-preview");
  adminDialogImage.src = src;
  adminDialogImage.alt = alt;
  adminImageDialog.showModal();
}

function renderPagination() {
  adminPaginationInfo.textContent = `第 ${state.page} / ${state.pageCount} 頁，共 ${state.total} 筆`;
  adminPrevPageButton.disabled = state.page <= 1;
  adminNextPageButton.disabled = state.page >= state.pageCount;
}

function syncBatchApproveState() {
  adminBatchApproveButton.disabled = !state.selectedIds.size || state.mode !== "pending";
  adminSelectAllCheckbox.checked =
    state.transactions.length > 0 &&
    state.transactions.filter((row) => row.status === "pending").every((row) => state.selectedIds.has(row.id));
}

async function saveDetailChanges(transactionId, approveAfterSave) {
  const itemAmounts = [...adminDetailContent.querySelectorAll(".admin-detail-amount-input")].map((input) => input.value);
  try {
    await apiFetch("/api/admin/update-transaction", {
      method: "POST",
      body: JSON.stringify({ transactionId, itemAmounts }),
    });
    if (approveAfterSave) {
      await approveTransaction(transactionId);
      adminDetailDialog.close();
      return;
    }
    await loadAdminData({ showOverlay: true, loadingText: "正在刷新資料..." });
  } catch (error) {
    showError(error instanceof Error ? error.message : "更新交易失敗");
  }
}

function renderDetailDialog(transaction) {
  const shopName = transaction?.shops?.name || "-";
  const shopCode = transaction?.shops?.code || "-";
  const hasMissingAmount = (transaction.items || []).some(
    (item) => !Number(item?.manualAmount || item?.extracted?.amount || 0) || Number(item?.manualAmount || item?.extracted?.amount || 0) <= 0
  );
  adminDetailContent.innerHTML = `
    <div class="section-header">
      <h3>交易調查明細</h3>
      <span class="pill">${transaction.customer_code}</span>
    </div>
    <div class="detail-edit-summary">
      <span class="pill subtle-pill">店舖：${shopName}</span>
      <span class="pill subtle-pill">店舖編號：${shopCode}</span>
      <span class="pill subtle-pill">提交時間：${formatDateTime(transaction.submitted_at)}</span>
      <span class="pill subtle-pill">目前操作人：${transaction.approved_by || "-"}</span>
    </div>
    ${hasMissingAmount ? `<div class="missing-amount-banner">此交易內容沒有金額，請先填寫「可編輯金額」後才能核准。</div>` : ""}
    <div class="detail-list owner-detail-list">
      ${(transaction.items || [])
        .map(
          (item, index) => `
            <section class="card compact-card owner-detail-card">
              <div class="section-header">
                <h3>交易明細 ${index + 1}</h3>
                <span class="pill">${formatCurrency(item?.manualAmount || item?.extracted?.amount)}</span>
              </div>
              <div class="owner-item-grid">
                <button class="thumb-button admin-detail-thumb ${getVerificationMeta(item?.verificationStatus)?.thumbClass || ""}" type="button" data-src="${item.previewUrl}" data-alt="交易明細 ${index + 1}" data-verification-status="${item?.verificationStatus || ""}">
                  <img src="${item.previewUrl}" alt="交易明細 ${index + 1}" />
                </button>
                <span>商戶：${item?.extracted?.merchantName || "-"}</span>
                <span>訂單號：${item?.extracted?.transactionOrderNo || "-"}</span>
                <span>候選單號：${
                  Array.isArray(item?.extracted?.allDetectedOrderNos) && item.extracted.allDetectedOrderNos.length
                    ? item.extracted.allDetectedOrderNos.join(" / ")
                    : "-"
                }</span>
                <span>核對結果：${getVerificationMeta(item?.verificationStatus)?.label || "-"}</span>
                <span>匹配單號：${item?.verificationMatchedOrderNo || "-"}</span>
                <span>匹配欄位：${item?.verificationMatchedSource || "-"}</span>
                <span>mPay 黃金金額：${item?.verificationBackofficeAmount ? formatCurrency(item.verificationBackofficeAmount) : "-"}</span>
                <span>金額是否一致：${
                  item?.verificationAmountMatched == null ? "-" : item?.verificationAmountMatched ? "是" : "否（已按 mPay 後台自動校正）"
                }</span>
                <label class="edit-field">
                  <span>可編輯金額</span>
                  <input class="text-input admin-detail-amount-input" data-index="${index}" type="number" step="0.01" min="0" value="${item?.manualAmount || item?.extracted?.amount || ""}" />
                </label>
                <span>時間：${item?.extracted?.transactionTime || "-"}</span>
                <span>狀態：${item?.extracted?.orderStatus || "-"}</span>
                <span>支付方式：${item?.extracted?.paymentMethod || "-"}</span>
              </div>
            </section>
          `
        )
        .join("")}
    </div>
    <div class="detail-dialog-actions" style="margin-top: 16px;">
      <button id="adminSaveDetailButton" class="secondary-button" type="button">儲存修改</button>
      ${transaction.status === "pending" ? `<button id="adminSaveAndApproveButton" class="primary-button" type="button">儲存並核准</button>` : ""}
      ${transaction.status === "pending" ? `<button id="adminRejectDetailButton" class="secondary-button" type="button">拒絕</button>` : ""}
      ${transaction.status === "rejected" ? `<button id="adminRevokeDetailButton" class="secondary-button" type="button">撤回</button>` : ""}
    </div>
  `;

  adminDetailDialog.showModal();
  adminDetailContent.querySelectorAll(".admin-detail-thumb").forEach((button) => {
    button.addEventListener("click", () => showImageDialog(button.dataset.src, button.dataset.alt || "交易圖片", button.dataset.verificationStatus || ""));
  });
  adminDetailContent.querySelector("#adminSaveDetailButton")?.addEventListener("click", () => saveDetailChanges(transaction.id, false));
  adminDetailContent.querySelector("#adminSaveAndApproveButton")?.addEventListener("click", () => saveDetailChanges(transaction.id, true));
  adminDetailContent.querySelector("#adminRejectDetailButton")?.addEventListener("click", async () => {
    await rejectTransaction(transaction.id);
    adminDetailDialog.close();
  });
  adminDetailContent.querySelector("#adminRevokeDetailButton")?.addEventListener("click", async () => {
    await revokeTransaction(transaction.id);
    adminDetailDialog.close();
  });
}

async function approveTransaction(transactionId) {
  try {
    await apiFetch("/api/admin/approve", {
      method: "POST",
      body: JSON.stringify({ transactionId }),
    });
    await loadAdminData({ showOverlay: true, loadingText: "正在核准並刷新資料..." });
  } catch (error) {
    showError(error instanceof Error ? error.message : "核准失敗");
  }
}

async function rejectTransaction(transactionId) {
  try {
    await apiFetch("/api/admin/reject", {
      method: "POST",
      body: JSON.stringify({ transactionId }),
    });
    await loadAdminData({ showOverlay: true, loadingText: "正在拒絕並刷新資料..." });
  } catch (error) {
    showError(error instanceof Error ? error.message : "拒絕失敗");
  }
}

async function revokeTransaction(transactionId) {
  try {
    await apiFetch("/api/admin/revoke", {
      method: "POST",
      body: JSON.stringify({ transactionId }),
    });
    await loadAdminData({ showOverlay: true, loadingText: "正在撤回並刷新資料..." });
  } catch (error) {
    showError(error instanceof Error ? error.message : "撤回失敗");
  }
}

async function runBatchApprove() {
  if (!state.selectedIds.size) return;
  try {
    await apiFetch("/api/admin/batch-approve", {
      method: "POST",
      body: JSON.stringify({ transactionIds: [...state.selectedIds] }),
    });
    state.selectedIds.clear();
    await loadAdminData({ showOverlay: true, loadingText: "正在批次核准並刷新資料..." });
  } catch (error) {
    showError(error instanceof Error ? error.message : "批次核准失敗");
  }
}

async function loadAutoApproveSettingsForDialog() {
  if (!state.selectedShopId) {
    state.autoApproveEnabled = false;
    state.autoApproveIntervalSeconds = 300;
    state.autoApproveAllowedStatuses = ["verified_amount_and_id"];
    state.autoApproveBulkShopIds = state.shops.map((shop) => shop.id);
    syncAdminAutoApproveDialog();
    return;
  }
  try {
    const payload = await apiFetch(`/api/admin/shop-settings?shopId=${encodeURIComponent(state.selectedShopId)}`);
    state.autoApproveEnabled = Boolean(payload.settings?.auto_approve_enabled);
    state.autoApproveIntervalSeconds = Math.max(1, Number(payload.settings?.auto_approve_interval_minutes) || 300);
    state.autoApproveAllowedStatuses = ["verified_amount_and_id"];
    state.autoApproveBulkShopIds = [state.selectedShopId];
    syncAdminAutoApproveDialog();
  } catch (error) {
    showError(error instanceof Error ? error.message : "讀取自動核准設定失敗");
  }
}

async function updateAdminAutoApproveSettings(autoApproveEnabled) {
  const intervalSeconds = Math.max(1, Number(adminAutoApproveIntervalInput.value) || state.autoApproveIntervalSeconds || 300);
  const selectedStatuses = getCurrentAutoApproveAllowedStatuses();
  if (!selectedStatuses.includes("verified_amount_and_id")) {
    showError("目前自動核准只支援綠色（單號及金額已核實）交易，請至少勾選綠色選項。");
    return false;
  }

  try {
    adminConfirmAutoApproveButton.disabled = true;
    adminDisableAutoApproveButton.disabled = true;
    adminSaveAutoApproveButton.disabled = true;
    adminRunAutoApproveNowButton.disabled = true;

    if (state.selectedShopId) {
      await apiFetch("/api/admin/shop-settings", {
        method: "POST",
        body: JSON.stringify({
          shopId: state.selectedShopId,
          autoApproveEnabled,
          autoApproveIntervalSeconds: intervalSeconds,
        }),
      });
      const targetShop = state.shops.find((shop) => String(shop.id) === String(state.selectedShopId));
      if (targetShop) {
        targetShop.auto_approve_enabled = autoApproveEnabled;
        targetShop.auto_approve_interval_minutes = intervalSeconds;
      }
    } else {
      if (!state.autoApproveBulkShopIds.length) {
        showError("請先選擇要套用設定的商家。");
        return false;
      }
      const payload = await apiFetch("/api/admin/bulk-shop-settings", {
        method: "POST",
        body: JSON.stringify({
          shopIds: state.autoApproveBulkShopIds,
          autoApproveEnabled,
          autoApproveIntervalSeconds: intervalSeconds,
        }),
      });
      const updatedMap = new Map((payload.settings || []).map((shop) => [String(shop.id), shop]));
      state.shops = state.shops.map((shop) => updatedMap.get(String(shop.id)) || shop);
      renderShops();
    }

    state.autoApproveEnabled = autoApproveEnabled;
    state.autoApproveIntervalSeconds = intervalSeconds;
    state.autoApproveAllowedStatuses = selectedStatuses;
    syncAdminAutoApproveDialog();
    await loadAdminData({ showOverlay: true, loadingText: "正在刷新資料..." });
    return true;
  } catch (error) {
    showError(error instanceof Error ? error.message : "更新自動核准設定失敗");
    return false;
  } finally {
    adminConfirmAutoApproveButton.disabled = false;
    adminDisableAutoApproveButton.disabled = false;
    adminSaveAutoApproveButton.disabled = false;
    adminRunAutoApproveNowButton.disabled = false;
    syncAdminAutoApproveDialog();
  }
}

async function runAutoApproveSweep(shopIds = []) {
  try {
    let approvedTotal = 0;
    if (Array.isArray(shopIds) && shopIds.length) {
      for (const shopId of shopIds) {
        const payload = await apiFetch("/api/admin/auto-approve-sweep", {
          method: "POST",
          body: JSON.stringify({ shopId }),
        });
        approvedTotal += Number(payload.approvedCount || 0);
      }
    } else {
      const payload = await apiFetch("/api/admin/auto-approve-sweep", {
        method: "POST",
        body: JSON.stringify({ shopId: state.selectedShopId || "" }),
      });
      approvedTotal += Number(payload.approvedCount || 0);
    }
    state.selectedIds.clear();
    await loadAdminData({ showOverlay: true, loadingText: "正在執行自動核准並刷新資料..." });
    if (approvedTotal === 0) {
      showError("已執行自動核准，但目前沒有符合規則的交易。");
    }
    return true;
  } catch (error) {
    showError(error instanceof Error ? error.message : "執行自動核准失敗");
    return false;
  }
}

function renderTransactions(rows) {
  if (!rows.length) {
    adminTransactionTableBody.innerHTML = `<tr><td colspan="10"><div class="empty-state">目前沒有資料。</div></td></tr>`;
    syncBatchApproveState();
    renderPagination();
    return;
  }

  adminTransactionTableBody.innerHTML = rows
    .map((transaction) => {
      const shopName = transaction?.shops?.name || "-";
      const statusLabel =
        transaction.status === "approved" ? "已核准" : transaction.status === "rejected" ? "已拒絕" : "待審核";
      const statusClass =
        transaction.status === "approved" ? "approved-pill" : transaction.status === "rejected" ? "rejected-pill" : "";
      const verificationMeta = getVerificationMeta(transaction.verificationStatus);
      return `
        <tr>
          <td>${transaction.status === "pending" ? `<input class="admin-row-checkbox" data-id="${transaction.id}" type="checkbox" ${state.selectedIds.has(transaction.id) ? "checked" : ""} />` : ""}</td>
          <td>${formatDateTime(transaction.submitted_at)}</td>
          <td>${shopName}</td>
          <td>${transaction.customer_code}</td>
          <td>
            <div class="table-thumbnails">
              ${(transaction.items || [])
                .slice(0, 3)
                .map(
                  (item, index) => `
                    <button class="thumb-button admin-thumb-button ${getVerificationMeta(item?.verificationStatus)?.thumbClass || ""}" type="button" data-src="${item.previewUrl}" data-alt="交易明細 ${index + 1}" data-verification-status="${item?.verificationStatus || ""}">
                      <img src="${item.previewUrl}" alt="交易明細 ${index + 1}" />
                    </button>
                  `
                )
                .join("")}
            </div>
          </td>
          <td>${transaction.item_count}</td>
          <td>${formatCurrency(transaction.total_amount)}</td>
          <td>
            <div class="status-stack">
              <span class="pill ${statusClass}">${statusLabel}</span>
              ${verificationMeta ? `<span class="${verificationMeta.tagClass}">${verificationMeta.label}</span>` : ""}
            </div>
          </td>
          <td>${transaction.approved_by || "-"}</td>
          <td>
            <div class="table-actions">
              <button class="secondary-button admin-detail-button" data-id="${transaction.id}" type="button">明細</button>
              ${transaction.status === "pending" ? `<button class="primary-button admin-approve-button" data-id="${transaction.id}" type="button">核准</button>` : ""}
              ${transaction.status === "pending" ? `<button class="secondary-button admin-reject-button" data-id="${transaction.id}" type="button">拒絕</button>` : ""}
              ${transaction.status === "rejected" ? `<button class="secondary-button admin-revoke-button" data-id="${transaction.id}" type="button">撤回</button>` : ""}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  adminTransactionTableBody.querySelectorAll(".admin-thumb-button").forEach((button) => {
    button.addEventListener("click", () => showImageDialog(button.dataset.src, button.dataset.alt || "交易圖片", button.dataset.verificationStatus || ""));
  });
  adminTransactionTableBody.querySelectorAll(".admin-detail-button").forEach((button) => {
    button.addEventListener("click", () => {
      const transaction = state.transactions.find((row) => row.id === button.dataset.id);
      if (transaction) renderDetailDialog(transaction);
    });
  });
  adminTransactionTableBody.querySelectorAll(".admin-row-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selectedIds.add(checkbox.dataset.id);
      else state.selectedIds.delete(checkbox.dataset.id);
      syncBatchApproveState();
    });
  });
  adminTransactionTableBody.querySelectorAll(".admin-approve-button").forEach((button) => {
    button.addEventListener("click", async () => approveTransaction(button.dataset.id));
  });
  adminTransactionTableBody.querySelectorAll(".admin-reject-button").forEach((button) => {
    button.addEventListener("click", async () => rejectTransaction(button.dataset.id));
  });
  adminTransactionTableBody.querySelectorAll(".admin-revoke-button").forEach((button) => {
    button.addEventListener("click", async () => revokeTransaction(button.dataset.id));
  });
  syncBatchApproveState();
  renderPagination();
}

async function loadShops() {
  const payload = await apiFetch("/api/admin/shops");
  state.shops = payload.shops || [];
  renderShops();
}

async function loadAdminData({ showOverlay = false, loadingText = "正在讀取資料..." } = {}) {
  if (state.user?.role !== "admin") return;
  resetError();
  if (showOverlay) setLoading(true, loadingText);
  try {
    const params = new URLSearchParams({
      mode: state.searchTerm ? "all" : state.mode,
      page: String(state.page),
      pageSize: String(state.pageSize),
      customerCode: state.searchTerm,
      shopId: state.selectedShopId || "",
    });
    const shopParam = encodeURIComponent(state.selectedShopId || "");
    const [dashboardPayload, transactionsPayload] = await Promise.all([
      apiFetch(`/api/admin/dashboard?shopId=${shopParam}`),
      apiFetch(`/api/admin/transactions?${params.toString()}`),
    ]);
    renderDashboard(dashboardPayload.stats);
    state.transactions = transactionsPayload.rows || [];
    state.total = transactionsPayload.total || 0;
    state.pageCount = transactionsPayload.pageCount || 1;
    state.page = transactionsPayload.page || 1;
    renderTransactions(state.transactions);
  } catch (error) {
    showError(error instanceof Error ? error.message : "讀取管理員資料失敗");
  } finally {
    if (showOverlay) setLoading(false);
  }
}

async function loadSession() {
  const payload = await apiFetch("/api/auth/me");
  state.user = payload.user?.role === "admin" ? payload.user : null;
  renderSession();
  if (state.user?.role === "admin") {
    await loadShops();
    await loadAdminData({ showOverlay: true });
  }
}

async function loginAdmin() {
  resetError();
  try {
    const payload = await apiFetch("/api/auth/admin-login", {
      method: "POST",
      body: JSON.stringify({
        login: adminLoginInput.value.trim(),
        password: adminPasswordInput.value.trim(),
      }),
    });
    state.user = payload.user;
    renderSession();
    await loadShops();
    await loadAdminData({ showOverlay: true, loadingText: "正在載入跨店舖資料..." });
  } catch (error) {
    showError(error instanceof Error ? error.message : "管理員登入失敗");
  }
}

async function logoutAdmin() {
  await apiFetch("/api/auth/logout", { method: "POST" });
  state.user = null;
  state.transactions = [];
  state.total = 0;
  state.pageCount = 1;
  state.page = 1;
  state.selectedIds.clear();
  state.selectedShopId = "";
  state.shops = [];
  adminDashboardCards.innerHTML = "";
  adminTransactionTableBody.innerHTML = "";
  renderSession();
  renderShops();
}

adminLoginButton.addEventListener("click", loginAdmin);
adminPasswordInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") await loginAdmin();
});
adminLogoutButton.addEventListener("click", logoutAdmin);

adminPendingTabButton.addEventListener("click", async () => {
  state.mode = "pending";
  state.page = 1;
  state.selectedIds.clear();
  adminPendingTabButton.classList.add("active");
  adminHistoryTabButton.classList.remove("active");
  await loadAdminData({ showOverlay: true, loadingText: "正在載入待審核資料..." });
});

adminHistoryTabButton.addEventListener("click", async () => {
  state.mode = "history";
  state.page = 1;
  state.selectedIds.clear();
  adminHistoryTabButton.classList.add("active");
  adminPendingTabButton.classList.remove("active");
  await loadAdminData({ showOverlay: true, loadingText: "正在載入歷史紀錄..." });
});

adminShopSelect.addEventListener("change", async () => {
  state.selectedShopId = adminShopSelect.value;
  state.page = 1;
  state.selectedIds.clear();
  await loadAdminData({ showOverlay: true, loadingText: "正在切換商家..." });
});

adminCustomerSearchButton.addEventListener("click", async () => {
  state.searchTerm = adminCustomerSearchInput.value.trim();
  state.page = 1;
  state.selectedIds.clear();
  await loadAdminData({ showOverlay: true, loadingText: "正在搜尋資料..." });
});

adminCustomerSearchInput.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  state.searchTerm = adminCustomerSearchInput.value.trim();
  state.page = 1;
  state.selectedIds.clear();
  await loadAdminData({ showOverlay: true, loadingText: "正在搜尋資料..." });
});

adminCustomerSearchClearButton.addEventListener("click", async () => {
  adminCustomerSearchInput.value = "";
  state.searchTerm = "";
  state.page = 1;
  state.selectedIds.clear();
  await loadAdminData({ showOverlay: true, loadingText: "正在刷新資料..." });
});

adminPageSizeSelect.addEventListener("change", async () => {
  state.pageSize = adminPageSizeSelect.value;
  state.page = 1;
  state.selectedIds.clear();
  await loadAdminData({ showOverlay: true, loadingText: "正在切換頁面..." });
});

adminBatchApproveButton.addEventListener("click", async () => {
  await runBatchApprove();
});

adminAutoApproveSweepButton.addEventListener("click", async () => {
  await loadAutoApproveSettingsForDialog();
  adminAutoApproveDialog.showModal();
});

adminRefreshButton.addEventListener("click", async () => {
  state.selectedIds.clear();
  await loadAdminData({ showOverlay: true, loadingText: "正在刷新資料..." });
});

adminSelectAllCheckbox.addEventListener("change", () => {
  if (adminSelectAllCheckbox.checked) {
    state.transactions.filter((row) => row.status === "pending").forEach((row) => state.selectedIds.add(row.id));
  } else {
    state.transactions.forEach((row) => state.selectedIds.delete(row.id));
  }
  renderTransactions(state.transactions);
});

adminPrevPageButton.addEventListener("click", async () => {
  if (state.page <= 1) return;
  state.page -= 1;
  state.selectedIds.clear();
  await loadAdminData({ showOverlay: true, loadingText: "正在切換頁面..." });
});

adminNextPageButton.addEventListener("click", async () => {
  if (state.page >= state.pageCount) return;
  state.page += 1;
  state.selectedIds.clear();
  await loadAdminData({ showOverlay: true, loadingText: "正在切換頁面..." });
});

adminCloseDialogButton.addEventListener("click", () => adminImageDialog.close());
adminCloseDetailButton.addEventListener("click", () => adminDetailDialog.close());
adminCloseAutoApproveDialogButton.addEventListener("click", () => adminAutoApproveDialog.close());

adminConfirmAutoApproveButton.addEventListener("click", async () => {
  const ok = await updateAdminAutoApproveSettings(true);
  if (ok && state.selectedShopId) {
    adminAutoApproveDialog.close();
  }
});

adminSaveAutoApproveButton.addEventListener("click", async () => {
  await updateAdminAutoApproveSettings(state.selectedShopId ? state.autoApproveEnabled : true);
});

adminDisableAutoApproveButton.addEventListener("click", async () => {
  const ok = await updateAdminAutoApproveSettings(false);
  if (ok) {
    adminAutoApproveDialog.close();
  }
});

adminRunAutoApproveNowButton.addEventListener("click", async () => {
  const targetShopIds = state.selectedShopId ? [state.selectedShopId] : state.autoApproveBulkShopIds;
  if (!targetShopIds.length) {
    showError("請先選擇要執行自動核准的商家。");
    return;
  }
  const ok = await runAutoApproveSweep(targetShopIds);
  if (ok) {
    adminAutoApproveDialog.close();
  }
});

window.addEventListener("load", async () => {
  try {
    await loadSession();
  } catch (error) {
    showError(error instanceof Error ? error.message : "初始化失敗");
  } finally {
    setAuthBooting(false);
    renderSession();
  }
});

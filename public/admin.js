const apiBaseUrl = (() => {
  const params = new URLSearchParams(window.location.search);
  return (params.get("apiBaseUrl") || window.APP_CONFIG?.apiBaseUrl || "").replace(/\/$/, "");
})();

const state = {
  user: null,
  authBooting: true,
  mode: "pending",
  page: 1,
  pageSize: "20",
  total: 0,
  pageCount: 1,
  searchTerm: "",
  transactions: [],
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
const adminCustomerSearchInput = document.getElementById("adminCustomerSearchInput");
const adminCustomerSearchButton = document.getElementById("adminCustomerSearchButton");
const adminCustomerSearchClearButton = document.getElementById("adminCustomerSearchClearButton");
const adminPageSizeSelect = document.getElementById("adminPageSizeSelect");
const adminRefreshButton = document.getElementById("adminRefreshButton");
const adminTransactionTableBody = document.getElementById("adminTransactionTableBody");
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

function formatCurrency(value) {
  return `MOP ${Number(value || 0).toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-Hant");
}

function getVerificationMeta(status) {
  if (status === "verified_amount_and_id") {
    return { tagClass: "verified-tag", thumbClass: "verified-thumb", label: "Verified amount and ID" };
  }
  if (status === "verified_id_only") {
    return { tagClass: "partial-verified-tag", thumbClass: "partial-verified-thumb", label: "Verified ID only" };
  }
  if (status === "no_match") {
    return { tagClass: "failed-tag", thumbClass: "failed-thumb", label: "No ID Match" };
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
  if (isAdmin) {
    adminNameBadge.textContent = `${state.user.fullName || "Admin"} (${state.user.adminLogin || "-"})`;
  } else {
    adminNameBadge.textContent = "未登入";
  }
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

function renderDetailDialog(transaction) {
  const shopName = transaction?.shops?.name || "-";
  const shopCode = transaction?.shops?.code || "-";
  adminDetailContent.innerHTML = `
    <div class="section-header">
      <h3>交易調查明細</h3>
      <span class="pill">${transaction.customer_code}</span>
    </div>
    <div class="detail-edit-summary">
      <span class="pill subtle-pill">店舖：${shopName}</span>
      <span class="pill subtle-pill">店舖編號：${shopCode}</span>
      <span class="pill subtle-pill">提交時間：${formatDateTime(transaction.submitted_at)}</span>
      <span class="pill subtle-pill">店主操作：${transaction.approved_by || "-"}</span>
    </div>
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
                <button class="thumb-button admin-detail-thumb ${getVerificationMeta(item?.verificationStatus)?.thumbClass || ""}" type="button" data-src="${item.previewUrl}" data-alt="交易明細 ${index + 1}">
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
                  item?.verificationAmountMatched == null ? "-" : item.verificationAmountMatched ? "Yes" : "No, auto corrected"
                }</span>
                <span>金額：${item?.manualAmount || item?.extracted?.amount || "-"}</span>
                <span>時間：${item?.extracted?.transactionTime || "-"}</span>
                <span>狀態：${item?.extracted?.orderStatus || "-"}</span>
                <span>支付方式：${item?.extracted?.paymentMethod || "-"}</span>
              </div>
            </section>
          `
        )
        .join("")}
    </div>
  `;

  adminDetailDialog.showModal();
  adminDetailContent.querySelectorAll(".admin-detail-thumb").forEach((button) => {
    button.addEventListener("click", () => showImageDialog(button.dataset.src, button.dataset.alt || "交易圖片"));
  });
}

function renderPagination() {
  adminPaginationInfo.textContent = `第 ${state.page} / ${state.pageCount} 頁，共 ${state.total} 筆`;
  adminPrevPageButton.disabled = state.page <= 1;
  adminNextPageButton.disabled = state.page >= state.pageCount || state.pageSize === "all";
}

function showImageDialog(src, alt) {
  adminDialogImage.src = src;
  adminDialogImage.alt = alt;
  adminImageDialog.showModal();
}

function renderTransactions(rows) {
  if (!rows.length) {
    adminTransactionTableBody.innerHTML = `<tr><td colspan="9"><div class="empty-state">目前沒有資料。</div></td></tr>`;
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
          <td>${formatDateTime(transaction.submitted_at)}</td>
          <td>${shopName}</td>
          <td>${transaction.customer_code}</td>
          <td>
            <div class="table-thumbnails">
              ${(transaction.items || [])
                .slice(0, 3)
                .map(
                  (item, index) => `
                    <button class="thumb-button admin-thumb-button ${getVerificationMeta(item?.verificationStatus)?.thumbClass || ""}" type="button" data-src="${item.previewUrl}" data-alt="交易明細 ${index + 1}">
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
          <td><button class="secondary-button admin-detail-button" data-id="${transaction.id}" type="button">明細</button></td>
        </tr>
      `;
    })
    .join("");

  adminTransactionTableBody.querySelectorAll(".admin-thumb-button").forEach((button) => {
    button.addEventListener("click", () => showImageDialog(button.dataset.src, button.dataset.alt || "交易圖片"));
  });
  adminTransactionTableBody.querySelectorAll(".admin-detail-button").forEach((button) => {
    button.addEventListener("click", () => {
      const transaction = state.transactions.find((row) => row.id === button.dataset.id);
      if (transaction) renderDetailDialog(transaction);
    });
  });

  renderPagination();
}

async function loadAdminData({ showOverlay = false, loadingText = "正在讀取資料..." } = {}) {
  if (state.user?.role !== "admin") return;
  if (showOverlay) setLoading(true, loadingText);
  try {
    const params = new URLSearchParams({
      mode: state.searchTerm ? "all" : state.mode,
      page: String(state.page),
      pageSize: String(state.pageSize),
      customerCode: state.searchTerm,
    });

    const [dashboardPayload, transactionsPayload] = await Promise.all([
      apiFetch("/api/admin/dashboard"),
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
  adminDashboardCards.innerHTML = "";
  adminTransactionTableBody.innerHTML = "";
  renderSession();
}

adminLoginButton.addEventListener("click", loginAdmin);
adminPasswordInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") await loginAdmin();
});
adminLogoutButton.addEventListener("click", logoutAdmin);

adminPendingTabButton.addEventListener("click", async () => {
  state.mode = "pending";
  state.page = 1;
  adminPendingTabButton.classList.add("active");
  adminHistoryTabButton.classList.remove("active");
  await loadAdminData({ showOverlay: true, loadingText: "正在載入待審核資料..." });
});

adminHistoryTabButton.addEventListener("click", async () => {
  state.mode = "history";
  state.page = 1;
  adminHistoryTabButton.classList.add("active");
  adminPendingTabButton.classList.remove("active");
  await loadAdminData({ showOverlay: true, loadingText: "正在載入歷史紀錄..." });
});

adminCustomerSearchButton.addEventListener("click", async () => {
  state.searchTerm = adminCustomerSearchInput.value.trim();
  state.page = 1;
  await loadAdminData({ showOverlay: true, loadingText: "正在搜尋資料..." });
});

adminCustomerSearchInput.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  state.searchTerm = adminCustomerSearchInput.value.trim();
  state.page = 1;
  await loadAdminData({ showOverlay: true, loadingText: "正在搜尋資料..." });
});

adminCustomerSearchClearButton.addEventListener("click", async () => {
  adminCustomerSearchInput.value = "";
  state.searchTerm = "";
  state.page = 1;
  await loadAdminData({ showOverlay: true, loadingText: "正在刷新資料..." });
});

adminPageSizeSelect.addEventListener("change", async () => {
  state.pageSize = adminPageSizeSelect.value;
  state.page = 1;
  await loadAdminData({ showOverlay: true, loadingText: "正在切換頁面..." });
});

adminRefreshButton.addEventListener("click", async () => {
  await loadAdminData({ showOverlay: true, loadingText: "正在刷新資料..." });
});

adminPrevPageButton.addEventListener("click", async () => {
  if (state.page <= 1) return;
  state.page -= 1;
  await loadAdminData({ showOverlay: true, loadingText: "正在切換頁面..." });
});

adminNextPageButton.addEventListener("click", async () => {
  if (state.page >= state.pageCount || state.pageSize === "all") return;
  state.page += 1;
  await loadAdminData({ showOverlay: true, loadingText: "正在切換頁面..." });
});

adminCloseDialogButton.addEventListener("click", () => adminImageDialog.close());
adminCloseDetailButton.addEventListener("click", () => adminDetailDialog.close());

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

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
  authBooting: true,
  searchTerm: "",
};

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
const autoApproveToggle = document.getElementById("autoApproveToggle");
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

function showStatus(message) {
  ownerStatusBanner.textContent = message;
  ownerStatusBanner.classList.remove("hidden");
}

function hideStatus() {
  ownerStatusBanner.classList.add("hidden");
  ownerStatusBanner.textContent = "";
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
                ${item?.validation?.isShopMismatch ? `<span class="warning-text">商戶名稱與店舖不符，系統已自動拒絕</span>` : ""}
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
                  <button class="thumb-button" type="button" data-src="${item.previewUrl}" data-alt="交易明細 ${index + 1}">
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
        showStatus("已核准交易");
        await loadOwnerData();
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
        showStatus("已拒絕交易");
        await loadOwnerData();
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
        showStatus("已撤回拒絕，交易已返回待審核");
        await loadOwnerData();
      } catch (error) {
        showError(error instanceof Error ? error.message : "撤回失敗");
        button.disabled = false;
      }
    });
  });
}

async function loadOwnerData() {
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

  const [dashboardPayload, transactionsPayload, settingsPayload] = await Promise.all([
    apiFetch(`/api/owner/dashboard?${params.toString()}`),
    apiFetch(`/api/owner/transactions?${transactionQuery.toString()}`),
    apiFetch("/api/owner/settings"),
  ]);

  renderDashboard(dashboardPayload.stats);
  state.transactions = transactionsPayload.rows || [];
  state.total = transactionsPayload.total || 0;
  state.pageCount = transactionsPayload.pageCount || 1;
  state.page = transactionsPayload.page || 1;
  state.autoApproveEnabled = Boolean(settingsPayload.settings?.auto_approve_enabled);
  autoApproveToggle.checked = state.autoApproveEnabled;
  renderTransactions(state.transactions);
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
    await loadOwnerData();
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
    await loadOwnerData();
  } catch (error) {
    showError(error instanceof Error ? error.message : "登入失敗");
  } finally {
    ownerLoginButton.disabled = false;
  }
}

async function logoutOwner() {
  await apiFetch("/api/auth/logout", { method: "POST" });
  state.user = null;
  state.searchTerm = "";
  customerSearchInput.value = "";
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
    await loadOwnerData();
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
    await loadOwnerData();
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
  await loadOwnerData();
});

historyTabButton.addEventListener("click", async () => {
  state.mode = "history";
  state.page = 1;
  state.selectedIds.clear();
  historyTabButton.classList.add("active");
  pendingTabButton.classList.remove("active");
  await loadOwnerData();
});

pageSizeSelect.addEventListener("change", async () => {
  state.pageSize = pageSizeSelect.value;
  state.page = 1;
  state.selectedIds.clear();
  await loadOwnerData();
});

customerSearchButton.addEventListener("click", async () => {
  state.searchTerm = customerSearchInput.value.trim();
  state.page = 1;
  state.selectedIds.clear();
  await loadOwnerData();
});

customerSearchInput.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  state.searchTerm = customerSearchInput.value.trim();
  state.page = 1;
  state.selectedIds.clear();
  await loadOwnerData();
});

customerSearchClearButton.addEventListener("click", async () => {
  customerSearchInput.value = "";
  state.searchTerm = "";
  state.page = 1;
  state.selectedIds.clear();
  await loadOwnerData();
});

prevPageButton.addEventListener("click", async () => {
  if (state.page <= 1) return;
  state.page -= 1;
  state.selectedIds.clear();
  await loadOwnerData();
});

nextPageButton.addEventListener("click", async () => {
  if (state.page >= state.pageCount) return;
  state.page += 1;
  state.selectedIds.clear();
  await loadOwnerData();
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
    showStatus("已完成批次核准");
    await loadOwnerData();
  } catch (error) {
    showError(error instanceof Error ? error.message : "批次核准失敗");
  } finally {
    batchApproveButton.disabled = false;
  }
});

autoApproveToggle.addEventListener("change", async () => {
  if (autoApproveToggle.checked) {
    const confirmed = window.confirm("開啟後，系統會每 5 分鐘自動核准所有待審核交易，無需人工操作。請先確認你已了解自動核准的風險，是否繼續？");
    if (!confirmed) {
      autoApproveToggle.checked = false;
      return;
    }
  }
  try {
    await apiFetch("/api/owner/settings", {
      method: "POST",
      body: JSON.stringify({ autoApproveEnabled: autoApproveToggle.checked }),
    });
    showStatus(autoApproveToggle.checked ? "已開啟自動核准，每 5 分鐘執行一次" : "已關閉自動核准");
  } catch (error) {
    autoApproveToggle.checked = !autoApproveToggle.checked;
    showError(error instanceof Error ? error.message : "更新自動核准失敗");
  }
});

ownerLoginButton.addEventListener("click", loginOwner);
ownerLogoutButton.addEventListener("click", logoutOwner);
refreshDashboardButton.addEventListener("click", loadOwnerData);
ownerCloseDialogButton.addEventListener("click", () => ownerImageDialog.close());
ownerCloseDetailButton.addEventListener("click", () => ownerDetailDialog.close());
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

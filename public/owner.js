const apiBaseUrl = (() => {
  const params = new URLSearchParams(window.location.search);
  return (params.get("apiBaseUrl") || window.APP_CONFIG?.apiBaseUrl || "").replace(/\/$/, "");
})();

const state = {
  user: null,
  mode: "pending",
};

const ownerStatusBanner = document.getElementById("ownerStatusBanner");
const ownerErrorCard = document.getElementById("ownerErrorCard");
const ownerLoginCard = document.getElementById("ownerLoginCard");
const ownerApp = document.getElementById("ownerApp");
const ownerLoginInput = document.getElementById("ownerLoginInput");
const ownerPasswordInput = document.getElementById("ownerPasswordInput");
const ownerLoginButton = document.getElementById("ownerLoginButton");
const ownerLogoutButton = document.getElementById("ownerLogoutButton");
const ownerShopBadge = document.getElementById("ownerShopBadge");
const ownerLoginBadge = document.getElementById("ownerLoginBadge");
const dateFromInput = document.getElementById("dateFromInput");
const dateToInput = document.getElementById("dateToInput");
const refreshDashboardButton = document.getElementById("refreshDashboardButton");
const pendingTabButton = document.getElementById("pendingTabButton");
const historyTabButton = document.getElementById("historyTabButton");
const dashboardCards = document.getElementById("dashboardCards");
const transactionList = document.getElementById("transactionList");

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
  ownerLoginCard.classList.toggle("hidden", isLoggedIn);
  ownerApp.classList.toggle("hidden", !isLoggedIn);

  if (!isLoggedIn) return;

  ownerShopBadge.textContent = state.user.shopName || "未命名店舖";
  ownerLoginBadge.textContent = state.user.ownerLogin || "-";
}

function renderDashboard(stats) {
  dashboardCards.innerHTML = `
    <article class="card stat-card"><div class="summary-label">上傳筆數</div><div class="summary-value small-value">${stats.uploadCount}</div></article>
    <article class="card stat-card"><div class="summary-label">上傳客戶數</div><div class="summary-value small-value">${stats.customerCount}</div></article>
    <article class="card stat-card"><div class="summary-label">充值總額</div><div class="summary-value small-value">${formatCurrency(stats.totalAmount)}</div></article>
    <article class="card stat-card"><div class="summary-label">已核准總額</div><div class="summary-value small-value">${formatCurrency(stats.approvedAmount)}</div></article>
  `;
}

function renderTransactions(transactions) {
  if (!transactions.length) {
    transactionList.innerHTML = `<div class="empty-state">目前沒有${state.mode === "pending" ? "待審核" : "歷史"}資料。</div>`;
    return;
  }

  transactionList.innerHTML = transactions
    .map(
      (transaction) => `
        <article class="transaction-card">
          <div class="transaction-head">
            <div>
              <h3>會員 ${transaction.customer_code}</h3>
              <p class="field-note">${formatDateTime(transaction.submitted_at)}</p>
            </div>
            <div class="transaction-actions">
              <span class="pill ${transaction.status === "approved" ? "approved-pill" : ""}">${transaction.status === "approved" ? "已核准" : "待審核"}</span>
              ${transaction.status === "pending" ? `<button class="primary-button approve-button" data-id="${transaction.id}" type="button">核准</button>` : ""}
            </div>
          </div>
          <div class="transaction-summary">
            <span>總額：${formatCurrency(transaction.total_amount)}</span>
            <span>圖片：${transaction.item_count} 張</span>
          </div>
          <div class="owner-items">
            ${(transaction.items || [])
              .map(
                (item, index) => `
                  <div class="owner-item">
                    <div class="owner-item-header">
                      <strong>交易明細 ${index + 1}</strong>
                      <span>${formatCurrency(item?.extracted?.amount)}</span>
                    </div>
                    <div class="owner-item-grid">
                      <a href="${item.previewUrl}" target="_blank" rel="noreferrer">查看圖片</a>
                      <span>商戶：${item?.extracted?.merchantName || "-"}</span>
                      <span>訂單號：${item?.extracted?.transactionOrderNo || "-"}</span>
                      <span>時間：${item?.extracted?.transactionTime || "-"}</span>
                      <span>狀態：${item?.extracted?.orderStatus || "-"}</span>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      `
    )
    .join("");

  transactionList.querySelectorAll(".approve-button").forEach((button) => {
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
}

async function loadOwnerData() {
  resetError();
  const params = new URLSearchParams();
  if (dateFromInput.value) params.set("from", dateFromInput.value);
  if (dateToInput.value) params.set("to", dateToInput.value);

  const [dashboardPayload, transactionsPayload] = await Promise.all([
    apiFetch(`/api/owner/dashboard?${params.toString()}`),
    apiFetch(`/api/owner/transactions?${new URLSearchParams({ ...Object.fromEntries(params), mode: state.mode }).toString()}`),
  ]);

  renderDashboard(dashboardPayload.stats);
  renderTransactions(transactionsPayload.transactions || []);
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
  renderOwnerSession();
  transactionList.innerHTML = "";
  dashboardCards.innerHTML = "";
  showStatus("已登出");
}

async function loadSession() {
  const payload = await apiFetch("/api/auth/me");
  state.user = payload.user;
  renderOwnerSession();
  if (state.user?.role === "owner") {
    await loadOwnerData();
  }
}

pendingTabButton.addEventListener("click", async () => {
  state.mode = "pending";
  pendingTabButton.classList.add("active");
  historyTabButton.classList.remove("active");
  await loadOwnerData();
});

historyTabButton.addEventListener("click", async () => {
  state.mode = "history";
  historyTabButton.classList.add("active");
  pendingTabButton.classList.remove("active");
  await loadOwnerData();
});

ownerLoginButton.addEventListener("click", loginOwner);
ownerLogoutButton.addEventListener("click", logoutOwner);
refreshDashboardButton.addEventListener("click", loadOwnerData);

window.addEventListener("load", async () => {
  try {
    await loadSession();
  } catch (error) {
    showError(error instanceof Error ? error.message : "初始化失敗");
  }
});

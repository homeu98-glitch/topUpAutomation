// Shared 10-second risk confirmation dialog.
// Used by the owner and admin auto-approve flows.
// Exposes a single `runRiskConfirm({ status, dialog, acceptButton, cancelButton,
//   countdown, title, body, titleId, bodyId })` helper via window.RiskConfirm.

const RISK_CONFIRM_DURATION_SECONDS = 10;

const RISK_CONFIRM_COPY = {
  no_match: {
    title: "確認啟用『單號不匹配』自動核准",
    body: "客戶可能拿別家商店的真實交易單號,或修改圖片讓單號無法被你核對。勾選啟用後,系統只要看到對應狀態的交易就會自動入帳,不再核對單號是否屬於你的商家。",
  },
  no_order_id: {
    title: "確認啟用『找不到交易單號』自動核准",
    body: "客戶上傳的圖可能根本不是交易截圖(例如空白、截到別的畫面、相片)。勾選啟用後,系統在畫面讀不到單號也會自動入帳,你之後無法靠單號追溯交易。",
  },
  ai_skipped: {
    title: "確認啟用『AI 未辨識』自動核准",
    body: "本次 AI 因額度滿或管線被跳過而沒讀圖。勾選啟用後,即使系統沒讀過內容,只要狀態對得上也會自動入帳,你完全依賴客戶自己聲稱的金額。",
  },
};

export function createRiskConfirm({
  dialog,
  titleElement,
  bodyElement,
  countdownElement,
  acceptButton,
  cancelButton,
  closeTrigger,
  onAccept,
  onCancel,
}) {
  if (!dialog) return null;
  const closeTimerLabel = "已關閉風險確認";

  function closeModal() {
    if (typeof dialog.close === "function") dialog.close();
  }

  function reset() {
    if (acceptButton) {
      acceptButton.disabled = true;
      acceptButton.textContent = "我了解並接受風險";
    }
    if (countdownElement) countdownElement.textContent = String(RISK_CONFIRM_DURATION_SECONDS);
  }

  function startCountdown() {
    if (!countdownElement || !acceptButton) return;
    let remaining = RISK_CONFIRM_DURATION_SECONDS;
    countdownElement.textContent = String(remaining);
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        countdownElement.textContent = "0";
        acceptButton.disabled = false;
        acceptButton.textContent = "我了解並接受風險";
      } else {
        countdownElement.textContent = String(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }

  function show({ status }) {
    const copy = RISK_CONFIRM_COPY[status];
    if (!copy) {
      console.warn("risk-confirm: unknown status", status);
      return Promise.resolve({ accepted: false, status });
    }
    if (titleElement) titleElement.textContent = copy.title;
    if (bodyElement) bodyElement.textContent = copy.body;
    reset();
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }

    return new Promise((resolve) => {
      let cleared = false;
      function cleanup(stopCountdownFn) {
        if (cleared) return;
        cleared = true;
        if (typeof stopCountdownFn === "function") stopCountdownFn();
        closeModal();
      }
      const stopCountdown = startCountdown();

      const acceptHandler = () => {
        cleanup(stopCountdown);
        acceptButton?.removeEventListener("click", acceptHandler);
        cancelButton?.removeEventListener("click", cancelHandler);
        closeTrigger?.removeEventListener("click", cancelHandler);
        dialog?.removeEventListener("cancel", cancelHandler);
        onAccept && onAccept(status);
        resolve({ accepted: true, status });
      };
      const cancelHandler = () => {
        cleanup(stopCountdown);
        acceptButton?.removeEventListener("click", acceptHandler);
        cancelButton?.removeEventListener("click", cancelHandler);
        closeTrigger?.removeEventListener("click", cancelHandler);
        dialog?.removeEventListener("cancel", cancelHandler);
        onCancel && onCancel(status);
        resolve({ accepted: false, status });
      };

      acceptButton?.addEventListener("click", acceptHandler);
      cancelButton?.addEventListener("click", cancelHandler);
      if (closeTrigger) closeTrigger.addEventListener("click", cancelHandler);
      dialog?.addEventListener("cancel", (event) => {
        event.preventDefault();
        cancelHandler();
      });
      dialog?.addEventListener("close", () => {
        // Safety net — if anything closes the dialog outside our handlers,
        // treat it as a cancellation so we don't leave the checkbox checked.
        if (!cleared) cancelHandler();
      });
    });
  }

  return { show, close: closeModal, _reset: reset };
}

// Convenience: directly check if a status triggers the modal.
export const RISKY_AUTO_APPROVE_STATUSES = ["no_match", "no_order_id", "ai_skipped"];
export function isRiskyAutoApproveStatus(status) {
  return RISKY_AUTO_APPROVE_STATUSES.includes(status);
}

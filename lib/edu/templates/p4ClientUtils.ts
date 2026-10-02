export const P4_URL_HELPERS_JS = `
  const DANGEROUS_PROTOCOL = /^(?:javascript|data|vbscript|file):/i;

  const isDangerousScheme = (value) => {
    const input = typeof value === "string" ? value.trim() : "";
    return DANGEROUS_PROTOCOL.test(input);
  };

  const ensureHttps = (value) => (/^[a-z][a-z\\d+.-]*:/i.test(value) ? value : \`https://\${value}\`);

  const normalizeUrl = (raw) => {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return { ok: false };
    if (isDangerousScheme(value)) return { ok: false };

    const candidate = ensureHttps(value);
    try {
      const parsed = new URL(candidate);
      if (isDangerousScheme(parsed.protocol)) return { ok: false };
      return { ok: true, url: parsed.toString() };
    } catch {
      return { ok: false };
    }
  };
`;

export const P4_MODAL_HELPERS_JS = `
  const P4_MODAL_STYLE_ID = "p4-modal-style";

  const ensureModalStyle = () => {
    if (document.getElementById(P4_MODAL_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = P4_MODAL_STYLE_ID;
    style.textContent = \`
      .p4-modal-backdrop { position: fixed; inset: 0; background: rgba(2, 6, 23, 0.55); display: grid; place-items: center; z-index: 9999; }
      .p4-modal { width: min(92vw, 460px); background: #fff; border-radius: 16px; padding: 18px; box-shadow: 0 20px 40px rgba(2, 6, 23, 0.3); border: 1px solid rgba(148, 163, 184, 0.35); }
      .p4-modal h4 { margin: 0 0 10px; font-size: 16px; }
      .p4-modal input { width: 100%; border: 1px solid rgba(148, 163, 184, 0.8); border-radius: 10px; padding: 10px; font-size: 14px; }
      .p4-modal-actions { margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px; }
      .p4-modal-actions button { border: 1px solid rgba(148, 163, 184, 0.7); border-radius: 10px; padding: 8px 12px; cursor: pointer; background: #fff; }
      .p4-modal-actions .confirm { border-color: rgba(59, 130, 246, 0.65); background: rgba(59, 130, 246, 0.1); color: #1d4ed8; }
      .p4-modal-error { min-height: 18px; margin: 8px 0 0; font-size: 12px; color: #dc2626; }
      .p4-modal-hint { min-height: 18px; margin: 4px 0 0; font-size: 12px; color: #475569; }
    \`;
    document.head.appendChild(style);
  };

  const createUrlModal = ({ title, initialValue }) => {
    const backdrop = document.createElement("div");
    backdrop.className = "p4-modal-backdrop";

    const dialog = document.createElement("div");
    dialog.className = "p4-modal";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const heading = document.createElement("h4");
    heading.textContent = title;

    const input = document.createElement("input");
    input.type = "url";
    input.placeholder = "https://example.com";
    input.value = initialValue;

    const error = document.createElement("p");
    error.className = "p4-modal-error";

    const hint = document.createElement("p");
    hint.className = "p4-modal-hint";

    const actions = document.createElement("div");
    actions.className = "p4-modal-actions";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "취소";

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "confirm";
    confirm.textContent = "확인";

    actions.append(cancel, confirm);
    dialog.append(heading, input, error, hint, actions);
    backdrop.appendChild(dialog);

    return { backdrop, input, error, hint, cancel, confirm };
  };

  const destroyUrlModal = ({ backdrop, trigger }) => {
    backdrop.remove();
    if (trigger && typeof trigger.focus === "function") trigger.focus();
  };

  const openUrlModal = ({ title, initialValue, onConfirm, trigger }) => {
    ensureModalStyle();
    const modal = createUrlModal({ title, initialValue });
    const hasUrlScheme = (value) => /^[a-z][a-z\d+.-]*:/i.test(value);

    const close = () => destroyUrlModal({ backdrop: modal.backdrop, trigger });

    modal.cancel.addEventListener("click", close);
    modal.backdrop.addEventListener("click", (event) => {
      if (event.target === modal.backdrop) close();
    });

    const renderFeedback = () => {
      const value = modal.input.value;
      const trimmed = typeof value === "string" ? value.trim() : "";
      if (!trimmed) {
        modal.error.textContent = "";
        modal.hint.textContent = "";
        return;
      }

      const normalized = normalizeUrl(trimmed);
      if (!normalized.ok || !normalized.url) {
        modal.error.textContent = "올바른 URL을 입력해 주세요.";
        modal.hint.textContent = "";
        return;
      }

      modal.error.textContent = "";
      if (!hasUrlScheme(trimmed) && normalized.url) {
        modal.hint.textContent = "https:// 자동 보정: " + normalized.url + " 로 저장됩니다";
        return;
      }
      modal.hint.textContent = "";
    };

    const submit = () => {
      const normalized = normalizeUrl(modal.input.value);
      if (!normalized.ok || !normalized.url) {
        modal.error.textContent = "올바른 URL을 입력해 주세요.";
        modal.hint.textContent = "";
        return;
      }
      onConfirm(normalized.url);
      close();
    };

    modal.confirm.addEventListener("click", submit);
    modal.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    });
    modal.input.addEventListener("input", renderFeedback);
    modal.backdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });

    document.body.appendChild(modal.backdrop);
    modal.input.focus();
    modal.input.select();
    renderFeedback();
  };
`;

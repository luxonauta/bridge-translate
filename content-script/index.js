let normalizeLanguageToCode;

const COMMAND_REGEX = /--t:\s*([a-zA-ZÀ-ÿ\- ]+)$/i;

let isTranslating = false;
let debounceTimer = null;

const commonStyles = {
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji",
  background: "rgba(20,20,20,0.96)",
  color: "#fff",
  borderRadius: "8px",
  boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
  zIndex: "2147483647"
};

(async function bootstrap() {
  const mod = await import(chrome.runtime.getURL("common/language-map.js"));
  normalizeLanguageToCode = mod.normalizeLanguageToCode;
  attachAutoDetector();
})();

function isEditable(el) {
  if (!el) return false;

  const tag = el.tagName?.toLowerCase();

  if (tag === "input") {
    const type = el.getAttribute("type") || "text";
    return (
      ["text", "search", "email", "url", "tel", "password"].includes(type) ||
      !type
    );
  }

  if (tag === "textarea") return true;

  if (el.isContentEditable) return true;

  return false;
}

function getDeepActiveElement(root = document) {
  let el = root.activeElement || null;

  while (el && el.shadowRoot && el.shadowRoot.activeElement) {
    el = el.shadowRoot.activeElement;
  }

  return el;
}

function getActiveEditable() {
  const el = getDeepActiveElement();
  return isEditable(el) ? el : null;
}

function getFieldTextAndCommand(el) {
  if (!el) return null;

  let value = "";

  if (
    el.tagName?.toLowerCase() === "input" ||
    el.tagName?.toLowerCase() === "textarea"
  ) {
    value = el.value;
  } else if (el.isContentEditable) {
    value = el.innerText;
  }

  const match = value.match(COMMAND_REGEX);

  if (!match) return null;

  const languageRaw = match[1];
  const precedingText = value.slice(0, match.index).trimEnd();

  return { text: precedingText, languageRaw };
}

function setFieldText(el, newText) {
  if (
    el.tagName?.toLowerCase() === "input" ||
    el.tagName?.toLowerCase() === "textarea"
  ) {
    el.value = newText;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  if (el.isContentEditable) {
    el.textContent = newText;

    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    return;
  }
}

function applyCommonStyles(element) {
  Object.assign(element.style, commonStyles);
}

function createShadowRootHost() {
  const host = document.createElement("div");
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.zIndex = commonStyles.zIndex;
  host.style.inset = "0";
  host.style.pointerEvents = "none";
  document.documentElement.appendChild(host);
  return host.attachShadow({ mode: "closed" });
}

function buildModalUi() {
  const shadow = createShadowRootHost();

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.inset = "0";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "flex-end";
  wrapper.style.justifyContent = "center";
  wrapper.style.pointerEvents = "none";

  const panel = document.createElement("div");
  panel.style.pointerEvents = "auto";
  panel.style.minWidth = "320px";
  panel.style.maxWidth = "640px";
  panel.style.margin = "16px";
  panel.style.borderRadius = "12px";
  panel.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
  panel.style.padding = "16px";
  panel.style.backdropFilter = "saturate(1.2) blur(8px)";
  applyCommonStyles(panel);

  const title = document.createElement("div");
  title.textContent = "Confirm Translation";
  title.style.fontSize = "14px";
  title.style.fontWeight = "600";
  title.style.marginBottom = "8px";
  title.style.opacity = "0.9";

  const box = document.createElement("div");
  box.style.display = "grid";
  box.style.gridTemplateColumns = "1fr";
  box.style.gap = "8px";

  const original = document.createElement("div");
  original.style.fontSize = "13px";
  original.style.lineHeight = "1.4";
  original.style.padding = "10px";
  original.style.borderRadius = "8px";
  original.style.background = "rgba(255,255,255,0.06)";

  const arrow = document.createElement("div");
  arrow.textContent = "↓";
  arrow.style.textAlign = "center";
  arrow.style.opacity = "0.7";

  const translated = document.createElement("div");
  translated.style.fontSize = "13px";
  translated.style.lineHeight = "1.4";
  translated.style.padding = "10px";
  translated.style.borderRadius = "8px";
  translated.style.background = "rgba(255,255,255,0.1)";

  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.gap = "8px";
  footer.style.justifyContent = "flex-end";
  footer.style.marginTop = "10px";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.background = "transparent";
  cancelBtn.style.border = "1px solid rgba(255,255,255,0.2)";
  cancelBtn.style.color = "#fff";
  cancelBtn.style.padding = "8px 12px";
  cancelBtn.style.borderRadius = "8px";
  cancelBtn.style.cursor = "pointer";

  const confirmBtn = document.createElement("button");
  confirmBtn.textContent = "Replace";
  confirmBtn.style.background = "#4f46e5";
  confirmBtn.style.border = "none";
  confirmBtn.style.color = "#fff";
  confirmBtn.style.padding = "8px 12px";
  confirmBtn.style.borderRadius = "8px";
  confirmBtn.style.cursor = "pointer";

  const loading = document.createElement("div");
  loading.style.display = "none";
  loading.style.justifyContent = "center";
  loading.style.alignItems = "center";
  loading.style.gap = "8px";
  loading.style.marginBottom = "8px";

  const spinner = document.createElement("div");
  spinner.style.width = "16px";
  spinner.style.height = "16px";
  spinner.style.border = "2px solid rgba(255,255,255,0.25)";
  spinner.style.borderTopColor = "#fff";
  spinner.style.borderRadius = "50%";
  spinner.style.animation = "spin 0.9s linear infinite";

  const style = document.createElement("style");
  style.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";

  loading.appendChild(spinner);
  loading.appendChild(document.createTextNode("Translating..."));

  box.appendChild(original);
  box.appendChild(arrow);
  box.appendChild(translated);
  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);
  panel.appendChild(style);
  panel.appendChild(title);
  panel.appendChild(loading);
  panel.appendChild(box);
  panel.appendChild(footer);
  wrapper.appendChild(panel);
  shadow.appendChild(wrapper);

  function showLoading(v) {
    loading.style.display = v ? "flex" : "none";
    box.style.opacity = v ? "0.6" : "1";
  }

  function destroy() {
    shadow.host.remove();
  }

  return {
    original,
    translated,
    confirmBtn,
    cancelBtn,
    showLoading,
    destroy,
    shadowRoot: shadow
  };
}

async function getSettings() {
  const res = await chrome.runtime.sendMessage({ type: "get-settings" });
  if (res?.ok) return res.settings;
  return {
    nativeLanguageCode: "pt",
    preferNativeAsSource: true,
    showConfirmModal: true
  };
}

async function requestTranslation(payload) {
  return chrome.runtime.sendMessage({ type: "translate", payload });
}

function removeCommandSuffix(el) {
  if (!el) return;

  let value = "";

  if (
    el.tagName?.toLowerCase() === "input" ||
    el.tagName?.toLowerCase() === "textarea"
  ) {
    value = el.value;
    value = value.replace(COMMAND_REGEX, "").trimEnd();
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return value;
  }

  if (el.isContentEditable) {
    value = el.innerText;
    value = value.replace(COMMAND_REGEX, "").trimEnd();
    el.textContent = value;
    return value;
  }

  return "";
}

function showToast(text) {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "50%";
  host.style.bottom = "16px";
  host.style.transform = "translateX(-50%)";
  host.style.fontSize = "12px";
  host.style.padding = "8px 12px";
  host.style.pointerEvents = "none";
  host.textContent = text;
  applyCommonStyles(host);
  document.documentElement.appendChild(host);
  setTimeout(() => host.remove(), 1800);
}

function attachAutoDetector() {
  document.addEventListener("input", onUserInput, true);
  document.addEventListener("blur", onUserInput, true);
}

function onUserInput() {
  const el = getActiveEditable();

  if (!el) return;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => tryTriggerTranslation(el), 500);
}

function tryTriggerTranslation(el) {
  if (isTranslating) return;

  const parsed = getFieldTextAndCommand(el);

  if (!parsed) return;

  handleTranslateAuto(el, parsed);
}

async function handleTranslateAuto(el, parsed) {
  isTranslating = true;

  try {
    const baseText = parsed.text;
    const targetCode = normalizeLanguageToCode(parsed.languageRaw);

    if (!baseText || !baseText.trim()) return;

    if (!targetCode) {
      showToast("Invalid language");
      return;
    }

    const settings = await getSettings();
    const cleanSourceValue = removeCommandSuffix(el);

    const ui = buildModalUi();
    ui.original.textContent = cleanSourceValue;
    ui.translated.textContent = "";
    ui.showLoading(true);

    const res = await requestTranslation({
      text: cleanSourceValue,
      nativeLanguageCode: settings.nativeLanguageCode || "pt",
      targetLanguage: targetCode,
      preferNativeAsSource: settings.preferNativeAsSource !== false
    });

    if (!res || !res.ok) {
      ui.destroy();
      showToast(res && res.error ? String(res.error) : "Translation failed");
      return;
    }

    const translated =
      res.result && res.result.translation ? res.result.translation : "";
    ui.translated.textContent = translated;
    ui.showLoading(false);

    function confirm() {
      setFieldText(el, translated);
      ui.destroy();
    }

    function cancel() {
      ui.destroy();
    }

    ui.confirmBtn.addEventListener("click", confirm);
    ui.cancelBtn.addEventListener("click", cancel);
    ui.shadowRoot.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") confirm();
      if (ev.key === "Escape") cancel();
    });

    if (settings.showConfirmModal === false) confirm();
  } finally {
    isTranslating = false;
  }
}

let normalizeLanguageToCode;

const TRANSLATION_COMMAND_PATTERN = /--t:\s*([a-zA-ZÀ-ÿ\- ]+)$/i;

let isTranslating = false;
let debounceTimer = null;

const commonStyles = {
  fontFamily: "system-ui, sans-serif",
  background: "#FFFF",
  color: "#1C2024",
  borderRadius: "0.375rem",
  boxShadow: "0 .375rem 1.5rem #0000000f",
  zIndex: "9999999999"
};

(async function bootstrap() {
  const mod = await import(chrome.runtime.getURL("common/language-map.js"));
  normalizeLanguageToCode = mod.normalizeLanguageToCode;
  injectGlobalStylesheet();
  registerAutoDetection();
})();

function injectGlobalStylesheet() {
  const href = chrome.runtime.getURL("styles/dialogs.css");
  if (![...document.styleSheets].some((s) => s.href === href)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

function isEditableElement(element) {
  if (!element) return false;

  const tag = element.tagName?.toLowerCase();

  if (tag === "input") {
    const type = element.getAttribute("type") || "text";
    return (
      ["text", "search", "email", "url", "tel", "password"].includes(type) ||
      !type
    );
  }

  if (tag === "textarea") return true;
  if (element.isContentEditable) return true;

  return false;
}

function getDeepActiveElement(root = document) {
  let element = root.activeElement || null;
  while (element && element.shadowRoot && element.shadowRoot.activeElement) {
    element = element.shadowRoot.activeElement;
  }
  return element;
}

function getActiveEditableElement() {
  const element = getDeepActiveElement();
  return isEditableElement(element) ? element : null;
}

function parseFieldTextAndCommand(element) {
  if (!element) return null;

  let value = "";
  const tag = element.tagName?.toLowerCase();

  if (tag === "input" || tag === "textarea") {
    value = element.value;
  } else if (element.isContentEditable) {
    value = element.innerText;
  }

  const match = value.match(TRANSLATION_COMMAND_PATTERN);
  if (!match) return null;

  const languageRaw = match[1];
  const precedingText = value.slice(0, match.index).trimEnd();
  return { text: precedingText, languageRaw };
}

function setFieldText(element, newText) {
  const tag = element.tagName?.toLowerCase();

  if (tag === "input" || tag === "textarea") {
    element.value = newText;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  if (element.isContentEditable) {
    element.textContent = newText;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }
}

function createOverlayShadowHost() {
  const host = document.createElement("div");
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.zIndex = commonStyles.zIndex;
  host.style.inset = "0";
  host.style.pointerEvents = "none";
  document.documentElement.appendChild(host);
  return host.attachShadow({ mode: "closed" });
}

function attachStylesheetToShadowRoot(shadowRoot) {
  const href = chrome.runtime.getURL("styles/dialogs.css");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  shadowRoot.appendChild(link);
}

function buildConfirmationDialog() {
  const shadowRoot = createOverlayShadowHost();
  attachStylesheetToShadowRoot(shadowRoot);

  const container = document.createElement("div");
  container.className = "bt-dialog-overlay";

  const panel = document.createElement("div");
  panel.className = "bt-dialog";

  const title = document.createElement("div");
  title.className = "bt-title";
  title.textContent = "Confirm Translation";

  const content = document.createElement("div");
  content.className = "bt-content";

  const sourceText = document.createElement("div");
  sourceText.className = "bt-source-text";

  const directionIndicator = document.createElement("div");
  directionIndicator.className = "bt-indicator";
  directionIndicator.textContent = "↓";

  const translatedText = document.createElement("div");
  translatedText.className = "bt-translated-text";

  const footer = document.createElement("div");
  footer.className = "bt-actions";

  const cancelButton = document.createElement("button");
  cancelButton.className = "bt-button bt-cancel";
  cancelButton.textContent = "Cancel";

  const confirmButton = document.createElement("button");
  confirmButton.className = "bt-button bt-confirm";
  confirmButton.textContent = "Replace";

  const loading = document.createElement("div");
  loading.className = "bt-loading";

  const spinner = document.createElement("div");
  spinner.className = "bt-loading-spinner";

  loading.appendChild(spinner);
  loading.appendChild(document.createTextNode("Translating..."));

  content.appendChild(sourceText);
  content.appendChild(directionIndicator);
  content.appendChild(translatedText);
  footer.appendChild(cancelButton);
  footer.appendChild(confirmButton);
  panel.appendChild(title);
  panel.appendChild(loading);
  panel.appendChild(content);
  panel.appendChild(footer);
  container.appendChild(panel);
  shadowRoot.appendChild(container);

  function setLoadingVisible(visible) {
    loading.style.display = visible ? "flex" : "none";
    content.style.opacity = visible ? "0.6" : "1";
  }

  function destroy() {
    shadowRoot.host.remove();
  }

  return {
    sourceText,
    translatedText,
    confirmButton,
    cancelButton,
    setLoadingVisible,
    destroy,
    shadowRoot
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

function removeTranslationCommandSuffix(element) {
  if (!element) return "";

  let value = "";
  const tag = element.tagName?.toLowerCase();

  if (tag === "input" || tag === "textarea") {
    value = element.value;
    value = value.replace(TRANSLATION_COMMAND_PATTERN, "").trimEnd();
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    return value;
  }

  if (element.isContentEditable) {
    value = element.innerText;
    value = value.replace(TRANSLATION_COMMAND_PATTERN, "").trimEnd();
    element.textContent = value;
    return value;
  }

  return "";
}

function showToast(message) {
  const host = document.createElement("div");
  host.className = "bt-toast";
  host.textContent = message;
  document.documentElement.appendChild(host);
  setTimeout(() => host.remove(), 2400);
}

function registerAutoDetection() {
  document.addEventListener("input", handleUserInputEvent, true);
  document.addEventListener("blur", handleUserInputEvent, true);
}

function handleUserInputEvent() {
  const element = getActiveEditableElement();
  if (!element) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => attemptTranslationTrigger(element), 600);
}

function attemptTranslationTrigger(element) {
  if (isTranslating) return;
  const parsed = parseFieldTextAndCommand(element);
  if (!parsed) return;
  handleAutoTranslation(element, parsed);
}

async function handleAutoTranslation(element, parsed) {
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
    const cleanSourceValue = removeTranslationCommandSuffix(element);
    const dialog = buildConfirmationDialog();
    dialog.sourceText.textContent = cleanSourceValue;
    dialog.translatedText.textContent = "";
    dialog.setLoadingVisible(true);
    const res = await requestTranslation({
      text: cleanSourceValue,
      nativeLanguageCode: settings.nativeLanguageCode || "pt",
      targetLanguage: targetCode,
      preferNativeAsSource: settings.preferNativeAsSource !== false
    });

    if (!res || !res.ok) {
      dialog.destroy();
      showToast(res && res.error ? String(res.error) : "Translation failed");
      return;
    }

    const translation =
      res.result && res.result.translation ? res.result.translation : "";
    dialog.translatedText.textContent = translation;
    dialog.setLoadingVisible(false);

    function confirm() {
      setFieldText(element, translation);
      dialog.destroy();
    }

    function cancel() {
      dialog.destroy();
    }

    dialog.confirmButton.addEventListener("click", confirm);
    dialog.cancelButton.addEventListener("click", cancel);
    dialog.shadowRoot.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") confirm();
      if (ev.key === "Escape") cancel();
    });

    if (settings.showConfirmModal === false) confirm();
  } finally {
    isTranslating = false;
  }
}

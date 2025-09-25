import { normalizeLanguageToCode } from "../common/language-map.js";

const nativeInput = document.querySelector("#native");
const preferNative = document.querySelector("#prefer-native");
const confirmModal = document.querySelector("#confirm-modal");
const saveBtn = document.querySelector("#save");
const clearBtn = document.querySelector("#clear");
const historyEl = document.querySelector("#history");

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString();
}

async function loadSettings() {
  const res = await chrome.runtime.sendMessage({ type: "get-settings" });

  if (res?.ok) {
    nativeInput.value = res.settings.nativeLanguageCode || "pt";
    preferNative.checked = res.settings.preferNativeAsSource !== false;
    confirmModal.checked = res.settings.showConfirmModal !== false ? true : false;
  } else {
    nativeInput.value = "pt";
    preferNative.checked = true;
    confirmModal.checked = true;
  }
}

async function saveSettings() {
  const code = normalizeLanguageToCode(nativeInput.value) || "pt";

  const settings = {
    nativeLanguageCode: code,
    preferNativeAsSource: preferNative.checked,
    showConfirmModal: confirmModal.checked
  };

  const res = await chrome.runtime.sendMessage({ type: "set-settings", settings });

  if (res?.ok) {
    saveBtn.textContent = "Saved";
    setTimeout(() => (saveBtn.textContent = "Save"), 1000);
  }
}

function renderHistory(items) {
  historyEl.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    historyEl.innerHTML = "<div class='small'>No translations yet</div>";
    return;
  }

  for (const it of items) {
    const div = document.createElement("div");
    div.className = "item";
    const meta = document.createElement("div");
    meta.className = "meta";
    const left = document.createElement("div");
    left.textContent = `${it.sourceLanguage} → ${it.targetLanguage}`;
    const right = document.createElement("div");
    right.textContent = fmtTime(it.createdAt);
    meta.appendChild(left);
    meta.appendChild(right);
    const original = document.createElement("div");
    original.className = "text";
    original.textContent = it.originalText;
    const arrow = document.createElement("div");
    arrow.className = "text";
    arrow.textContent = "↓";
    const translated = document.createElement("div");
    translated.className = "text";
    translated.textContent = it.translatedText;
    div.appendChild(meta);
    div.appendChild(original);
    div.appendChild(arrow);
    div.appendChild(translated);
    historyEl.appendChild(div);
  }
}

async function loadHistory() {
  const res = await chrome.runtime.sendMessage({ type: "get-history" });
  if (res?.ok) renderHistory(res.history);
}

async function clearHistory() {
  const res = await chrome.runtime.sendMessage({ type: "clear-history" });
  if (res?.ok) loadHistory();
}

saveBtn.addEventListener("click", saveSettings);
clearBtn.addEventListener("click", clearHistory);
loadSettings();
loadHistory();
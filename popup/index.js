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
    confirmModal.checked =
      res.settings.showConfirmModal !== false ? true : false;
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

  const res = await chrome.runtime.sendMessage({
    type: "set-settings",
    settings
  });

  if (res?.ok) {
    saveBtn.textContent = "✅ Saved";
    setTimeout(() => (saveBtn.textContent = "Save preferences"), 1800);
  }
}

function renderHistory(items) {
  historyEl.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    historyEl.innerHTML =
      "<div class='bt-item'><p>🙈 No translations yet.</p></div>";
    return;
  }

  for (const it of items) {
    const div = document.createElement("div");
    div.className = "bt-item";

    const meta = document.createElement("p");
    meta.className = "bt-meta";

    const left = document.createElement("span");
    left.textContent = `${it.sourceLanguage} → ${it.targetLanguage}`;
    const right = document.createElement("span");
    right.textContent = fmtTime(it.createdAt);

    meta.appendChild(left);
    meta.appendChild(right);

    const translation = document.createElement("p");
    translation.className = "bt-translation";

    const original = document.createElement("span");
    original.className = "bt-text";
    original.textContent = it.originalText;

    const arrow = document.createElement("span");
    arrow.textContent = " → ";

    const translated = document.createElement("span");
    translated.textContent = it.translatedText;

    translation.appendChild(original);
    translation.appendChild(arrow);
    translation.appendChild(translated);

    div.appendChild(meta);
    div.appendChild(translation);
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

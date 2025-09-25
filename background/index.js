const OFFSCREEN_URL = chrome.runtime.getURL("offscreen/index.html");
const HISTORY_KEY = "translationHistory";
const SETTINGS_KEY = "translatorSettings";

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({});
  const hasOffscreen = contexts.some(
    (c) =>
      c.contextType === "OFFSCREEN_DOCUMENT" && c.documentUrl === OFFSCREEN_URL
  );

  if (!hasOffscreen) {
    await chrome.offscreen.createDocument({
      url: "offscreen/index.html",
      reasons: ["IFRAME_SCRIPTING"],
      justification:
        "Use built-in Translator and LanguageDetector APIs in a windowed context."
    });
  }
}

async function readSettings() {
  const { translatorSettings } = await chrome.storage.local.get(SETTINGS_KEY);
  return (
    translatorSettings || {
      nativeLanguageCode: "pt",
      preferNativeAsSource: true,
      showConfirmModal: true
    }
  );
}

async function writeSettings(next) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

async function appendHistory(entry) {
  const { translationHistory } = await chrome.storage.local.get(HISTORY_KEY);
  const list = Array.isArray(translationHistory) ? translationHistory : [];
  const next = [
    { ...entry, id: crypto.randomUUID(), createdAt: Date.now() },
    ...list
  ].slice(0, 10);

  await chrome.storage.local.set({ [HISTORY_KEY]: next });

  return next;
}

async function getHistory() {
  const { translationHistory } = await chrome.storage.local.get(HISTORY_KEY);
  return Array.isArray(translationHistory) ? translationHistory : [];
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ping") {
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "get-settings") {
    readSettings().then((s) => sendResponse({ ok: true, settings: s }));
    return true;
  }

  if (message?.type === "set-settings") {
    writeSettings(message.settings).then((s) =>
      sendResponse({ ok: true, settings: s })
    );
    return true;
  }

  if (message?.type === "get-history") {
    getHistory().then((h) => sendResponse({ ok: true, history: h }));
    return true;
  }

  if (message?.type === "clear-history") {
    chrome.storage.local
      .set({ [HISTORY_KEY]: [] })
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "translate") {
    ensureOffscreen().then(() => {
      chrome.runtime
        .sendMessage({ type: "offscreen-translate", payload: message.payload })
        .then((result) => {
          if (result?.ok) {
            appendHistory({
              originalText: message.payload.text,
              translatedText: result.translation,
              sourceLanguage: result.sourceLanguage,
              targetLanguage: result.targetLanguage,
              url: sender?.tab?.url || "",
              title: sender?.tab?.title || ""
            }).then(() => sendResponse({ ok: true, result }));
          } else {
            sendResponse({
              ok: false,
              error: result?.error || "Unknown error"
            });
          }
        })
        .catch((err) =>
          sendResponse({ ok: false, error: String(err?.message || err) })
        );
    });

    return true;
  }
});

const I18N = {
  fr: {
    title: "Tuya Web Control",
    refreshDevices: "Rafraichir les equipements",
    searchPlaceholder: "Rechercher un equipement...",
    showDetails: "Afficher details",
    hideDetails: "Masquer details",
    online: "en ligne",
    offline: "hors ligne",
    unknownState: "etat inconnu",
    unknownCategory: "categorie inconnue",
    unknownProduct: "produit inconnu",
    unknownName: "(sans nom)",
    idLabel: "ID",
    labels: "Labels",
    supportedCodes: "Codes supportes",
    sending: "Envoi...",
    apiError: "Erreur API",
    cannotLoadCapabilities: "Impossible de charger les capacites du device",
    statusCurrent: "Status actuel",
    unavailable: "indisponible",
    loading: "Chargement...",
    noCodeDetected: "Aucun code detecte pour ce device.",
    tuyaCodeLabel: 'Code Tuya (ex: switch_1, bright_value_v2)',
    jsonValueLabel: 'Valeur JSON (ex: true, 50, "auto")',
    sendCommand: "Envoyer commande",
    brightness: "Luminosite",
    openDoor: "OPEN",
    stopDoor: "STOP",
    closeDoor: "CLOSE",
    invalidJson: "Valeur JSON invalide",
    cannotLoadDevices: "Impossible de charger les equipements",
    noDevicesFound: "Aucun equipement trouve.",
    noDevicesMatch: "Aucun equipement ne correspond a la recherche.",
    door: "Porte",
    doorOpen: "Ouverte",
    doorClosed: "Fermee",
    battery: "Batterie",
  },
  en: {
    title: "Tuya Web Control",
    refreshDevices: "Refresh devices",
    searchPlaceholder: "Search devices...",
    showDetails: "Show details",
    hideDetails: "Hide details",
    online: "online",
    offline: "offline",
    unknownState: "unknown state",
    unknownCategory: "unknown category",
    unknownProduct: "unknown product",
    unknownName: "(unnamed)",
    idLabel: "ID",
    labels: "Labels",
    supportedCodes: "Supported codes",
    sending: "Sending...",
    apiError: "API error",
    cannotLoadCapabilities: "Unable to load device capabilities",
    statusCurrent: "Current status",
    unavailable: "unavailable",
    loading: "Loading...",
    noCodeDetected: "No code detected for this device.",
    tuyaCodeLabel: 'Tuya code (e.g. switch_1, bright_value_v2)',
    jsonValueLabel: 'JSON value (e.g. true, 50, "auto")',
    sendCommand: "Send command",
    brightness: "Brightness",
    openDoor: "OPEN",
    stopDoor: "STOP",
    closeDoor: "CLOSE",
    invalidJson: "Invalid JSON value",
    cannotLoadDevices: "Unable to load devices",
    noDevicesFound: "No device found.",
    noDevicesMatch: "No device matches your search.",
    door: "Door",
    doorOpen: "Open",
    doorClosed: "Closed",
    battery: "Battery",
  },
};

function detectBrowserLang() {
  const browserLang = String(navigator.language || "en").toLowerCase();
  return browserLang.startsWith("fr") ? "fr" : "en";
}

function getQueryLang() {
  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang");
  return lang === "fr" || lang === "en" ? lang : null;
}

let currentLang = getQueryLang() || detectBrowserLang();
let allDevices = [];
let currentSearchQuery = "";
let renderedDeviceCards = [];

function t(key) {
  return I18N[currentLang][key] || I18N.en[key] || key;
}

function updateStaticTexts() {
  document.documentElement.lang = currentLang;
  document.title = t("title");
  document.querySelector(".top-bar h1").textContent = t("title");
  document.getElementById("refresh-btn").textContent = t("refreshDevices");
  document.getElementById("lang-toggle-btn").textContent = currentLang === "fr" ? "EN" : "FR";
  document.getElementById("device-search").placeholder = t("searchPlaceholder");
}

function showError(message) {
  const box = document.getElementById("error-box");
  box.textContent = message;
  box.classList.remove("hidden");
}

function clearError() {
  const box = document.getElementById("error-box");
  box.textContent = "";
  box.classList.add("hidden");
}

function getOnlineTag(device) {
  if (device.online === true) return t("online");
  if (device.online === false) return t("offline");
  return t("unknownState");
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (_e) {
    return String(value);
  }
}

function normalizeResult(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.result)) return payload.result;
  return [];
}

function extractCodes(capabilities) {
  const funcs = normalizeResult(capabilities.functions);
  const props = normalizeResult(capabilities.properties);
  const status = normalizeResult(capabilities.status);
  const byCode = new Map();

  [...funcs, ...props, ...status].forEach((item) => {
    if (item && item.code && !byCode.has(item.code)) {
      byCode.set(item.code, item);
    }
  });
  return Array.from(byCode.values());
}

function codeSet(items) {
  return new Set((items || []).map((item) => item?.code).filter(Boolean));
}

function getStatusValue(device, code, fallback = null) {
  const status = Array.isArray(device.status) ? device.status : [];
  const found = status.find((item) => item && item.code === code);
  return found ? found.value : fallback;
}

function getCapabilityValue(code, statusItems, propertyItems, device, fallback = null) {
  const statusFound = (statusItems || []).find((item) => item && item.code === code);
  if (statusFound && statusFound.value !== undefined) return statusFound.value;

  const propFound = (propertyItems || []).find((item) => item && item.code === code);
  if (propFound && propFound.value !== undefined) return propFound.value;

  return getStatusValue(device, code, fallback);
}

function buildMergedValues(statusItems, propertyItems) {
  const merged = new Map();
  [...(statusItems || []), ...(propertyItems || [])].forEach((item) => {
    if (!item || !item.code) return;
    if (!merged.has(item.code)) {
      merged.set(item.code, item.value);
    }
  });
  return merged;
}

function buildFocusedStatusText(mergedValues) {
  const focusCodes = [
    "control",
    "doorcontact_state",
    "battery_percentage",
    "switch_1",
    "switch_led",
    "switch_led_1",
    "bright_value_1",
    "bright_value_v2",
  ];
  const rows = [];

  function formatFocusedValue(code, value) {
    if (code === "doorcontact_state") {
      if (value === true || value === "true" || value === 1 || value === "1") {
        return `${t("door")}: ${t("doorOpen")}`;
      }
      if (value === false || value === "false" || value === 0 || value === "0") {
        return `${t("door")}: ${t("doorClosed")}`;
      }
      return `${t("door")}: ${String(value)}`;
    }

    if (code === "battery_percentage") {
      const batteryValue =
        typeof value === "number" ? value : Number.parseFloat(String(value));
      if (Number.isFinite(batteryValue)) {
        return `${t("battery")}: ${Math.round(batteryValue)}%`;
      }
      return `${t("battery")}: ${String(value)}`;
    }

    const printable = typeof value === "object" ? safeJson(value) : String(value);
    return `${code}: ${printable}`;
  }

  focusCodes.forEach((code) => {
    if (!mergedValues.has(code)) return;
    const value = mergedValues.get(code);
    rows.push(formatFocusedValue(code, value));
  });

  if (rows.length === 0) return `${t("statusCurrent")}: ${t("unavailable")}`;
  return `${t("statusCurrent")}: ${rows.join(" | ")}`;
}

function createDetailsBlock(card, device, codes, mergedValues) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "details-btn";
  button.textContent = t("showDetails");

  const details = document.createElement("div");
  details.className = "details-block hidden";

  const idLine = document.createElement("p");
  idLine.className = "meta";
  idLine.textContent = `${t("idLabel")}: ${device.id}`;
  details.appendChild(idLine);

  const labelsLine = document.createElement("p");
  labelsLine.className = "meta";
  labelsLine.textContent = `${t("labels")}: ${getOnlineTag(device)} | ${
    device.category || t("unknownCategory")
  } | ${device.product_name || t("unknownProduct")}`;
  details.appendChild(labelsLine);

  const codesLine = document.createElement("p");
  codesLine.className = "meta";
  codesLine.textContent = `${t("supportedCodes")}: ${codes.map((c) => c.code).join(", ")}`;
  details.appendChild(codesLine);

  mergedValues.forEach((value, code) => {
    const row = document.createElement("p");
    row.className = "meta details-row";
    row.textContent = `${code}: ${typeof value === "object" ? safeJson(value) : String(value)}`;
    details.appendChild(row);
  });

  button.addEventListener("click", () => {
    const isHidden = details.classList.contains("hidden");
    details.classList.toggle("hidden");
    button.textContent = isHidden ? t("hideDetails") : t("showDetails");
  });

  card.appendChild(button);
  card.appendChild(details);
}

async function sendCommands(deviceId, commands, outputEl) {
  outputEl.textContent = t("sending");
  const response = await fetch(`/api/devices/${deviceId}/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || t("apiError"));
  }
  outputEl.textContent = safeJson(data);
}

async function loadCapabilities(deviceId) {
  const response = await fetch(`/api/devices/${deviceId}/capabilities`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || t("cannotLoadCapabilities"));
  }
  return data;
}

function createDeviceCard(device) {
  const card = document.createElement("article");
  card.className = "device-card";

  const title = document.createElement("h3");
  title.textContent = device.name || t("unknownName");
  card.appendChild(title);

  const statusSummary = document.createElement("p");
  statusSummary.className = "meta status-summary";
  statusSummary.textContent = `${t("statusCurrent")}: ${t("loading")}`;
  card.appendChild(statusSummary);
  let mergedValues = new Map();

  function refreshStatusSummary() {
    statusSummary.textContent = buildFocusedStatusText(mergedValues);
  }

  function applyCommandsToLocalState(commands) {
    (commands || []).forEach((cmd) => {
      if (!cmd || !cmd.code) return;
      mergedValues.set(cmd.code, cmd.value);
    });
    refreshStatusSummary();
  }

  const quick = document.createElement("div");
  quick.className = "quick-actions";
  card.appendChild(quick);

  const result = document.createElement("pre");
  result.className = "result";
  card.appendChild(result);

  let form = null;
  const loading = document.createElement("p");
  loading.className = "meta";
  loading.textContent = t("loading");
  card.appendChild(loading);

  function ensureCommandForm() {
    if (form) return form;
    form = document.createElement("form");
    form.className = "cmd-form";
    form.innerHTML = `
      <label>${t("tuyaCodeLabel")}</label>
      <input type="text" name="code" required />
      <label>${t("jsonValueLabel")}</label>
      <textarea name="value" required>true</textarea>
      <button type="submit">${t("sendCommand")}</button>
    `;
    card.insertBefore(form, result);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const code = form.code.value.trim();
      const rawValue = form.value.value.trim();
      if (!code) return;

      let parsedValue;
      try {
        parsedValue = JSON.parse(rawValue);
      } catch (_e) {
        result.textContent = t("invalidJson");
        return;
      }

      try {
        const commands = [{ code, value: parsedValue }];
        await sendCommands(device.id, commands, result);
        applyCommandsToLocalState(commands);
      } catch (e) {
        result.textContent = e.message;
      }
    });

    return form;
  }

  loadCapabilities(device.id)
    .then((capabilities) => {
      const codes = extractCodes(capabilities);
      const funcs = normalizeResult(capabilities.functions);
      const props = normalizeResult(capabilities.properties);
      const statusItems = normalizeResult(capabilities.status);
      const functionCodes = codeSet(funcs);
      const statusCodes = codeSet(statusItems);
      const propertyCodes = codeSet(props);

      if (codes.length === 0) {
        loading.textContent = t("noCodeDetected");
        return;
      }
      loading.remove();

      mergedValues = buildMergedValues(statusItems, props);
      refreshStatusSummary();
      createDetailsBlock(card, device, codes, mergedValues);

      const hasDoorContactReadonly =
        (statusCodes.has("doorcontact_state") || propertyCodes.has("doorcontact_state")) &&
        !functionCodes.has("doorcontact_state");
      const hasBatteryReadonly =
        (statusCodes.has("battery_percentage") || propertyCodes.has("battery_percentage")) &&
        !functionCodes.has("battery_percentage");
      const isSensorReadOnly = (hasDoorContactReadonly || hasBatteryReadonly) && funcs.length === 0;

      if (isSensorReadOnly) {
        return;
      }

      const hasSwitchLed = codes.some((c) => c.code === "switch_led");
      const hasSwitchLed1 = codes.some((c) => c.code === "switch_led_1");
      const hasBright1 = codes.some((c) => c.code === "bright_value_1");
      const hasSwitch1 = codes.some((c) => c.code === "switch_1");
      const hasBrightV2 = codes.some((c) => c.code === "bright_value_v2");
      const ledSwitchCode = hasSwitchLed
        ? "switch_led"
        : hasSwitchLed1
        ? "switch_led_1"
        : null;
      const ledBrightCode = hasBright1 ? "bright_value_1" : hasBrightV2 ? "bright_value_v2" : null;

      if (ledSwitchCode && ledBrightCode) {
        const onBtn = document.createElement("button");
        onBtn.textContent = "ON";
        const offBtn = document.createElement("button");
        offBtn.textContent = "OFF";
        quick.appendChild(onBtn);
        quick.appendChild(offBtn);

        const sliderWrap = document.createElement("div");
        sliderWrap.className = "slider-wrap";
        const brightnessValue =
          Number(
            getCapabilityValue(ledBrightCode, statusItems, props, device, 500)
          ) || 500;
        sliderWrap.innerHTML = `
          <label>${t("brightness")} (${ledBrightCode}): <span class="slider-value">${brightnessValue}</span></label>
          <input class="brightness-slider" type="range" min="0" max="1000" step="1" value="${brightnessValue}" />
        `;
        quick.appendChild(sliderWrap);

        onBtn.addEventListener("click", async () => {
          try {
            const commands = [{ code: ledSwitchCode, value: true }];
            await sendCommands(device.id, commands, result);
            applyCommandsToLocalState(commands);
          } catch (e) {
            result.textContent = e.message;
          }
        });

        offBtn.addEventListener("click", async () => {
          try {
            const commands = [{ code: ledSwitchCode, value: false }];
            await sendCommands(device.id, commands, result);
            applyCommandsToLocalState(commands);
          } catch (e) {
            result.textContent = e.message;
          }
        });

        const slider = sliderWrap.querySelector(".brightness-slider");
        const sliderValue = sliderWrap.querySelector(".slider-value");
        slider.addEventListener("input", () => {
          sliderValue.textContent = slider.value;
        });
        slider.addEventListener("change", async () => {
          try {
            const commands = [{ code: ledBrightCode, value: Number(slider.value) }];
            await sendCommands(device.id, commands, result);
            applyCommandsToLocalState(commands);
          } catch (e) {
            result.textContent = e.message;
          }
        });
        return;
      }

      const hasBrightnessCode = codes.some((c) =>
        String(c.code || "").toLowerCase().includes("brightness")
      );
      const hasAnyBrightValue = codes.some((c) => /^bright_value/.test(c.code || ""));
      if (hasSwitch1 && !hasBrightnessCode && !hasAnyBrightValue) {
        const onBtn = document.createElement("button");
        onBtn.textContent = "ON";
        const offBtn = document.createElement("button");
        offBtn.textContent = "OFF";
        quick.appendChild(onBtn);
        quick.appendChild(offBtn);

        onBtn.addEventListener("click", async () => {
          try {
            const commands = [{ code: "switch_1", value: true }];
            await sendCommands(device.id, commands, result);
            applyCommandsToLocalState(commands);
          } catch (e) {
            result.textContent = e.message;
          }
        });

        offBtn.addEventListener("click", async () => {
          try {
            const commands = [{ code: "switch_1", value: false }];
            await sendCommands(device.id, commands, result);
            applyCommandsToLocalState(commands);
          } catch (e) {
            result.textContent = e.message;
          }
        });
        return;
      }

      const hasControlEnum = codes.some((c) => c.code === "control");
      if (hasControlEnum) {
        const openBtn = document.createElement("button");
        openBtn.textContent = t("openDoor");
        const stopBtn = document.createElement("button");
        stopBtn.textContent = t("stopDoor");
        stopBtn.classList.add("btn-stop");
        const closeBtn = document.createElement("button");
        closeBtn.textContent = t("closeDoor");

        quick.appendChild(openBtn);
        quick.appendChild(stopBtn);
        quick.appendChild(closeBtn);

        openBtn.addEventListener("click", async () => {
          try {
            const commands = [{ code: "control", value: "open" }];
            await sendCommands(device.id, commands, result);
            applyCommandsToLocalState(commands);
          } catch (e) {
            result.textContent = e.message;
          }
        });

        stopBtn.addEventListener("click", async () => {
          try {
            const commands = [{ code: "control", value: "stop" }];
            await sendCommands(device.id, commands, result);
            applyCommandsToLocalState(commands);
          } catch (e) {
            result.textContent = e.message;
          }
        });

        closeBtn.addEventListener("click", async () => {
          try {
            const commands = [{ code: "control", value: "close" }];
            await sendCommands(device.id, commands, result);
            applyCommandsToLocalState(commands);
          } catch (e) {
            result.textContent = e.message;
          }
        });
        return;
      }

      const first = codes[0];
      const cmdForm = ensureCommandForm();
      if (first?.code) {
        cmdForm.code.value = first.code;
        cmdForm.value.value = "true";
      }

      const switchCode = codes.find((c) => /^switch/.test(c.code))?.code;
      if (switchCode) {
        const onBtn = document.createElement("button");
        onBtn.textContent = `ON (${switchCode})`;
        const offBtn = document.createElement("button");
        offBtn.textContent = `OFF (${switchCode})`;
        quick.appendChild(onBtn);
        quick.appendChild(offBtn);

        onBtn.addEventListener("click", async () => {
          try {
            const commands = [{ code: switchCode, value: true }];
            await sendCommands(device.id, commands, result);
            applyCommandsToLocalState(commands);
          } catch (e) {
            result.textContent = e.message;
          }
        });

        offBtn.addEventListener("click", async () => {
          try {
            const commands = [{ code: switchCode, value: false }];
            await sendCommands(device.id, commands, result);
            applyCommandsToLocalState(commands);
          } catch (e) {
            result.textContent = e.message;
          }
        });
      }
    })
    .catch((e) => {
      statusSummary.textContent = `${t("statusCurrent")}: ${t("unavailable")} (${e.message})`;
      loading.remove();
    });

  return card;
}

async function loadDevices() {
  clearError();
  try {
    const response = await fetch("/api/devices");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || t("cannotLoadDevices"));
    }
    allDevices = data.devices || [];
    const container = document.getElementById("devices");
    container.innerHTML = "";
    renderedDeviceCards = allDevices.map((device) => {
      const card = createDeviceCard(device);
      container.appendChild(card);
      return { device, card };
    });
    renderFilteredDevices();
  } catch (error) {
    showError(error.message);
  }
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function renderFilteredDevices() {
  const container = document.getElementById("devices");
  const emptyStateId = "devices-empty-state";
  const existingEmptyState = document.getElementById(emptyStateId);

  if (allDevices.length === 0) {
    container.innerHTML = "";
    const emptyState = document.createElement("p");
    emptyState.id = emptyStateId;
    emptyState.textContent = t("noDevicesFound");
    container.appendChild(emptyState);
    return;
  }

  const normalizedQuery = normalizeText(currentSearchQuery.trim());
  let visibleCount = 0;
  renderedDeviceCards.forEach(({ device, card }) => {
    const matches =
      !normalizedQuery || normalizeText(device.name).includes(normalizedQuery);
    card.classList.toggle("hidden", !matches);
    if (matches) visibleCount += 1;
  });

  if (visibleCount === 0) {
    if (!existingEmptyState) {
      const emptyState = document.createElement("p");
      emptyState.id = emptyStateId;
      emptyState.textContent = t("noDevicesMatch");
      container.appendChild(emptyState);
    } else {
      existingEmptyState.textContent = t("noDevicesMatch");
      existingEmptyState.classList.remove("hidden");
    }
    return;
  }

  if (existingEmptyState) {
    existingEmptyState.remove();
  }
}

function toggleLang() {
  const nextLang = currentLang === "fr" ? "en" : "fr";
  const params = new URLSearchParams(window.location.search);
  params.set("lang", nextLang);
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
  currentLang = nextLang;
  updateStaticTexts();
  renderFilteredDevices();
}

document.getElementById("device-search").addEventListener("input", (event) => {
  currentSearchQuery = event.target.value || "";
  renderFilteredDevices();
});
document.getElementById("refresh-btn").addEventListener("click", loadDevices);
document.getElementById("lang-toggle-btn").addEventListener("click", toggleLang);
updateStaticTexts();
document.getElementById("device-search").focus();
loadDevices();

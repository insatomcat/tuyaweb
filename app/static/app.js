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
  if (device.online === true) return "en ligne";
  if (device.online === false) return "hors ligne";
  return "etat inconnu";
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
        return "Porte: Ouverte";
      }
      if (value === false || value === "false" || value === 0 || value === "0") {
        return "Porte: Fermee";
      }
      return `Porte: ${String(value)}`;
    }

    if (code === "battery_percentage") {
      const batteryValue =
        typeof value === "number" ? value : Number.parseFloat(String(value));
      if (Number.isFinite(batteryValue)) {
        return `Batterie: ${Math.round(batteryValue)}%`;
      }
      return `Batterie: ${String(value)}`;
    }

    const printable = typeof value === "object" ? safeJson(value) : String(value);
    return `${code}: ${printable}`;
  }

  focusCodes.forEach((code) => {
    if (!mergedValues.has(code)) return;
    const value = mergedValues.get(code);
    rows.push(formatFocusedValue(code, value));
  });

  if (rows.length === 0) return "Status actuel: indisponible";
  return `Status actuel: ${rows.join(" | ")}`;
}

function createDetailsBlock(card, device, codes, mergedValues) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "details-btn";
  button.textContent = "Show details";

  const details = document.createElement("div");
  details.className = "details-block hidden";

  const idLine = document.createElement("p");
  idLine.className = "meta";
  idLine.textContent = `ID: ${device.id}`;
  details.appendChild(idLine);

  const labelsLine = document.createElement("p");
  labelsLine.className = "meta";
  labelsLine.textContent = `Labels: ${getOnlineTag(device)} | ${
    device.category || "categorie inconnue"
  } | ${device.product_name || "produit inconnu"}`;
  details.appendChild(labelsLine);

  const codesLine = document.createElement("p");
  codesLine.className = "meta";
  codesLine.textContent = `Codes supportes: ${codes.map((c) => c.code).join(", ")}`;
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
    button.textContent = isHidden ? "Hide details" : "Show details";
  });

  card.appendChild(button);
  card.appendChild(details);
}

async function sendCommands(deviceId, commands, outputEl) {
  outputEl.textContent = "Envoi...";
  const response = await fetch(`/api/devices/${deviceId}/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || "Erreur API");
  }
  outputEl.textContent = safeJson(data);
}

async function loadCapabilities(deviceId) {
  const response = await fetch(`/api/devices/${deviceId}/capabilities`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || "Impossible de charger les capacites du device");
  }
  return data;
}

function createDeviceCard(device) {
  const card = document.createElement("article");
  card.className = "device-card";

  const title = document.createElement("h3");
  title.textContent = device.name || "(sans nom)";
  card.appendChild(title);

  const statusSummary = document.createElement("p");
  statusSummary.className = "meta status-summary";
  statusSummary.textContent = "Status actuel: chargement...";
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

  const form = document.createElement("form");
  form.className = "cmd-form";
  form.innerHTML = `
    <label>Code Tuya (ex: switch_1, bright_value_v2)</label>
    <input type="text" name="code" required />
    <label>Valeur JSON (ex: true, 50, "auto")</label>
    <textarea name="value" required>true</textarea>
    <button type="submit">Envoyer commande</button>
    <pre class="result"></pre>
  `;
  card.appendChild(form);

  const result = form.querySelector(".result");
  const loading = document.createElement("p");
  loading.className = "meta";
  loading.textContent = "Chargement...";
  card.appendChild(loading);

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
        loading.textContent = "Aucun code detecte pour ce device.";
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
        form.classList.add("hidden");
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
          <label>Brightness (${ledBrightCode}): <span class="slider-value">${brightnessValue}</span></label>
          <input class="brightness-slider" type="range" min="0" max="1000" step="1" value="${brightnessValue}" />
        `;
        quick.appendChild(sliderWrap);

        form.classList.add("hidden");

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
        form.classList.add("hidden");

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
        openBtn.textContent = "OPEN";
        const stopBtn = document.createElement("button");
        stopBtn.textContent = "STOP";
        stopBtn.classList.add("btn-stop");
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "CLOSE";

        quick.appendChild(openBtn);
        quick.appendChild(stopBtn);
        quick.appendChild(closeBtn);
        form.classList.add("hidden");

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
      if (first?.code) {
        form.code.value = first.code;
        form.value.value = "true";
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
      statusSummary.textContent = `Status actuel: indisponible (${e.message})`;
      loading.remove();
    });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = form.code.value.trim();
    const rawValue = form.value.value.trim();
    if (!code) return;

    let parsedValue;
    try {
      parsedValue = JSON.parse(rawValue);
    } catch (_e) {
      result.textContent = "Valeur JSON invalide";
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

  return card;
}

async function loadDevices() {
  clearError();
  const container = document.getElementById("devices");
  container.innerHTML = "";

  try {
    const response = await fetch("/api/devices");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Impossible de charger les equipements");
    }
    const devices = data.devices || [];
    if (devices.length === 0) {
      container.textContent = "Aucun equipement trouve.";
      return;
    }
    devices.forEach((device) => container.appendChild(createDeviceCard(device)));
  } catch (error) {
    showError(error.message);
  }
}

document.getElementById("refresh-btn").addEventListener("click", loadDevices);
loadDevices();

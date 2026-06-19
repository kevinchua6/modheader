// State
let state = {
  profiles: [],
  activeProfileId: "",
  enabled: true
};

let themeMode = "system"; // "system" | "dark" | "light"

function applyTheme(mode) {
  themeMode = mode;
  const html = document.documentElement;
  if (mode === "system") {
    html.removeAttribute("data-theme");
  } else {
    html.setAttribute("data-theme", mode);
  }
  const label = document.getElementById("theme-toggle-label");
  if (label) {
    label.textContent = mode === "dark" ? "Theme: Dark" : mode === "light" ? "Theme: Light" : "Theme: System";
  }
}

function cycleTheme() {
  const next = { system: "dark", dark: "light", light: "system" };
  const newMode = next[themeMode] || "dark";
  applyTheme(newMode);
  chrome.storage.local.set({ theme: newMode });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function uid(prefix) {
  return prefix + "_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
}

// Debounced save for text inputs
let saveTimeout = null;
function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveState, 250);
}

document.addEventListener("DOMContentLoaded", async () => {
  if (new URLSearchParams(window.location.search).get("fullscreen") === "1") {
    document.body.classList.add("tabview");
  }
  await loadState();
  setupEventListeners();
  renderAll();
  // Reveal now that sections are in their final state. Transitions are still
  // suppressed (body.preload) so nothing animates into place; re-enable them
  // after the first paint for subsequent user interactions.
  document.querySelector(".content").classList.remove("content-hidden");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => document.body.classList.remove("preload"));
  });
});

// ---------- Persistence ----------
function loadState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["profiles", "activeProfileId", "enabled", "theme"], (result) => {
      if (result.profiles && result.profiles.length > 0) {
        state.profiles = result.profiles;
        state.activeProfileId = result.activeProfileId || result.profiles[0].id;
        state.enabled = result.enabled !== false;
      } else {
        const def = createDefaultProfileObject("Profile 1");
        state.profiles = [def];
        state.activeProfileId = def.id;
        state.enabled = true;
        saveState();
      }
      applyTheme(result.theme || "system");
      resolve();
    });
  });
}

function saveState() {
  chrome.storage.local.set(state);
}

function createDefaultProfileObject(name) {
  return {
    id: uid("profile"),
    name: name || "New Profile",
    requestEnabled: true,
    responseEnabled: true,
    filtersEnabled: true,
    headers: [
      { id: uid("h"), type: "request", action: "set", name: "X-Clone-Header", value: "HelloFromClone", enabled: true }
    ],
    filters: []
  };
}

function getActiveProfile() {
  return state.profiles.find(p => p.id === state.activeProfileId);
}

// ---------- Event Listeners ----------
function setupEventListeners() {
  // Pause / play
  document.getElementById("pause-play-btn").addEventListener("click", () => {
    state.enabled = !state.enabled;
    updatePausePlayUI();
    saveState();
  });

  // Profile switcher dropdown
  const switcher = document.getElementById("profile-switcher");
  switcher.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdown("profiles-dropdown", switcher);
  });

  // Add profile
  document.getElementById("add-profile-btn").addEventListener("click", () => {
    const newProfile = createDefaultProfileObject(`Profile ${state.profiles.length + 1}`);
    newProfile.headers = []; // start blank for additional profiles
    state.profiles.push(newProfile);
    state.activeProfileId = newProfile.id;
    closeAllDropdowns();
    saveState();
    renderAll();
  });

  // Main (kebab) menu
  const menuBtn = document.getElementById("menu-btn");
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdown("main-menu", menuBtn);
  });

  document.querySelectorAll("#main-menu .dropdown-item").forEach(item => {
    item.addEventListener("click", () => {
      handleMenuAction(item.getAttribute("data-action"));
    });
  });

  // Inline rename input
  const nameInput = document.getElementById("profile-name-input");
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); nameInput.blur(); }
    if (e.key === "Escape") { e.preventDefault(); finishRename(false); }
  });
  nameInput.addEventListener("blur", () => finishRename(true));

  // Section toggles
  document.getElementById("request-section-enabled").addEventListener("change", (e) => {
    const p = getActiveProfile();
    if (p) { p.requestEnabled = e.target.checked; toggleCard("request-card", e.target.checked); saveState(); }
  });
  document.getElementById("response-section-enabled").addEventListener("change", (e) => {
    const p = getActiveProfile();
    if (p) { p.responseEnabled = e.target.checked; toggleCard("response-card", e.target.checked); saveState(); }
  });
  document.getElementById("filters-section-enabled").addEventListener("change", (e) => {
    const p = getActiveProfile();
    if (p) { p.filtersEnabled = e.target.checked; toggleCard("filters-card", e.target.checked); saveState(); updateFilterHint(); }
  });

  // Add row buttons
  document.getElementById("add-request-header-btn").addEventListener("click", () => addNewHeader("request"));
  document.getElementById("add-response-header-btn").addEventListener("click", () => addNewHeader("response"));
  document.getElementById("add-filter-btn").addEventListener("click", addNewFilter);

  // Import file input
  document.getElementById("import-file-input").addEventListener("change", handleImportFile);

  // Keep clicks inside a menu from bubbling to the document close handler
  document.querySelectorAll(".dropdown-menu").forEach(menu => {
    menu.addEventListener("click", (e) => e.stopPropagation());
  });

  // Close dropdowns on outside click / Escape
  document.addEventListener("click", closeAllDropdowns);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAllDropdowns(); });
}

// ---------- Dropdown helpers ----------
function toggleDropdown(menuId, triggerEl) {
  const menu = document.getElementById(menuId);
  const isOpen = !menu.classList.contains("hidden");
  closeAllDropdowns();
  if (!isOpen) {
    menu.classList.remove("hidden");
    if (triggerEl) triggerEl.classList.add("open");
  }
}

function closeAllDropdowns() {
  document.querySelectorAll(".dropdown-menu").forEach(m => m.classList.add("hidden"));
  document.getElementById("profile-switcher").classList.remove("open");
}

// ---------- Menu actions ----------
function handleMenuAction(action) {
  if (action !== "toggle-theme") closeAllDropdowns();
  const p = getActiveProfile();
  if (!p) return;

  switch (action) {
    case "rename": startRename(); break;
    case "duplicate": duplicateProfile(); break;
    case "delete": deleteProfile(); break;
    case "export": exportProfile(); break;
    case "import": document.getElementById("import-file-input").click(); break;
    case "fullscreen": chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?fullscreen=1") }); break;
    case "help": showHelp(); break;
    case "toggle-theme": cycleTheme(); break;
  }
}

function startRename() {
  const p = getActiveProfile();
  if (!p) return;
  const switcher = document.getElementById("profile-switcher");
  const input = document.getElementById("profile-name-input");
  switcher.classList.add("hidden");
  input.classList.remove("hidden");
  input.value = p.name;
  input.focus();
  input.select();
}

let renaming = false;
function finishRename(commit) {
  const input = document.getElementById("profile-name-input");
  if (input.classList.contains("hidden")) return;
  if (renaming) return;
  renaming = true;

  const p = getActiveProfile();
  if (p && commit) {
    p.name = input.value.trim() || "Unnamed Profile";
    saveState();
  }
  input.classList.add("hidden");
  document.getElementById("profile-switcher").classList.remove("hidden");
  renderProfileHeader();
  renderProfilesDropdown();
  renaming = false;
}

function duplicateProfile() {
  const p = getActiveProfile();
  if (!p) return;
  const copy = JSON.parse(JSON.stringify(p));
  copy.id = uid("profile");
  copy.name = p.name + " copy";
  copy.headers = (copy.headers || []).map(h => ({ ...h, id: uid("h") }));
  copy.filters = (copy.filters || []).map(f => ({ ...f, id: uid("f") }));
  const idx = state.profiles.findIndex(x => x.id === p.id);
  state.profiles.splice(idx + 1, 0, copy);
  state.activeProfileId = copy.id;
  saveState();
  renderAll();
}

function deleteProfile() {
  const p = getActiveProfile();
  if (!p) return;
  if (!confirm(`Delete profile "${p.name}"?`)) return;
  state.profiles = state.profiles.filter(x => x.id !== p.id);
  if (state.profiles.length === 0) {
    state.profiles = [createDefaultProfileObject("Profile 1")];
  }
  state.activeProfileId = state.profiles[0].id;
  saveState();
  renderAll();
}

function exportProfile() {
  const p = getActiveProfile();
  if (!p) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(p, null, 2));
  const a = document.createElement("a");
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `profile_${p.name.toLowerCase().replace(/\s+/g, "_")}.json`);
  a.click();
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (imported.profiles && Array.isArray(imported.profiles)) {
        // Full backup: append profiles
        imported.profiles.forEach(pr => {
          pr.id = pr.id || uid("profile");
          state.profiles.push(pr);
        });
        state.activeProfileId = imported.profiles[imported.profiles.length - 1].id;
      } else if (imported.id || imported.headers) {
        // Single profile
        imported.id = uid("profile");
        state.profiles.push(imported);
        state.activeProfileId = imported.id;
      } else {
        alert("Invalid profile file format.");
        return;
      }
      saveState();
      renderAll();
      alert("Import successful!");
    } catch (err) {
      alert("Failed to parse file: " + err.message);
    } finally {
      e.target.value = "";
    }
  };
  reader.readAsText(file);
}

function showHelp() {
  alert(
    "ModHeader Clone — Help\n\n" +
    "• Request headers: add/remove headers sent with your requests.\n" +
    "• Response headers: add/remove headers on responses.\n" +
    "• Set vs Remove: 'Set' overrides a header value; 'Remove' strips it.\n" +
    "• URL filters: optional regexes (e.g. .*example\\.com.*) to limit where changes apply. With no filters, changes apply everywhere.\n" +
    "• Profiles: switch from the badge in the top-left; manage them from the ⋮ menu.\n" +
    "• Pause: the ⏸ button temporarily disables all modifications."
  );
}

// ---------- Header / filter operations ----------
function addNewHeader(type) {
  const p = getActiveProfile();
  if (!p) return;
  p.headers.push({ id: uid("h"), type, action: "set", name: "", value: "", enabled: true });
  saveState();
  renderHeaderRows(type);
}

async function addNewFilter() {
  const p = getActiveProfile();
  if (!p) return;
  if (!p.filters) p.filters = [];

  let defaultValue = "";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const { hostname } = new URL(tab.url);
      if (hostname) {
        defaultValue = `.*${hostname.replace(/\./g, "\\.")}.*`;
      }
    }
  } catch (_) {}

  p.filters.push({ id: uid("f"), type: "url_regex", value: defaultValue, enabled: true });
  saveState();
  renderFilterRows();
  updateFilterHint();
}

// ---------- Rendering ----------
function updatePausePlayUI() {
  const btn = document.getElementById("pause-play-btn");
  const pauseIcon = document.getElementById("pause-icon");
  const playIcon = document.getElementById("play-icon");
  if (state.enabled) {
    btn.className = "header-action-btn pause";
    btn.title = "Pause modifying headers";
    pauseIcon.classList.remove("hidden");
    playIcon.classList.add("hidden");
  } else {
    btn.className = "header-action-btn play";
    btn.title = "Resume modifying headers";
    pauseIcon.classList.add("hidden");
    playIcon.classList.remove("hidden");
  }
}

function toggleCard(cardId, enabled) {
  document.getElementById(cardId).classList.toggle("disabled", !enabled);
}

function renderProfileHeader() {
  const p = getActiveProfile();
  if (!p) return;
  const idx = state.profiles.findIndex(x => x.id === p.id);
  document.getElementById("active-profile-badge").textContent = (idx + 1).toString();
  document.getElementById("active-profile-name").textContent = p.name;
}

function renderProfilesDropdown() {
  const list = document.getElementById("profiles-dropdown-list");
  list.innerHTML = "";
  state.profiles.forEach((profile, index) => {
    const isActive = profile.id === state.activeProfileId;
    const btn = document.createElement("button");
    btn.className = `profile-entry ${isActive ? "active" : ""}`;
    const initial = profile.name ? profile.name.charAt(0).toUpperCase() : (index + 1).toString();
    btn.innerHTML = `
      <span class="entry-badge">${escapeHtml(initial)}</span>
      <span class="entry-name">${escapeHtml(profile.name)}</span>
      <svg class="entry-check" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    `;
    btn.addEventListener("click", () => {
      state.activeProfileId = profile.id;
      closeAllDropdowns();
      saveState();
      renderAll();
    });
    list.appendChild(btn);
  });
}

function renderHeaderRows(type) {
  const container = document.getElementById(`${type}-rows`);
  container.innerHTML = "";
  const p = getActiveProfile();
  if (!p) return;

  const headers = p.headers.filter(h => h.type === type);
  if (headers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-row";
    empty.textContent = `No ${type} headers yet.`;
    container.appendChild(empty);
    return;
  }

  headers.forEach((header) => {
    const row = document.createElement("div");
    row.className = "header-row";
    row.innerHTML = `
      <input type="checkbox" class="row-check" ${header.enabled ? "checked" : ""} title="Enable this header">
      <select class="row-select">
        <option value="set" ${header.action === "set" ? "selected" : ""}>Set</option>
        <option value="remove" ${header.action === "remove" ? "selected" : ""}>Remove</option>
      </select>
      <input type="text" class="row-input row-name" value="${escapeHtml(header.name)}" placeholder="Header name">
      <input type="text" class="row-input row-value" value="${escapeHtml(header.value)}" placeholder="Value" ${header.action === "remove" ? "disabled" : ""}>
      <button class="delete-btn" title="Delete">
        <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    `;

    row.querySelector(".row-check").addEventListener("change", (e) => {
      header.enabled = e.target.checked;
      saveState();
    });

    const valueInput = row.querySelector(".row-value");
    row.querySelector(".row-select").addEventListener("change", (e) => {
      header.action = e.target.value;
      if (header.action === "remove") {
        valueInput.disabled = true;
        valueInput.value = "";
        header.value = "";
      } else {
        valueInput.disabled = false;
      }
      saveState();
    });

    row.querySelector(".row-name").addEventListener("input", (e) => {
      header.name = e.target.value.trim();
      debouncedSave();
    });
    valueInput.addEventListener("input", (e) => {
      header.value = e.target.value;
      debouncedSave();
    });

    row.querySelector(".delete-btn").addEventListener("click", () => {
      p.headers = p.headers.filter(h => h.id !== header.id);
      saveState();
      renderHeaderRows(type);
    });

    container.appendChild(row);
  });
}

function renderFilterRows() {
  const container = document.getElementById("filter-rows");
  container.innerHTML = "";
  const p = getActiveProfile();
  if (!p) return;
  const filters = p.filters || [];

  if (filters.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-row";
    empty.textContent = "No filters — modifications apply to all URLs.";
    container.appendChild(empty);
    return;
  }

  filters.forEach((filter) => {
    const row = document.createElement("div");
    row.className = "filter-row";
    row.innerHTML = `
      <input type="checkbox" class="row-check" ${filter.enabled ? "checked" : ""} title="Enable this filter">
      <input type="text" class="row-input row-value" value="${escapeHtml(filter.value)}" placeholder="URL regex (e.g. .*example\\.com.*)">
      <button class="delete-btn" title="Delete">
        <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    `;

    row.querySelector(".row-check").addEventListener("change", (e) => {
      filter.enabled = e.target.checked;
      saveState();
      updateFilterHint();
    });
    row.querySelector(".row-value").addEventListener("input", (e) => {
      filter.value = e.target.value.trim();
      debouncedSave();
      updateFilterHint();
    });
    row.querySelector(".delete-btn").addEventListener("click", () => {
      p.filters = p.filters.filter(f => f.id !== filter.id);
      saveState();
      renderFilterRows();
      updateFilterHint();
    });

    container.appendChild(row);
  });
}

function updateFilterHint() {
  const p = getActiveProfile();
  const hint = document.getElementById("filter-hint");
  if (!p) { hint.textContent = ""; return; }
  const active = (p.filters || []).filter(f => f.enabled && f.value);
  const filtersOn = p.filtersEnabled !== false;
  if (!filtersOn || active.length === 0) {
    hint.textContent = "Modifications apply to all requests. Add a filter to limit them to certain URLs.";
  } else {
    hint.textContent = "Modifications apply only to URLs matching: " + active.map(f => `"${f.value}"`).join(" or ") + ".";
  }
}

function renderAll() {
  const p = getActiveProfile();
  if (!p) return;

  renderProfileHeader();
  renderProfilesDropdown();
  updatePausePlayUI();

  const reqOn = p.requestEnabled !== false;
  document.getElementById("request-section-enabled").checked = reqOn;
  toggleCard("request-card", reqOn);

  const resOn = p.responseEnabled !== false;
  document.getElementById("response-section-enabled").checked = resOn;
  toggleCard("response-card", resOn);

  const filtOn = p.filtersEnabled !== false;
  document.getElementById("filters-section-enabled").checked = filtOn;
  toggleCard("filters-card", filtOn);

  renderHeaderRows("request");
  renderHeaderRows("response");
  renderFilterRows();
  updateFilterHint();
}

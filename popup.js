// State Variables
let state = {
  profiles: [],
  activeProfileId: "",
  enabled: true
};

// Debounce helper for text inputs
let saveTimeout = null;
function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveState();
  }, 250);
}

// Initialize Popup
document.addEventListener("DOMContentLoaded", async () => {
  await loadState();
  setupEventListeners();
  renderAll();
});

// Load State from Chrome Storage
async function loadState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["profiles", "activeProfileId", "enabled"], (result) => {
      if (result.profiles && result.profiles.length > 0) {
        state.profiles = result.profiles;
        state.activeProfileId = result.activeProfileId || result.profiles[0].id;
        state.enabled = result.enabled !== false;
      } else {
        // Create a default profile
        const defaultProfile = createDefaultProfileObject("Profile 1");
        state.profiles = [defaultProfile];
        state.activeProfileId = defaultProfile.id;
        state.enabled = true;
        saveState();
      }
      resolve();
    });
  });
}

// Save State to Chrome Storage
function saveState() {
  chrome.storage.local.set(state, () => {
    console.log("State saved & synchronized to declarativeNetRequest rules");
  });
}

function createDefaultProfileObject(name) {
  const profileId = "profile_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  return {
    id: profileId,
    name: name || "New Profile",
    requestEnabled: true,
    responseEnabled: true,
    filtersEnabled: true,
    headers: [
      {
        id: "h_" + Date.now() + "_1",
        type: "request",
        action: "set",
        name: "X-Clone-Header",
        value: "HelloFromClone",
        enabled: true
      }
    ],
    filters: []
  };
}

// Event Listeners Setup
function setupEventListeners() {
  // Global Toggle (Pause/Play)
  const pausePlayBtn = document.getElementById("pause-play-btn");
  pausePlayBtn.addEventListener("click", () => {
    state.enabled = !state.enabled;
    updatePausePlayUI();
    saveState();
  });

  // Profile Naming Input
  const profileNameInput = document.getElementById("profile-name-input");
  profileNameInput.addEventListener("input", (e) => {
    const activeProfile = getActiveProfile();
    if (activeProfile) {
      activeProfile.name = e.target.value.trim() || "Unnamed Profile";
      
      // Update sidebar badge display name
      const sidebarIcon = document.querySelector(`.profile-icon[data-id="${activeProfile.id}"]`);
      if (sidebarIcon) {
        sidebarIcon.title = activeProfile.name;
        // update letter/number
        const initials = activeProfile.name.charAt(0).toUpperCase();
        sidebarIcon.childNodes[0].textContent = initials || "?";
      }
      debouncedSave();
    }
  });

  // Add Profile Button (Sidebar)
  const addProfileBtn = document.getElementById("add-profile-btn");
  addProfileBtn.addEventListener("click", () => {
    const numProfiles = state.profiles.length;
    const newProfile = createDefaultProfileObject(`Profile ${numProfiles + 1}`);
    state.profiles.push(newProfile);
    state.activeProfileId = newProfile.id;
    saveState();
    renderAll();
  });

  // Import/Export Profiles (Sidebar)
  const importExportBtn = document.getElementById("import-export-btn");
  const importFileInput = document.getElementById("import-file-input");
  
  importExportBtn.addEventListener("click", () => {
    // Show a confirm dialog or just trigger import/export.
    // Let's implement dynamic export of all profiles
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href",     dataStr     );
    dlAnchorElem.setAttribute("download", `modheader_clone_profiles_${Date.now()}.json`);
    dlAnchorElem.click();
  });

  // Import button trigger
  const browseProfilesLink = document.getElementById("browse-profiles-link");
  browseProfilesLink.addEventListener("click", (e) => {
    e.preventDefault();
    importFileInput.click();
  });

  importFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported.profiles && Array.isArray(imported.profiles)) {
          state.profiles = imported.profiles;
          state.activeProfileId = imported.activeProfileId || imported.profiles[0].id;
          state.enabled = imported.enabled !== false;
          saveState();
          renderAll();
          alert("Profiles imported successfully!");
        } else {
          alert("Invalid profile backup file format.");
        }
      } catch (err) {
        alert("Failed to parse file: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Header Bar utility actions
  const exportProfileBtn = document.getElementById("export-profile-btn");
  exportProfileBtn.addEventListener("click", () => {
    const activeProfile = getActiveProfile();
    if (!activeProfile) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeProfile));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href",     dataStr     );
    dlAnchorElem.setAttribute("download", `profile_${activeProfile.name.toLowerCase().replace(/\s+/g, '_')}.json`);
    dlAnchorElem.click();
  });

  const fullscreenBtn = document.getElementById("fullscreen-btn");
  fullscreenBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
  });

  // Section level checkmarks
  document.getElementById("request-section-enabled").addEventListener("change", (e) => {
    const activeProfile = getActiveProfile();
    if (activeProfile) {
      activeProfile.requestEnabled = e.target.checked;
      toggleSectionVisibility("request-headers-section", e.target.checked);
      saveState();
    }
  });

  document.getElementById("response-section-enabled").addEventListener("change", (e) => {
    const activeProfile = getActiveProfile();
    if (activeProfile) {
      activeProfile.responseEnabled = e.target.checked;
      toggleSectionVisibility("response-headers-section", e.target.checked);
      saveState();
    }
  });

  document.getElementById("filters-section-enabled").addEventListener("change", (e) => {
    const activeProfile = getActiveProfile();
    if (activeProfile) {
      activeProfile.filtersEnabled = e.target.checked;
      toggleSectionVisibility("filters-section-section", e.target.checked);
      saveState();
      updateStatusMsg();
    }
  });

  // Toggle All Checkboxes
  document.getElementById("toggle-all-request").addEventListener("change", (e) => {
    toggleAllHeaders("request", e.target.checked);
  });

  document.getElementById("toggle-all-response").addEventListener("change", (e) => {
    toggleAllHeaders("response", e.target.checked);
  });

  document.getElementById("toggle-all-filters").addEventListener("change", (e) => {
    toggleAllFilters(e.target.checked);
  });

  // Add Item Buttons (Inline)
  document.getElementById("add-request-header-btn").addEventListener("click", () => {
    addNewHeader("request");
  });

  document.getElementById("add-response-header-btn").addEventListener("click", () => {
    addNewHeader("response");
  });

  document.getElementById("add-filter-btn-inline").addEventListener("click", () => {
    addNewFilter();
  });

  // Add Item Buttons (Bottom panel)
  document.getElementById("bottom-mod-btn").addEventListener("click", () => {
    addNewHeader("request");
  });

  document.getElementById("bottom-filter-btn").addEventListener("click", () => {
    addNewFilter();
  });

  // Login Modal Events
  const loginBtn = document.getElementById("bottom-login-btn");
  const loginModal = document.getElementById("login-modal");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const modalSubmitLogin = document.getElementById("modal-submit-login");

  loginBtn.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
  });

  closeModalBtn.addEventListener("click", () => {
    loginModal.classList.add("hidden");
  });

  modalSubmitLogin.addEventListener("click", () => {
    alert("Logged in successfully! (Mock Cloud Connection)");
    loginModal.classList.add("hidden");
  });

  // Close modal on click outside card
  loginModal.addEventListener("click", (e) => {
    if (e.target === loginModal) {
      loginModal.classList.add("hidden");
    }
  });

  // Help button alert
  document.getElementById("help-btn").addEventListener("click", () => {
    alert("ModHeader Clone Help:\n\n1. Modify request headers by adding lines in the 'Request headers' section.\n2. Modify response headers in the 'Response headers' section.\n3. Enter custom URL regex filters (e.g. .*google\\.com.*) in the 'Filters' section to restrict where modifications apply.\n4. Pause or start the extension using the play/pause button in the header.\n5. Use the sidebar to switch profiles.");
  });

  // Delete profile option via long press or context menu helper
  document.getElementById("more-options-btn").addEventListener("click", () => {
    const activeProfile = getActiveProfile();
    if (!activeProfile) return;
    
    if (confirm(`Do you want to delete profile "${activeProfile.name}"?`)) {
      state.profiles = state.profiles.filter(p => p.id !== activeProfile.id);
      if (state.profiles.length === 0) {
        const defaultProfile = createDefaultProfileObject("Profile 1");
        state.profiles = [defaultProfile];
      }
      state.activeProfileId = state.profiles[0].id;
      saveState();
      renderAll();
    }
  });
}

// Get the currently active profile
function getActiveProfile() {
  return state.profiles.find(p => p.id === state.activeProfileId);
}

// UI State rendering
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
    btn.title = "Play / Enable modifying headers";
    pauseIcon.classList.add("hidden");
    playIcon.classList.remove("hidden");
  }
}

function toggleSectionVisibility(sectionId, enabled) {
  const sec = document.getElementById(sectionId);
  if (enabled) {
    sec.classList.remove("disabled");
  } else {
    sec.classList.add("disabled");
  }
}

// Renders the profiles in the left sidebar
function renderSidebarProfiles() {
  const container = document.getElementById("profiles-sidebar-list");
  container.innerHTML = "";

  state.profiles.forEach((profile, index) => {
    const isAct = profile.id === state.activeProfileId;
    
    const profBtn = document.createElement("button");
    profBtn.className = `profile-icon ${isAct ? 'active' : ''}`;
    profBtn.setAttribute("data-id", profile.id);
    profBtn.title = profile.name;

    // Use first letter of name, or index if not available
    const initials = profile.name ? profile.name.charAt(0).toUpperCase() : (index + 1).toString();
    
    profBtn.innerHTML = `<span>${initials}</span>`;
    
    // Add checkmark dot for active
    if (isAct) {
      const activeDot = document.createElement("div");
      activeDot.className = "active-dot";
      profBtn.appendChild(activeDot);
    }

    profBtn.addEventListener("click", () => {
      state.activeProfileId = profile.id;
      saveState();
      renderAll();
    });

    container.appendChild(profBtn);
  });
}

// Headers Operations
function toggleAllHeaders(type, isChecked) {
  const activeProfile = getActiveProfile();
  if (!activeProfile) return;

  activeProfile.headers.forEach(h => {
    if (h.type === type) {
      h.enabled = isChecked;
    }
  });

  saveState();
  
  // Update checkbox state in table rows directly without full re-render
  const checkboxes = document.querySelectorAll(`.header-row-checkbox[data-type="${type}"]`);
  checkboxes.forEach(cb => cb.checked = isChecked);
}

function toggleAllFilters(isChecked) {
  const activeProfile = getActiveProfile();
  if (!activeProfile) return;

  activeProfile.filters.forEach(f => {
    f.enabled = isChecked;
  });

  saveState();
  
  const checkboxes = document.querySelectorAll(".filter-row-checkbox");
  checkboxes.forEach(cb => cb.checked = isChecked);
  updateStatusMsg();
}

function addNewHeader(type) {
  const activeProfile = getActiveProfile();
  if (!activeProfile) return;

  const newHeader = {
    id: "h_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    type: type,
    action: "set",
    name: "",
    value: "",
    enabled: true
  };

  activeProfile.headers.push(newHeader);
  saveState();
  renderHeadersTable(type);
}

function addNewFilter() {
  const activeProfile = getActiveProfile();
  if (!activeProfile) return;

  const newFilter = {
    id: "f_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    type: "url_regex",
    value: "",
    enabled: true
  };

  activeProfile.filters.push(newFilter);
  saveState();
  renderFiltersTable();
  updateStatusMsg();
}

// Renders the request or response headers tables
function renderHeadersTable(type) {
  const tbody = document.getElementById(`${type}-headers-tbody`);
  tbody.innerHTML = "";

  const activeProfile = getActiveProfile();
  if (!activeProfile) return;

  const headers = activeProfile.headers.filter(h => h.type === type);
  
  if (headers.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="5" style="text-align: center; color: var(--text-dim); padding: 12px;">No ${type} headers added yet. Click "+ Add ${type} header" to begin.</td>`;
    tbody.appendChild(emptyRow);
    return;
  }

  // Update check all checkbox status
  const allEnabled = headers.every(h => h.enabled);
  document.getElementById(`toggle-all-${type}`).checked = allEnabled;

  headers.forEach((header) => {
    const tr = document.createElement("tr");
    tr.className = "table-row-container";
    tr.setAttribute("data-id", header.id);

    tr.innerHTML = `
      <td class="col-toggle">
        <label class="checkbox-container">
          <input type="checkbox" class="header-row-checkbox" data-type="${type}" data-id="${header.id}" ${header.enabled ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
      </td>
      <td class="col-action">
        <select class="row-select header-row-action" data-id="${header.id}">
          <option value="set" ${header.action === "set" ? 'selected' : ''}>Set</option>
          <option value="remove" ${header.action === "remove" ? 'selected' : ''}>Remove</option>
        </select>
      </td>
      <td class="col-name">
        <input type="text" class="row-input header-row-name" data-id="${header.id}" value="${header.name || ''}" placeholder="${type === 'request' ? 'Request Header Name' : 'Response Header Name'}">
      </td>
      <td class="col-value">
        <input type="text" class="row-input header-row-value" data-id="${header.id}" value="${header.value || ''}" placeholder="Value" ${header.action === 'remove' ? 'disabled' : ''}>
      </td>
      <td class="col-delete">
        <button class="delete-btn header-row-delete" data-id="${header.id}" title="Delete Header">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </td>
    `;

    // Row Event Listeners
    // Checkbox toggle
    const checkbox = tr.querySelector(".header-row-checkbox");
    checkbox.addEventListener("change", (e) => {
      header.enabled = e.target.checked;
      saveState();
      
      // Update check all checkbox
      const sectionHeaders = activeProfile.headers.filter(h => h.type === type);
      document.getElementById(`toggle-all-${type}`).checked = sectionHeaders.every(h => h.enabled);
    });

    // Action dropdown change
    const actionSelect = tr.querySelector(".header-row-action");
    actionSelect.addEventListener("change", (e) => {
      header.action = e.target.value;
      const valInput = tr.querySelector(".header-row-value");
      if (header.action === "remove") {
        valInput.disabled = true;
        valInput.value = "";
        header.value = "";
      } else {
        valInput.disabled = false;
      }
      saveState();
    });

    // Name input change
    const nameInput = tr.querySelector(".header-row-name");
    nameInput.addEventListener("input", (e) => {
      header.name = e.target.value.trim();
      debouncedSave();
    });

    // Value input change
    const valueInput = tr.querySelector(".header-row-value");
    valueInput.addEventListener("input", (e) => {
      header.value = e.target.value;
      debouncedSave();
    });

    // Delete Button Click
    const deleteBtn = tr.querySelector(".header-row-delete");
    deleteBtn.addEventListener("click", () => {
      activeProfile.headers = activeProfile.headers.filter(h => h.id !== header.id);
      saveState();
      renderHeadersTable(type);
    });

    tbody.appendChild(tr);
  });
}

// Renders the URL regex filters table
function renderFiltersTable() {
  const tbody = document.getElementById("filters-tbody");
  tbody.innerHTML = "";

  const activeProfile = getActiveProfile();
  if (!activeProfile) return;

  const filters = activeProfile.filters || [];

  if (filters.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="3" style="text-align: center; color: var(--text-dim); padding: 12px;">No URL regex filters added. Modifications apply to all requests.</td>`;
    tbody.appendChild(emptyRow);
    return;
  }

  // Update check all checkbox status
  const allEnabled = filters.every(f => f.enabled);
  document.getElementById("toggle-all-filters").checked = allEnabled;

  filters.forEach((filter) => {
    const tr = document.createElement("tr");
    tr.className = "table-row-container";
    tr.setAttribute("data-id", filter.id);

    tr.innerHTML = `
      <td class="col-toggle">
        <label class="checkbox-container">
          <input type="checkbox" class="filter-row-checkbox" data-id="${filter.id}" ${filter.enabled ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
      </td>
      <td class="col-name" style="width: 90%;">
        <input type="text" class="row-input filter-row-value" data-id="${filter.id}" value="${filter.value || ''}" placeholder="URL Regex (e.g. .*google\\.com.*)">
      </td>
      <td class="col-delete">
        <button class="delete-btn filter-row-delete" data-id="${filter.id}" title="Delete Filter">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </td>
    `;

    // Row Event Listeners
    // Checkbox toggle
    const checkbox = tr.querySelector(".filter-row-checkbox");
    checkbox.addEventListener("change", (e) => {
      filter.enabled = e.target.checked;
      saveState();
      updateStatusMsg();

      // Update check all checkbox
      document.getElementById("toggle-all-filters").checked = activeProfile.filters.every(f => f.enabled);
    });

    // Value input change
    const valueInput = tr.querySelector(".filter-row-value");
    valueInput.addEventListener("input", (e) => {
      filter.value = e.target.value.trim();
      debouncedSave();
      updateStatusMsg();
    });

    // Delete Button Click
    const deleteBtn = tr.querySelector(".filter-row-delete");
    deleteBtn.addEventListener("click", () => {
      activeProfile.filters = activeProfile.filters.filter(f => f.id !== filter.id);
      saveState();
      renderFiltersTable();
      updateStatusMsg();
    });

    tbody.appendChild(tr);
  });
}

// Update Global Status Message
function updateStatusMsg() {
  const activeProfile = getActiveProfile();
  const statusText = document.getElementById("global-status-text");
  
  if (!activeProfile) {
    statusText.textContent = "No profile active. Create or select a profile to begin.";
    return;
  }

  const activeFilters = (activeProfile.filters || []).filter(f => f.enabled && f.value);
  const filtersEnabled = activeProfile.filtersEnabled !== false;

  if (!filtersEnabled || activeFilters.length === 0) {
    statusText.textContent = "Your modifications are being applied to all requests. Add a filter to limit the modification to certain URLs or tabs.";
  } else {
    const listStr = activeFilters.map(f => `"${f.value}"`).join(" or ");
    statusText.textContent = `Your modifications are applied to URLs matching regex: ${listStr}.`;
  }
}

// Render All Elements
function renderAll() {
  const activeProfile = getActiveProfile();
  if (!activeProfile) return;

  // Header Title
  document.getElementById("profile-name-input").value = activeProfile.name;
  
  // Set profile badge index
  const activeIndex = state.profiles.findIndex(p => p.id === activeProfile.id);
  document.getElementById("active-profile-badge").textContent = (activeIndex + 1).toString();

  // Global Toggle Buttons
  updatePausePlayUI();

  // Section Checkbox Toggles
  const reqSecChecked = activeProfile.requestEnabled !== false;
  document.getElementById("request-section-enabled").checked = reqSecChecked;
  toggleSectionVisibility("request-headers-section", reqSecChecked);

  const resSecChecked = activeProfile.responseEnabled !== false;
  document.getElementById("response-section-enabled").checked = resSecChecked;
  toggleSectionVisibility("response-headers-section", resSecChecked);

  const filtSecChecked = activeProfile.filtersEnabled !== false;
  document.getElementById("filters-section-enabled").checked = filtSecChecked;
  toggleSectionVisibility("filters-section", filtSecChecked);

  // Render lists
  renderSidebarProfiles();
  renderHeadersTable("request");
  renderHeadersTable("response");
  renderFiltersTable();
  updateStatusMsg();
}

const ALL_RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "webtransport",
  "webbundle",
  "other"
];

// Rebuild declarativeNetRequest dynamic rules based on current storage state
async function rebuildRules() {
  try {
    const data = await chrome.storage.local.get(["profiles", "activeProfileId", "enabled"]);
    
    // Default values
    const enabled = data.enabled !== false; // defaults to true
    const profiles = data.profiles || [];
    const activeProfileId = data.activeProfileId;
    
    const activeProfile = profiles.find(p => p.id === activeProfileId);
    
    // Get all existing dynamic rules to remove them
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = existingRules.map(r => r.id);
    
    const addRules = [];
    
    if (enabled && activeProfile) {
      const requestEnabled = activeProfile.requestEnabled !== false;
      const responseEnabled = activeProfile.responseEnabled !== false;
      const filtersEnabled = activeProfile.filtersEnabled !== false;
      
      // Filter enabled headers
      const activeHeaders = (activeProfile.headers || []).filter(h => h.enabled && h.name);
      
      // Build request and response header lists for DNR
      const requestHeaders = [];
      const responseHeaders = [];
      
      activeHeaders.forEach(h => {
        const ruleHeader = {
          header: h.name,
          operation: h.action === "remove" ? "remove" : "set"
        };
        if (h.action !== "remove") {
          ruleHeader.value = h.value || "";
        }
        
        if (h.type === "request" && requestEnabled) {
          requestHeaders.push(ruleHeader);
        } else if (h.type === "response" && responseEnabled) {
          responseHeaders.push(ruleHeader);
        }
      });
      
      if (requestHeaders.length > 0 || responseHeaders.length > 0) {
        // Filter enabled filters
        const activeFilters = filtersEnabled ? (activeProfile.filters || []).filter(f => f.enabled && f.value) : [];
        
        let ruleId = 1;
        
        if (activeFilters.length === 0) {
          // No active filters, apply modifications to all URLs
          const action = { type: "modifyHeaders" };
          if (requestHeaders.length > 0) action.requestHeaders = requestHeaders;
          if (responseHeaders.length > 0) action.responseHeaders = responseHeaders;
          
          addRules.push({
            id: ruleId++,
            priority: 1,
            action: action,
            condition: {
              urlFilter: "*",
              resourceTypes: ALL_RESOURCE_TYPES
            }
          });
        } else {
          // Create a rule for each active filter (any match will trigger modification)
          for (const filter of activeFilters) {
            const action = { type: "modifyHeaders" };
            if (requestHeaders.length > 0) action.requestHeaders = requestHeaders;
            if (responseHeaders.length > 0) action.responseHeaders = responseHeaders;
            
            // Validate regex
            let isRegexValid = true;
            try {
              new RegExp(filter.value);
            } catch (e) {
              console.error(`Invalid regex: ${filter.value}`, e);
              isRegexValid = false;
            }
            
            if (isRegexValid) {
              addRules.push({
                id: ruleId++,
                priority: 1,
                action: action,
                condition: {
                  regexFilter: filter.value,
                  resourceTypes: ALL_RESOURCE_TYPES
                }
              });
            }
          }
        }
      }
    }
    
    // Update the dynamic rules by removing existing ones first, then adding new ones to avoid Chromium ID conflict bugs
    if (existingRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRuleIds
      });
    }
    if (addRules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: addRules
      });
    }
    
    console.log(`Successfully updated rules. Removed: ${existingRuleIds.length}, Added: ${addRules.length}`);
    
    // Update extension badge / icon if necessary to indicate state
    updateExtensionUIState(enabled, activeProfile);
  } catch (error) {
    console.error("Error updating declarativeNetRequest rules:", error);
  }
}

function updateExtensionUIState(enabled, activeProfile) {
  if (!enabled) {
    chrome.action.setBadgeText({ text: "II" });
    chrome.action.setBadgeBackgroundColor({ color: "#4C566A" });
    chrome.action.setTitle({ title: "ModHeader Clone (Paused)" });
  } else if (!activeProfile) {
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#BF616A" });
    chrome.action.setTitle({ title: "ModHeader Clone (No Active Profile)" });
  } else {
    // Show active headers count on the badge
    const requestEnabled = activeProfile.requestEnabled !== false;
    const responseEnabled = activeProfile.responseEnabled !== false;
    const activeHeadersCount = (activeProfile.headers || []).filter(h => {
      if (!h.enabled || !h.name) return false;
      if (h.type === "request" && !requestEnabled) return false;
      if (h.type === "response" && !responseEnabled) return false;
      return true;
    }).length;
    chrome.action.setBadgeText({ text: activeHeadersCount.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#A3BE8C" });
    chrome.action.setTitle({ title: `ModHeader Clone (Active: ${activeProfile.name})` });
  }
}

// Listen for storage changes to rebuild rules automatically
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local") {
    if (changes.profiles || changes.activeProfileId || changes.enabled) {
      rebuildRules();
    }
  }
});

// Rebuild rules when extension starts or installs
chrome.runtime.onInstalled.addListener(() => {
  // Initialize default configuration if storage is empty
  chrome.storage.local.get(["profiles", "activeProfileId", "enabled"], (result) => {
    let updateNeeded = false;
    const updates = {};
    
    if (!result.profiles) {
      const defaultProfile = {
        id: "profile_" + Date.now(),
        name: "Profile 1",
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
      updates.profiles = [defaultProfile];
      updates.activeProfileId = defaultProfile.id;
      updates.enabled = true;
      updateNeeded = true;
    }
    
    if (updateNeeded) {
      chrome.storage.local.set(updates, () => {
        rebuildRules();
      });
    } else {
      rebuildRules();
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  rebuildRules();
});

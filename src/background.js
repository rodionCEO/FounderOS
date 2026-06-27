/**
 * Minimal service worker. Its only job is to support the side-panel "dock"
 * mode. The toolbar icon keeps opening the popup (action.default_popup); the
 * side panel is opened on demand from the popup's dock button via
 * chrome.sidePanel.open(). We make sure the side panel is available but do NOT
 * hijack the action click, so the popup stays the default experience.
 */
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    // Keep the popup as the default action; the side panel is opt-in.
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
});

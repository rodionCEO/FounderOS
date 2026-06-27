/**
 * Popup sizing. Chrome caps extension popups at roughly 800x600, but within
 * that range the popup resizes live to match the body, so changing these CSS
 * vars takes effect immediately. Ignored in the full-tab and side-panel views,
 * which fill their own container instead.
 */
export const POPUP_SIZES = {
  sm: { w: 340, h: 480 },
  md: { w: 400, h: 600 },
  lg: { w: 500, h: 600 },
  xl: { w: 780, h: 600 },
};

/** Apply a popup size preset by updating the CSS size vars. */
export function applyPopupSize(size) {
  const preset = POPUP_SIZES[size] || POPUP_SIZES.md;
  const root = document.documentElement.style;
  root.setProperty('--popup-w', preset.w + 'px');
  root.setProperty('--popup-h', preset.h + 'px');
}

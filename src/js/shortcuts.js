/**
 * Global keyboard shortcuts for power users.
 * Only fire when focus is not in a text field and no modal is open
 * (Esc is handled by the modal layer itself).
 */
import { openQuickCapture } from './quickCapture.js';
import { modalOpen } from './ui.js';

function isTyping(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function initShortcuts({ navigate }) {
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTyping(document.activeElement) || modalOpen()) return;

    switch (e.key.toLowerCase()) {
      case 't':
        e.preventDefault();
        openQuickCapture({ navigate, type: 'task' });
        break;
      case 'i':
        e.preventDefault();
        openQuickCapture({ navigate, type: 'idea' });
        break;
      case 'n':
        e.preventDefault();
        openQuickCapture({ navigate, type: 'note' });
        break;
      case 'l':
        e.preventDefault();
        openQuickCapture({ navigate, type: 'link' });
        break;
      case '/':
        e.preventDefault();
        document.getElementById('globalSearch')?.focus();
        break;
      default:
        break;
    }
  });
}

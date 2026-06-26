/**
 * Web Speech API voice input (free, browser-native).
 * If the API is unavailable, the mic button is simply not rendered.
 *
 * Note: in an extension popup the microphone permission must be granted once for
 * the extension origin. Use requestMicPermission() (e.g. from Settings, in the
 * full-tab view) to trigger that prompt; afterwards dictation works in the popup.
 */
import { icon } from './icons.js';
import { getLang, t } from './i18n.js';
import { toast } from './ui.js';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/** Whether voice dictation is supported in this browser. */
export function voiceSupported() {
  return Boolean(SpeechRecognition);
}

/**
 * Ask the browser for microphone access once (granted per extension origin).
 * Works reliably in the full-tab view (popup.html?view=full).
 * @returns {Promise<boolean>} true if access was granted.
 */
export async function requestMicPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

/**
 * Attach a mic button to a wrapper that contains a single input/textarea.
 * The wrapper element must have class .input-with-mic.
 * @param {HTMLElement} wrapper
 */
export function attachMic(wrapper) {
  if (!voiceSupported()) return;
  const field = wrapper.querySelector('input, textarea');
  if (!field) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mic-btn';
  btn.title = t('voice.title');
  btn.innerHTML = icon('mic');
  wrapper.appendChild(btn);

  let recognition = null;
  let active = false;
  let baseline = ''; // field value when the session started
  let finalText = ''; // accumulated finalized transcript this session

  const stop = () => {
    active = false;
    btn.classList.remove('recording');
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
      recognition = null;
    }
  };

  const setValue = (extra) => {
    const sep = baseline && extra && !/\s$/.test(baseline) ? ' ' : '';
    field.value = baseline + sep + extra;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  };

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (active) {
      stop();
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = getLang() === 'ru' ? 'ru-RU' : 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    active = true;
    baseline = field.value;
    finalText = '';
    btn.classList.add('recording');

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = res[0].transcript;
        if (res.isFinal) finalText += (finalText ? ' ' : '') + transcript.trim();
        else interim += transcript;
      }
      const combined = (finalText + ' ' + interim).trim();
      setValue(combined);
    };

    recognition.onerror = (event) => {
      if (event && (event.error === 'not-allowed' || event.error === 'service-not-allowed')) {
        toast(t('voice.needPermission'));
      }
      stop();
    };
    recognition.onend = stop;
    recognition.start();
  });
}

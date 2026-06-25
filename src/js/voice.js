/**
 * Web Speech API voice input (free, browser-native).
 * If the API is unavailable, the mic button is simply not rendered.
 */
import { icon } from './icons.js';
import { getLang } from './i18n.js';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/** Whether voice dictation is supported in this browser. */
export function voiceSupported() {
  return Boolean(SpeechRecognition);
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
  btn.innerHTML = icon('mic');
  wrapper.appendChild(btn);

  let recognition = null;
  let active = false;

  const stop = () => {
    active = false;
    btn.classList.remove('recording');
    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.stop();
      recognition = null;
    }
  };

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (active) {
      stop();
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = getLang() === 'ru' ? 'ru-RU' : 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    active = true;
    btn.classList.add('recording');

    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim();
      if (text) {
        const sep = field.value && !/\s$/.test(field.value) ? ' ' : '';
        field.value = field.value + sep + text;
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    recognition.onerror = stop;
    recognition.onend = stop;
    recognition.start();
  });
}

const votes = {13: 0, 22: 0};
const inputs = new WeakMap();
let soundEnabled = true;
let sequenceRunning = false;
let audioContext;
const toast = document.querySelector('#toast');
let toastTimer;

function tone(frequency, duration = .075, type = 'sine', volume = .045) {
  if (!soundEnabled) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (_) { /* Sound is an optional enhancement. */ }
}

function updateScreen(booth) {
  const code = booth.dataset.candidate;
  const value = inputs.get(booth) || '';
  const display = booth.querySelector('[data-display]');
  const help = booth.querySelector('[data-message]');
  const candidate = booth.querySelector('[data-screen-candidate]');
  display.textContent = value.padEnd(2, '_').split('').join(' ');
  candidate.classList.toggle('show', value === code);
  help.textContent = value === code ? 'Confira e confirme seu voto' : value ? 'Número inválido. Corrija e tente novamente' : 'Digite o número do candidato';
  booth.classList.toggle('invalid', Boolean(value) && value !== code);
}

function animateHand(booth, keyButton) {
  if (!keyButton) return;
  const panel = booth.querySelector('.key-panel').getBoundingClientRect();
  const key = keyButton.getBoundingClientRect();
  const hand = booth.querySelector('.hand-cursor');
  hand.style.left = `${key.left - panel.left + key.width / 2 - 8}px`;
  hand.style.top = `${key.top - panel.top + key.height / 2 - 7}px`;
  hand.classList.remove('tap');
  void hand.offsetWidth;
  hand.classList.add('tap');
  setTimeout(() => hand.classList.remove('tap'), 300);
}

function pressDigit(booth, digit, keyButton) {
  let value = inputs.get(booth) || '';
  if (value.length >= 2) value = '';
  value += digit;
  inputs.set(booth, value);
  animateHand(booth, keyButton);
  keyButton?.classList.add('pressed');
  setTimeout(() => keyButton?.classList.remove('pressed'), 130);
  tone(740, .055, 'sine', .035);
  updateScreen(booth);
}

function confirm(booth) {
  animateHand(booth, booth.querySelector('[data-action="confirm"]'));
  if ((inputs.get(booth) || '') !== booth.dataset.candidate) {
    booth.classList.remove('shake');
    void booth.offsetWidth;
    booth.classList.add('shake');
    tone(210, .13, 'triangle', .04);
    booth.querySelector('[data-message]').textContent = 'Digite o número indicado para votar';
    return;
  }
  votes[booth.dataset.candidate] += 1;
  updateTotals();
  tone(880, .11, 'sine', .06);
  setTimeout(() => tone(1175, .22, 'sine', .055), 130);
  inputs.set(booth, '');
  updateScreen(booth);
  booth.querySelector('[data-message]').textContent = 'Voto registrado nesta simulação';
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function updateTotals() {
  const total = votes[13] + votes[22];
  document.querySelector('#total13').textContent = String(votes[13]).padStart(3, '0');
  document.querySelector('#total22').textContent = String(votes[22]).padStart(3, '0');
  document.querySelector('#grandTotal').textContent = total;
  document.querySelector('#bar13').style.width = total ? `${votes[13] / total * 100}%` : '50%';
  document.querySelector('#bar22').style.width = total ? `${votes[22] / total * 100}%` : '50%';
  document.querySelectorAll('.booth').forEach(booth => {
    const amount = votes[booth.dataset.candidate];
    booth.querySelector('[data-vote-count]').textContent = `${amount} ${amount === 1 ? 'voto' : 'votos'}`;
  });
}

document.querySelectorAll('.booth').forEach(booth => {
  inputs.set(booth, '');
  const keypad = booth.querySelector('[data-keypad]');
  for (const digit of ['1','2','3','4','5','6','7','8','9','0']) {
    const button = document.createElement('button');
    button.className = 'key';
    button.type = 'button';
    button.dataset.digit = digit;
    button.textContent = digit;
    button.setAttribute('aria-label', `Digitar ${digit} na urna ${booth.dataset.candidate}`);
    button.addEventListener('click', () => pressDigit(booth, digit, button));
    keypad.append(button);
  }
  booth.querySelector('[data-action="clear"]').addEventListener('click', () => {
    inputs.set(booth, '');
    updateScreen(booth);
    tone(420, .06);
  });
  booth.querySelector('[data-action="blank"]').addEventListener('click', () => {
    inputs.set(booth, '');
    updateScreen(booth);
    booth.querySelector('[data-message]').textContent = 'Voto em branco indisponível nesta demonstração';
    tone(320, .09, 'triangle', .035);
  });
  booth.querySelector('[data-action="confirm"]').addEventListener('click', () => confirm(booth));
  updateScreen(booth);
});

document.querySelector('#soundToggle').addEventListener('click', event => {
  soundEnabled = !soundEnabled;
  const button = event.currentTarget;
  button.classList.toggle('muted', !soundEnabled);
  button.setAttribute('aria-pressed', String(soundEnabled));
  button.querySelector('.sound-label').textContent = soundEnabled ? 'Som ligado' : 'Som desligado';
  if (soundEnabled) tone(740, .08);
});

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function runVoteSequence(code) {
  if (sequenceRunning) return;
  const booth = document.querySelector(`.booth[data-candidate="${code}"]`);
  if (!booth) return;
  sequenceRunning = true;
  inputs.set(booth, '');
  updateScreen(booth);
  await delay(220);
  for (const digit of code) {
    pressDigit(booth, digit, booth.querySelector(`[data-digit="${digit}"]`));
    await delay(620);
  }
  await delay(950);
  confirm(booth);
  await delay(650);
  sequenceRunning = false;
}

document.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target;
  if (target instanceof HTMLElement && target.isContentEditable) return;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
  const key = event.key.toLowerCase();
  if (key === 'l') {
    event.preventDefault();
    runVoteSequence('13');
  } else if (key === 'f') {
    event.preventDefault();
    runVoteSequence('22');
  }
});

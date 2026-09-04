const modes = document.querySelectorAll('.mode-option');
const toast = document.querySelector('#toast');
let toastTimer;

function setMode(mode) {
  document.body.dataset.mode = mode === 'normal' ? '' : mode;
  modes.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
    const check = button.querySelector('.option-check');
    if (active && !check) button.insertAdjacentHTML('beforeend', '<span class="option-check">✓</span>');
    if (!active && check) check.remove();
  });
  toast.textContent = mode === 'normal' ? '已恢复标准模式' : '色彩友好模式已开启';
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

modes.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
document.querySelector('#heroToggle').addEventListener('click', () => {
  setMode(document.body.dataset.mode ? 'normal' : 'deuteranopia');
  document.querySelector('#preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelector('#openPanel').addEventListener('click', () => document.querySelector('#preview').scrollIntoView({ behavior: 'smooth' }));

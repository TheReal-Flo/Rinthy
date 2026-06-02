export const showToast = (message: string, tone: 'success' | 'error' | 'neutral' = 'success') => {
  const toast = document.createElement('div');
  toast.innerText = message;
  toast.className = 'app-toast';
  toast.dataset.tone = tone;
  document.body.appendChild(toast);
  window.setTimeout(() => {
    toast.dataset.leaving = 'true';
    window.setTimeout(() => toast.remove(), 180);
  }, 2200);
};

(() => {
  const y = new Date().getFullYear();
  const el = document.querySelector('[data-year]');
  if (el) el.textContent = String(y);
})();



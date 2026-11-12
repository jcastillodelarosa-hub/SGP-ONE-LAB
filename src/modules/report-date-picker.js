// Keep native date validation and manual keyboard entry; the button opens the
// browser picker from an explicit user gesture when showPicker is supported.
export function initReportDatePickers(root) {
  if (!root) return;
  for (const input of root.querySelectorAll('input[type="date"]')) {
    if (input.parentElement?.classList.contains('report-date-control')) continue;
    const label = input.closest('label')?.firstChild?.textContent?.trim() || 'Fecha';
    input.closest('label')?.classList.add('report-date-label');
    const wrapper = document.createElement('span');
    wrapper.className = 'report-date-control';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.append(input);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'report-date-open';
    button.setAttribute('aria-label', `Abrir calendario: ${label}`);
    button.title = `Abrir calendario: ${label}`;
    button.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>';
    button.addEventListener('click', event => {
      event.preventDefault();
      if (input.disabled || input.readOnly) return;
      input.focus();
      try { input.showPicker?.(); } catch { /* Manual date entry remains available. */ }
    });
    wrapper.append(button);
  }
}

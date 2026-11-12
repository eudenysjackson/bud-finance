export function setupSelects(root) {
  if (!HTMLElement.prototype.showPopover) return () => {};
  const controls = new Map();
  let sequence = 0;
  let active;

  function enhance(select) {
    if (controls.has(select) || select.multiple || select.size > 1) return;
    const label = select.labels[0];
    const name = select.getAttribute('aria-label') || (label && [...label.childNodes]
      .filter(node => node !== select).map(node => node.textContent).join(' ').trim()) || select.name;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'desk-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const list = document.createElement('div');
    list.id = 'desk-options-' + ++sequence;
    list.className = 'desk-select-options';
    list.setAttribute('popover', 'auto');
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', name);
    trigger.setAttribute('aria-controls', list.id);
    select.after(trigger, list);
    select.hidden = true;

    function sync() {
      const selected = select.selectedOptions[0]?.label || 'Selecione';
      trigger.textContent = selected;
      trigger.setAttribute('aria-label', name + ': ' + selected);
      trigger.disabled = select.matches(':disabled');
      if (select.validity.valid) trigger.removeAttribute('aria-invalid');
    }

    function close(returnFocus = false) {
      if (!list.matches(':popover-open')) return;
      list.hidePopover();
      if (returnFocus) trigger.focus();
    }

    function open(last = false) {
      active?.close();
      list.replaceChildren();
      for (const option of select.options) {
        if (option.hidden) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.tabIndex = -1;
        button.disabled = option.disabled || Boolean(option.closest('optgroup')?.disabled);
        button.textContent = option.label;
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(option.selected));
        button.addEventListener('click', () => {
          const changed = select.selectedIndex !== option.index;
          select.selectedIndex = option.index;
          sync();
          close(true);
          if (changed) {
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
        list.append(button);
      }
      const box = trigger.getBoundingClientRect();
      const viewport = document.documentElement.clientHeight;
      const below = viewport - box.bottom - 12;
      const above = box.top - 12;
      const opensUp = below < 180 && above > below;
      list.style.left = box.left + 'px';
      list.style.width = box.width + 'px';
      list.style.maxHeight = Math.min(260, opensUp ? above : below) + 'px';
      list.style.top = opensUp ? 'auto' : box.bottom + 6 + 'px';
      list.style.bottom = opensUp ? viewport - box.top + 6 + 'px' : 'auto';
      list.showPopover();
      trigger.setAttribute('aria-expanded', 'true');
      active = { list, close };
      const options = [...list.querySelectorAll('button:not(:disabled)')];
      (options.find(button => button.getAttribute('aria-selected') === 'true') || (last ? options.at(-1) : options[0]))?.focus();
    }

    trigger.addEventListener('click', () => list.matches(':popover-open') ? close(true) : open());
    trigger.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault();
      open(event.key === 'ArrowUp');
    });
    list.addEventListener('keydown', event => {
      const options = [...list.querySelectorAll('button:not(:disabled)')];
      const index = options.indexOf(document.activeElement);
      if (event.key === 'Tab') { close(true); return; }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      }
      const target = {
        ArrowDown: options[Math.min(index + 1, options.length - 1)],
        ArrowUp: options[Math.max(index - 1, 0)],
        Home: options[0], End: options.at(-1)
      }[event.key];
      if (target) {
        event.preventDefault();
        target.focus();
      }
    });
    list.addEventListener('toggle', () => {
      const expanded = list.matches(':popover-open');
      trigger.setAttribute('aria-expanded', String(expanded));
      if (!expanded && active?.list === list) active = undefined;
    });
    label?.addEventListener('click', event => {
      if (event.target.closest('button, [popover]') || trigger.disabled) return;
      event.preventDefault();
      trigger.focus();
      open();
    });
    select.addEventListener('invalid', event => {
      event.preventDefault();
      trigger.setAttribute('aria-invalid', 'true');
      if (!list.matches(':popover-open')) open();
    });
    select.addEventListener('change', sync);
    controls.set(select, sync);
    sync();
  }

  const syncAll = () => {
    root.querySelectorAll('select').forEach(enhance);
    for (const [select, sync] of controls) {
      if (root.contains(select)) sync();
      else controls.delete(select);
    }
  };
  new MutationObserver(records => {
    if (records.some(record => record.target instanceof HTMLSelectElement ||
      [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element &&
        (node.matches('select') || node.querySelector('select'))))) syncAll();
  }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  root.addEventListener('reset', () => queueMicrotask(syncAll));
  root.addEventListener('close', () => active?.close(), true);
  window.addEventListener('resize', () => active?.close(true));
  document.addEventListener('scroll', event => {
    if (active && !active.list.contains(event.target)) active.close();
  }, true);
  syncAll();
  return syncAll;
}

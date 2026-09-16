(() => {
  'use strict';
  const menuButton = document.getElementById('navToggle');
  const nav = document.getElementById('primaryNav');
  const modal = document.getElementById('bookingModal');
  let lastFocus;
  function closeMenu() {
    nav.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', '打开菜单');
  }
  menuButton.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-header')) closeMenu();
  });
  window.matchMedia('(min-width: 801px)').addEventListener('change', closeMenu);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      closeMenu();
      menuButton.focus();
    }
  });
  document.querySelectorAll('[data-open-modal]').forEach(button => {
    button.addEventListener('click', () => {
      lastFocus = button;
      closeMenu();
      const teacher = button.dataset.teacher;
      const course = button.dataset.courseLabel;
      document.getElementById('modalTitle').textContent = teacher ? '咨询' + teacher : course ? '预约试听 · ' + course : '预约试听';
      document.getElementById('modalDesc').textContent = teacher
        ? '请用微信扫码，备注希望咨询' + teacher + '，并告知学员年龄与学习基础。'
        : '请用微信扫码，告知' + (course || '意向课程') + '、学员年龄与学习基础。';
      modal.showModal();
      document.body.classList.add('modal-open');
      modal.querySelector('.modal-close').focus();
    });
  });
  modal.querySelectorAll('.modal-close, .modal-done').forEach(button => button.addEventListener('click', () => modal.close()));
  let backdropPointer = false;
  const outside = event => {
    const rect = modal.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  modal.addEventListener('pointerdown', event => { backdropPointer = outside(event); });
  modal.addEventListener('click', event => { if (backdropPointer && outside(event)) modal.close(); });
  modal.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.getClientRects().length) lastFocus.focus();
    else menuButton.focus();
  });
  // The existing project QR remains outside web; a missing image has a readable fallback.
  const qr = document.getElementById('qrImage');
  const fallback = document.getElementById('qrFallback');
  qr.addEventListener('load', () => { qr.hidden = false; fallback.hidden = true; });
  qr.addEventListener('error', () => { qr.hidden = true; fallback.hidden = false; });
  qr.src = '../assets/wechat-qr.png';
  document.getElementById('year').textContent = new Date().getFullYear();
})();

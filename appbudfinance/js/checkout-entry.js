(function () {
  'use strict';
  var plan = (new URLSearchParams(location.search).get('checkout') || '').toLowerCase();
  if (!['starter','pro','plus'].includes(plan)) return;
  var warmed = false;
  document.documentElement.dataset.checkoutEntry = 'loading';
  window.BudCheckoutEntry = {
    requested:true,
    showError:function () { var title=document.querySelector('#checkoutEntry h1'); if(title)title.textContent='Não foi possível carregar o pagamento'; },
    showLogin:function () { document.documentElement.dataset.checkoutEntry = 'login'; var splash=document.getElementById('splash'); if(splash)splash.remove(); },
    start:function () { document.documentElement.dataset.checkoutEntry = 'loading'; },
    warm:function () {
      if (warmed || window.BUD_USE_EMULATOR) return;
      warmed = true;
      var base = String(window.BUD_FUNCTIONS_URL || 'https://bud-finance-backend.onrender.com').replace(/\/$/,'');
      var controller = new AbortController(), timer = setTimeout(function () {controller.abort();},45000);
      // Read-only warmup overlaps SDK downloads/session restoration. Never creates a checkout.
      fetch(base + '/api/ping',{method:'GET',credentials:'omit',cache:'no-store',signal:controller.signal})
        .catch(function () {}).finally(function () {clearTimeout(timer);});
    }
  };
  document.addEventListener('DOMContentLoaded',function () {
    var name = document.getElementById('checkoutEntryPlan');
    if (name) name.textContent = {starter:'Starter',pro:'Plus',plus:'Pro'}[plan];
    var reveal = document.getElementById('checkoutEntryLogin');
    if (reveal) reveal.addEventListener('click',function () {location.reload();});
  });
}());

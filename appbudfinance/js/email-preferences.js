(function () {
  'use strict';
  var token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  var button = document.getElementById('unsubscribe'), status = document.getElementById('status');
  if (!/^m1\.[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)) {
    button.hidden = true;
    status.textContent = 'Abra o link completo de descadastramento que veio no seu e-mail.';
    return;
  }
  button.addEventListener('click',async function () {
    button.disabled = true; status.dataset.error = 'false'; status.textContent = 'Salvando sua preferência…';
    var controller = new AbortController(),timer = setTimeout(function () {controller.abort();},30000);
    try {
      var base = String(window.BUD_FUNCTIONS_URL || 'https://bud-finance-backend.onrender.com').replace(/\/$/,'');
      var response = await fetch(base + '/api/marketing/unsubscribe',{
        method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({token:token}),signal:controller.signal
      });
      var data = await response.json().catch(function () {return {};});
      if (!response.ok || data.unsubscribed !== true) throw Error(data.error || 'Não foi possível salvar. Tente novamente.');
      document.querySelector('h1').textContent = 'Descadastramento confirmado';
      var intro=document.getElementById('unsubscribeIntro'); if(intro)intro.hidden=true;
      status.textContent = 'Sua preferência foi salva. Você não receberá novos e-mails promocionais do Bud Finance.';
      button.hidden = true; history.replaceState(null,'',location.pathname);
    } catch (error) {
      status.dataset.error = 'true';
      status.textContent = error.name === 'AbortError' ? 'O servidor demorou a responder. Tente novamente para confirmar sua preferência.' : error.message;
      button.disabled = false;
    } finally {clearTimeout(timer);}
  });
}());

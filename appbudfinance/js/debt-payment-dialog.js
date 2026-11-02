(function(root){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const brl=value=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  function open({debt,index,accounts,onConfirm}){
    if(document.getElementById('modalPagamentoDivida'))return Promise.resolve(null);
    const plan=root.BudDebtPayments.model(debt,index);
    if(!plan.count)return Promise.resolve({already:true});
    const available=accounts.filter(c=>c.tipo!=='credito' && c.ativo!==false);
    return new Promise(resolve=>{
      let busy=false,mode='',accountId=available.some(c=>c.id===debt.contaId)?debt.contaId:'';
      const previous=document.activeElement,overlay=document.createElement('div');
      overlay.id='modalPagamentoDivida';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','pagamentoDividaTitulo');
      overlay.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(6px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;';
      const today=new Date(),date=`${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
      const input='width:100%;padding:.625rem .75rem;border:1.5px solid var(--input-border,#dbe3ef);border-radius:.75rem;background:var(--input-bg,#f8fafc);color:var(--text-main,#1e293b);font:inherit;box-sizing:border-box;';
      overlay.innerHTML=`<div style="background:var(--card-bg,#fff);color:var(--text-main,#1e293b);border:1px solid var(--card-border,#dbe3ef);border-radius:1.25rem;padding:1.25rem;width:100%;max-width:440px;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);">
        <h2 id="pagamentoDividaTitulo" style="font-size:1.0625rem;margin:0 0 .375rem;">Registrar pagamento ${plan.count===1?'da parcela '+(index+1):'das parcelas '+(plan.paid+1)+' a '+(index+1)}</h2>
        <p style="font-size:.875rem;">${esc(debt.nome||'Dívida')}</p><p style="font-size:1.125rem;font-weight:800;">${brl(plan.amount)}</p>
        ${plan.count>1?`<p style="font-size:.8125rem;color:#b45309;">A dívida mantém uma sequência: esta confirmação inclui as ${plan.count} parcelas de ${plan.paid+1} a ${index+1} ainda pendentes. Total: ${brl(plan.amount)}. Cancele se não quiser confirmar todas elas.</p>`:''}
        <label style="display:block;font-weight:700;font-size:.8125rem;">📅 Data do pagamento / registro<input id="pagamentoDividaData" style="${input};margin-top:.375rem;" inputmode="numeric" maxlength="10" placeholder="DD/MM/AAAA" value="${date}"></label>
        <label style="display:flex;gap:.5rem;align-items:center;margin-top:1rem;font-size:.875rem;font-weight:700;"><input id="pagamentoDividaContaModo" type="radio" name="modoPagamentoDivida" value="conta"> Registrar pagamento em uma conta</label>
        <div class="custom-select" style="position:relative;margin-top:.5rem;">
          <button type="button" id="pagamentoDividaContaBtn" class="custom-select-trigger" aria-haspopup="listbox" aria-expanded="false" disabled style="${input};text-align:left;cursor:pointer;"><span id="pagamentoDividaContaNome">Escolha a conta</span><span style="float:right;">▾</span></button>
          <input type="hidden" id="pagamentoDividaContaId" value="${esc(accountId)}">
          <div id="pagamentoDividaContas" class="custom-select-dropdown" role="listbox" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);max-height:160px;overflow:auto;background:var(--card-bg,#fff);border:1px solid var(--input-border,#dbe3ef);border-radius:.75rem;z-index:2;box-shadow:0 8px 20px rgba(0,0,0,.15);">
            ${available.map((c,i)=>`<button type="button" role="option" class="custom-select-option" data-index="${i}" data-value="${esc(c.id)}" aria-selected="${c.id===accountId}" style="width:100%;padding:.625rem .75rem;border:0;background:transparent;color:var(--text-main,#1e293b);font:inherit;text-align:left;cursor:pointer;">${esc(c.nome||c.banco||'Conta')}</button>`).join('')}
            ${available.length?'':'<p style="padding:.5rem;font-size:.8125rem;">Nenhuma conta disponível. Cadastre uma em Contas ou apenas marque como pago.</p>'}
          </div>
        </div>
        <p style="font-size:.75rem;line-height:1.5;">Com conta: registra uma despesa e desconta do saldo cadastrado. Não realiza transferência bancária.</p>
        <label style="display:flex;gap:.5rem;align-items:center;margin-top:.875rem;font-size:.875rem;font-weight:700;"><input id="pagamentoDividaSoMarcar" type="radio" name="modoPagamentoDivida" value="sem_conta"> Apenas marcar como pago</label>
        <p style="font-size:.75rem;line-height:1.5;">Sem alterar saldo de contas nem gerar outra despesa no extrato geral. O registro fica no extrato desta dívida.</p>
        ${debt.tipo==='parcelamento_fatura'?'<p style="font-size:.75rem;line-height:1.5;">Nas duas opções, a parcela confirmada libera o limite reservado deste parcelamento no cartão.</p>':''}
        <p id="pagamentoDividaErro" role="alert" style="color:#dc2626;font-size:.8125rem;"></p>
        <div style="display:flex;gap:.5rem;margin-top:1rem;">
          <button type="button" id="pagamentoDividaCancelar" style="${input};font-weight:700;cursor:pointer;">Cancelar</button>
          <button type="button" id="pagamentoDividaConfirmar" disabled style="${input};background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border:0;font-weight:800;cursor:pointer;">Confirmar registro</button>
        </div>
      </div>`;
      document.body.appendChild(overlay);
      const el=id=>overlay.querySelector('#'+id),confirm=el('pagamentoDividaConfirmar'),cancel=el('pagamentoDividaCancelar'),dateEl=el('pagamentoDividaData'),button=el('pagamentoDividaContaBtn'),list=el('pagamentoDividaContas');
      function dateISO(){const [d,m,y]=dateEl.value.split('/');return `${y}-${m}-${d}`;}
      function update(){
        confirm.disabled=busy || !root.BudDebtPayments.validDate(dateISO()) || !(mode==='sem_conta'||(mode==='conta'&&accountId));
        confirm.style.opacity=confirm.disabled?'.45':'1';button.disabled=busy||mode!=='conta';button.style.opacity=button.disabled?'.5':'1';
        const account=available.find(c=>c.id===accountId);el('pagamentoDividaContaNome').textContent=account?(account.nome||account.banco||'Conta'):'Escolha a conta';
        el('pagamentoDividaContaId').value=accountId;
      }
      function hideList(){list.style.display='none';button.setAttribute('aria-expanded','false');}
      button.onclick=()=>{
        const opening=list.style.display==='none';list.style.display=opening?'block':'none';button.setAttribute('aria-expanded',String(opening));
        const up=window.innerHeight-button.getBoundingClientRect().bottom<180;list.classList.toggle('open-up',up);list.style.top=up?'auto':'calc(100% + 4px)';list.style.bottom=up?'calc(100% + 4px)':'auto';
      };
      list.onclick=e=>{const option=e.target.closest('[data-index]');if(!option)return;accountId=available[Number(option.dataset.index)]?.id||'';list.querySelectorAll('[role=option]').forEach(b=>b.setAttribute('aria-selected',String(b===option)));hideList();update();};
      overlay.addEventListener('click',e=>{if(!e.target.closest('.custom-select'))hideList();});
      dateEl.oninput=()=>{let digits=dateEl.value.replace(/\D/g,'').slice(0,8);if(digits.length>2)digits=digits.slice(0,2)+'/'+digits.slice(2);if(digits.length>5)digits=digits.slice(0,5)+'/'+digits.slice(5);dateEl.value=digits;update();};
      el('pagamentoDividaContaModo').onchange=()=>{mode='conta';update();};el('pagamentoDividaSoMarcar').onchange=()=>{mode='sem_conta';hideList();update();};
      function finish(value){document.removeEventListener('keydown',keydown,true);overlay.remove();if(previous?.isConnected)previous.focus();resolve(value);}
      function keydown(e){if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(!busy)finish(null);}if(e.key==='Tab'){const controls=[...overlay.querySelectorAll('button:not(:disabled),input:not(:disabled):not([type=hidden])')].filter(c=>c.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}
      document.addEventListener('keydown',keydown,true);cancel.onclick=()=>{if(!busy)finish(null);};
      confirm.onclick=async()=>{
        if(confirm.disabled||busy)return;busy=true;overlay.querySelectorAll('input').forEach(c=>c.disabled=true);cancel.disabled=true;hideList();update();confirm.textContent='Registrando…';
        try{const result=await onConfirm({accountId:mode==='conta'?accountId:null,date:dateISO(),expectedPaid:plan.paid,expectedAmount:plan.amount});finish(result);}
        catch(error){el('pagamentoDividaErro').textContent=error.message||'Não foi possível registrar. Tente novamente.';busy=false;overlay.querySelectorAll('input').forEach(c=>c.disabled=false);cancel.disabled=false;confirm.textContent='Tentar novamente';update();}
      };
      update();cancel.focus();
    });
  }
  root.BudDebtPaymentDialog={open};
})(window);


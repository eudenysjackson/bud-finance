(function(){
 'use strict';
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const compare=(a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR',{sensitivity:'base',numeric:true});
 function presentation(tx){
  const income=(tx.tipo==='receita'?1:-1)*Number(tx.valor||0)>=0;
  const refund=income&&(Number(tx.valor)<0||normalize(tx.categoria)==='estorno');
  const pix=/\bpix\b/i.test([tx.formaPagamento,tx.metodoPagamento,tx.descricao,tx.categoria].filter(Boolean).join(' '));
  return {label:refund?'Estorno / devolução':tx.transferencia?'Transferência · '+(income?'entrada':'saída'):income?'Receita · entrada':'Despesa · saída',method:pix?(tx.cartaoId||/credito/.test(normalize(tx.formaPagamento))||/pix no credito/.test(normalize(tx.categoria))?'Pix no crédito':income?'Pix recebido':'Pix enviado'):(tx.formaPagamento||''),color:income?'#059669':'#dc2626',income};
 }
 window.BudCategoryUI={compare,presentation,openChoices(trigger,{items,selected,onSelect}){const dd=document.createElement('div');for(const item of items){const o=document.createElement('div');o.className='custom-select-option'+(item.nome===selected?' selected':'');o.dataset.value=item.nome;o.dataset.tipo=item.tipo||'';o.textContent=(item.emoji?item.emoji+' ':'')+item.nome;o.onclick=()=>onSelect(item.nome);dd.appendChild(o);}openPicker(trigger,dd);}};
 const selectors={'triggerCatGasto':'dropdownCatGasto','editCatBtn':'editCatDropdown','globalCatBtn':'globalCatDropdown','categoriaBtn':'categoriaDropdown'};
 let closeCurrent=null;
 function openPicker(trigger,dropdown){
  closeCurrent?.();
  trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','true');
  const originals=[...dropdown.querySelectorAll('.custom-select-option')];if(!originals.length)return;
  const options=originals.map(node=>({node,name:node.dataset.value||node.textContent.trim(),label:node.textContent.trim()})).sort(compare);
  const overlay=document.createElement('div');overlay.id='budCategoryPicker';overlay.style.cssText='position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.55);backdrop-filter:blur(6px);padding:16px;box-sizing:border-box;';
  const card=document.createElement('section');card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-labelledby','budCategoryTitle');card.style.cssText='background:var(--card-bg,#fff);color:var(--card-text,#1e293b);border:1px solid var(--card-border,#e2e8f0);border-radius:24px;padding:20px;width:min(640px,100%);max-height:85dvh;display:flex;flex-direction:column;box-sizing:border-box;box-shadow:0 24px 80px rgba(0,0,0,.2);';
  card.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;"><h2 id="budCategoryTitle" style="font:700 18px Inter,system-ui;margin:0;">Escolher categoria</h2><button type="button" aria-label="Fechar categorias" style="border:0;background:transparent;color:inherit;font-size:24px;cursor:pointer;padding:8px;">×</button></div><p style="font-size:13px;color:var(--card-text-sec,#64748b);margin:4px 0 14px;">Categorias em ordem alfabética</p><input type="search" aria-label="Buscar categoria" placeholder="Buscar categoria…" style="box-sizing:border-box;width:100%;padding:13px;border-radius:12px;border:1px solid var(--input-border,#cbd5e1);background:var(--input-bg,#f8fafc);color:inherit;font:inherit;margin-bottom:14px;outline-color:#2563eb;"><div data-options style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:8px;overflow:auto;min-height:0;padding:2px;"></div>';
  overlay.appendChild(card);document.body.appendChild(overlay);
  const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const siblings=[...document.body.children].filter(n=>n!==overlay).map(n=>[n,n.inert]);siblings.forEach(([n])=>n.inert=true);
  const close=()=>{document.removeEventListener('keydown',keys,true);siblings.forEach(([n,value])=>n.inert=value);overlay.remove();document.body.style.overflow=oldOverflow;closeCurrent=null;trigger.setAttribute('aria-expanded','false');if(trigger.isConnected)trigger.focus();};closeCurrent=close;
  function keys(e){if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}if(e.key==='Tab'){const all=[...card.querySelectorAll('button,input')].filter(n=>!n.hidden);const first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
  document.addEventListener('keydown',keys,true);
  overlay.addEventListener('click',e=>{e.stopPropagation();if(e.target===overlay)close();});card.querySelector('button').onclick=close;
  const list=card.querySelector('[data-options]'),search=card.querySelector('input');
  function render(){list.replaceChildren();const shown=options.filter(o=>normalize(o.name).includes(normalize(search.value)));
   if(!shown.length){const p=document.createElement('p');p.textContent='Nenhuma categoria encontrada.';list.appendChild(p);return;}
   for(const o of shown){const btn=document.createElement('button');btn.type='button';btn.style.cssText='text-align:left;min-height:58px;padding:12px;border-radius:12px;border:1px solid var(--card-border,#e2e8f0);background:var(--input-bg,#f8fafc);color:inherit;font:600 14px Inter,system-ui;cursor:pointer;';btn.setAttribute('aria-pressed',String(o.node.classList.contains('selected')));if(o.node.classList.contains('selected'))btn.style.borderColor='#2563eb';
    const label=document.createElement('span');label.textContent=o.label;label.style.display='block';btn.appendChild(label);
    const kinds=['receita','despesa'].filter(k=>(window.BUD_CATEGORIAS_PADRAO?.[k]||[]).some(c=>(c.nome||c)===o.name));
    const type=o.node.dataset.tipo||(kinds.length===1?kinds[0]:kinds.length>1?'ambas':dropdown.id==='dropdownCatGasto'||dropdown.id.startsWith('iaCatDrop_')?'despesa':'');
    const badge=document.createElement('small');badge.textContent=type==='receita'?'↓ Receita':type==='despesa'?'↑ Despesa':type==='ambas'?'Receita / despesa':'Categoria personalizada';badge.style.cssText='display:block;margin-top:5px;font-size:11px;font-weight:600;color:'+(type==='receita'?'#059669':type==='despesa'?'#dc2626':'var(--card-text-sec,#64748b)');btn.appendChild(badge);
    btn.onclick=()=>{close();o.node.click();};list.appendChild(btn);
   }
  }
  search.oninput=render;render();search.focus();
 }
 document.addEventListener('click',e=>{const trigger=e.target.closest?.('#triggerCatGasto,#editCatBtn,#globalCatBtn,#categoriaBtn,[data-ia-cat] .custom-select-trigger');if(!trigger)return;const dropdown=document.getElementById(selectors[trigger.id])||trigger.closest('[data-ia-cat]')?.querySelector('.custom-select-dropdown');if(!dropdown)return;e.preventDefault();e.stopImmediatePropagation();openPicker(trigger,dropdown);},true);
})();

# 🎨 Identidade Visual – Bud Finanças

**Versão**: 1.0  
**Data**: 06/04/2026  
**Propósito**: Guia completo de design system para manutenção e novo projeto

---

## 📋 Sumário Executivo

O Bud Finanças possui uma identidade visual moderna, limpa e responsiva, baseada em:
- **Fonte única**: Inter (Google Fonts), pesos 400-900
- **Paleta monocromática com acentos**: Azul primário + verde (positivo) e vermelho (negativo)
- **Efeito glassmorphism**: Vidro semi-transparente com blur
- **Dark mode nativo**: Toda interface pronta para tema escuro
- **Animações suaves**: Transições de 0.2-0.65s, easing cubic-bezier
- **Design mobile-first**: Responsivo via Tailwind, 100% funcional em qualquer tela

---

## 🔤 Tipografia

### Fonte Base
- **Família**: Inter (Google Fonts)
- **Carregamento**: `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">`
- **Aplicação global**: `body { font-family: 'Inter', sans-serif; }`

### Hierarquia Tipográfica

| Elemento | Uso | Classe Tailwind | Peso | Exemplo |
|---|---|---|---|---|
| **Títulos de página** | H1 em seções | `text-3xl md:text-4xl font-extrabold` | 800 | "Extrato Completo" |
| **Subtítulos/cards** | H3/H4 em painéis | `text-sm md:text-lg font-extrabold` | 800 | "Nova Receita" |
| **Labels de campo** | Descrição de input | `text-[10px] font-extrabold uppercase tracking-widest` | 800 | "E-MAIL OU MATRÍCULA" |
| **Valores monetários** | Saldos, totais | `font-extrabold` + `clamp(0.7rem, 2.8vw, 1.5rem)` | 800 | "R$ 10.500,00" |
| **Corpo/descrição** | Texto longo | `text-sm font-medium text-slate-600` | 500 | "Insira seus dados de acesso" |
| **Botões** | CTA | `font-extrabold text-base` | 800 | "Acessar meu painel" |
| **Badge/tags** | Status pequeno | `text-[11px] font-bold uppercase` | 700 | "PLANO PRO" |

### Letter Spacing (Tracking)

- Labels uppercase: `tracking-widest` (0.28em)
- Títulos: `tracking-tight` (-0.03em)
- Padrão: `tracking-normal`

---

## 🎨 Paleta de Cores

### Cores Primárias

| Nome | Hex | RGB | Tailwind | Uso |
|---|---|---|---|---|
| **Azul primário** | `#2563eb` | rgb(37, 99, 235) | blue-600 | Botões, links, ícone primário |
| **Azul claro** | `#4f75ff` | rgb(79, 117, 255) | - | Gradiente card de saldo |
| **Azul escuro** | `#375ee3` | rgb(55, 94, 227) | - | Gradiente card de saldo (fim) |

### Cores de Sentimento

| Nome | Hex | Tailwind | Uso |
|---|---|---|---|
| **Verde (receita/positivo)** | `#10b981` | emerald-500 | Receitas, setas up, positivo |
| **Vermelho (despesa/negativo)** | `#ef4444` | red-500 | Despesas, alertas, setas down |
| **Âmbar (aviso)** | `#f59e0b` | amber-500 | Lembretes, pendências |
| **Ciano (destaque)** | `#06b6d4` | cyan-500 | Efeito secundário |

### Escala de Cinza

| Nome | Hex | Tailwind | Uso |
|---|---|---|---|
| **Fundo light** | `#f4f7fb` | bg-[#f4f7fb] | Body background |
| **Fundo login** | `#f0f4f8` | bg-[#f0f4f8] | Páginas auth |
| **Branco** | `#ffffff` | white | Cards, inputs |
| **Slate 100** | `#f1f5f9` | slate-100 | Backgrounds suaves |
| **Slate 200** | `#e2e8f0` | slate-200 | Bordas, divisores |
| **Slate 400** | `#94a3b8` | slate-400 | Placeholder, disabled |
| **Slate 600** | `#475569` | slate-600 | Texto secundário |
| **Slate 700** | `#3f3f46` | slate-700 | Texto primário |
| **Slate 800** | `#1e293b` | slate-800 | Texto forte |

### Cores Dark Mode

| Elemento | Light | Dark |
|---|---|---|
| Body background | `#f4f7fb` | `#0f172a` |
| Card/white | `#ffffff` | `#1e293b` |
| Header | `rgba(255,255,255,0.85)` | `rgba(15,23,42,0.95)` |
| Borda | `#e2e8f0` | `#334155` |
| Texto primário | `#1e293b` | `#e2e8f0` |
| Texto secundário | `#475569` | `#94a3b8` |

---

## 🎭 Gradientes

### Gradiente Card de Saldo
```css
background: linear-gradient(to right, #4f75ff, #375ee3);
/* Azul médio → Azul escuro */
```
- Ângulo: `to right` (90°)
- Cores: Blue-500 → Blue-600 (variação de saturação)

### Gradiente Banner Premium / Dark Panels
```css
background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0c4a6e 100%);
/* Azul muito escuro → Azul-escuro com tint → Azul-ciano escuro */
```
- Para informações importantes, premium ou dark mode

### Gradiente Splash Screen (Fundo)
```css
background: linear-gradient(145deg, #0b1120 0%, #162036 45%, #0f172a 100%);
/* Preto-azulado → Azul profundo → Azul-escuro */
```

### Gradiente Logo Splash (Texto)
```css
background: linear-gradient(135deg, #60a5fa 0%, #818cf8 50%, #a78bfa 100%);
/* Azul claro → Violeta → Lilás */
clip-path: text; /* Clip-text para aplicar ao texto */
```

### Gradiente Shimmer (Botão Premium)
```css
background: linear-gradient(90deg, #38bdf8 0%, #818cf8 50%, #38bdf8 100%);
background-size: 200%;
animation: shimmer 3s linear infinite;
/* Ciano → Violeta → Ciano, deslizando continuamente */
```

### Gradiente Barra de Progresso (Orçamento)
```css
background: linear-gradient(90deg, #10b981, #059669);
/* Verde claro → Verde escuro */
```

### Efeito Radial (Decorativo nos Banners)
```css
background: 
  radial-gradient(ellipse at 100% 0%, rgba(99,102,241,0.3) 0%, transparent 60%),
  radial-gradient(ellipse at 0% 100%, rgba(56,189,248,0.2) 0%, transparent 60%);
/* Elipses nos cantos com indigo e ciano em opacidade baixa */
```

---

## 🔲 Bordas Arredondadas (Border Radius)

| Elemento | Valor | Tailwind | Uso |
|---|---|---|---|
| **Blobs de fundo** | 50% | `rounded-full` | Círculos decorativos |
| **Avatar/ícone circular** | 50% | `rounded-full` | Foto, avatar |
| **Cards amplificados** | 2rem | `rounded-[2rem]` | Dashboard principal |
| **Cards grandes** | 1.5rem | `rounded-[1.5rem]` | Cards de seção |
| **Cards médios** | 1rem | `rounded-2xl` | Cards flutuantes |
| **Inputs, botões** | 0.75rem | `rounded-xl` | Form elements |
| **Badges, pills** | 9999px | `rounded-full` | Status badge |
| **Modal (topo)** | 1.5rem | `rounded-t-3xl` | Bottom sheet (só topo) |

---

## 💎 Glassmorphism (Vidro)

### `.glass-card`
```css
background: rgba(255, 255, 255, 0.9);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.9);
box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
```
- Usado em cards flutuantes
- Permite ver conteúdo atrás com blur
- Sombra suave e sutil

### `.glass-panel`
```css
background: rgba(255, 255, 255, 0.85);
backdrop-filter: blur(24px);
-webkit-backdrop-filter: blur(24px);
border-right: 1px solid rgba(255, 255, 255, 0.7);
```
- Usado em header e sidebar
- Opacidade ligeiramente menor
- Mais blur para maior ilusão de vidro

---

## 🌌 Efeito Blob (Fundo Decorativo)

Presente em todas as páginas internas e de auth:

```html
<!-- Canto superior esquerdo (azul) -->
<div class="absolute top-0 left-0 w-[40%] h-[40%] bg-blue-300/40 rounded-full blur-[100px] pointer-events-none z-0"></div>

<!-- Canto inferior direito (ciano) -->
<div class="absolute bottom-0 right-0 w-[30%] h-[30%] bg-cyan-300/30 rounded-full blur-[100px] pointer-events-none z-0"></div>
```

**Propriedades**:
- `position: absolute` com `inset-0` ou `top/bottom/left/right`
- `rounded-full` + `blur-[100px]` = mancha suave
- `pointer-events: none` para não interferir com cliques
- `z-index: 0` para ficar no fundo
- Cores com `/40` ou `/30` opacity para sutil
- Não deve ser visível em dark mode (recommendação: remover ou ajustar)

---

## 😊 Ícones 3D (Emojis)

### Classe `.icon-3d`
```css
filter:
  drop-shadow(0px 1px 1px rgba(0,0,0,0.05))
  drop-shadow(0px 3px 4px rgba(0,0,0,0.13))
  drop-shadow(0px 6px 10px rgba(0,0,0,0.07));
display: inline-block;
transform: translateZ(0);
```
- Aplicada a emojis em itens de menu, botões, badges
- Múltiplas camadas de drop-shadow para profundidade
- `transform: translateZ(0)` força renderização em GPU

### Classe `.icon-3d-lg` (versão grande)
```css
filter:
  drop-shadow(0px 2px 2px rgba(0,0,0,0.06))
  drop-shadow(0px 5px 8px rgba(0,0,0,0.14))
  drop-shadow(0px 10px 16px rgba(0,0,0,0.06));
display: inline-block;
transform: translateZ(0);
```
- Sombras maiores para emojis em tamanho grande (ex: carrossel de categorias)

---

## 🎬 Animações

### 1. **Shimmer** (Botão Premium)
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.shimmer-btn {
  background: linear-gradient(90deg, #38bdf8 0%, #818cf8 50%, #38bdf8 100%);
  background-size: 200% auto;
  animation: shimmer 3s linear infinite;
}
```
- Duração: **3s**
- Timing: `linear` (velocidade constante)
- Uso: Botão "Garantir Acesso", "Fazer Upgrade"

### 2. **Slide Up** (Modais, Bottom Sheets)
```css
@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.animate-slide-up { animation: slide-up 0.3s ease-out; }
```
- Duração: **0.3s**
- Timing: `ease-out` (começa rápido, termina suave)
- Uso: Modal de seletor de mês, bottom sheet
- CSS inline: `animation: slide-up 0.3s ease-out;`

### 3. **Splash Glow** (Splash Screen)
```css
@keyframes splGlow {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.25); opacity: 1; }
}
#bud-splash::before {
  animation: splGlow 3s ease-in-out infinite;
}
```
- Duração: **3s**
- Timing: `ease-in-out`
- Uso: Halo atrás do logo do splash

### 4. **Splash Spin** (Spinner)
```css
@keyframes splSpin {
  to { transform: rotate(360deg); }
}
.splash-ring .rr {
  animation: splSpin 0.85s linear infinite;
}
```
- Duração: **0.85s**
- Timing: `linear`
- Uso: Anel spinner do splash

### 5. **Splash Pulse** (Anel pulsante)
```css
@keyframes splPulse {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.45); opacity: 0; }
}
.splash-ring::before {
  animation: splPulse 2s ease-in-out infinite;
}
```
- Duração: **2s**
- Timing: `ease-in-out`
- Uso: Anel decorativo ao redor do spinner

### 6. **Accordion Panel** (Card Panel)
```css
.card-panel {
  transition: max-height 0.3s ease-in-out, padding 0.3s ease-in-out;
  max-height: 0;
  overflow: hidden;
}
.card-panel.open { max-height: 600px; }
```
- Duração: **0.3s**
- Transição em `max-height` e `padding`
- Uso: Cards colapsáveis (Cartões, Metas)

### 7. **Hover Effects**

| Trigger | Efeito | Duração | Uso |
|---|---|---|---|
| `hover:scale-105` | Cresce 5% | default 150ms | Avatar, badges |
| `hover:-translate-y-1` | Sobe 4px | default | Cards (receita/despesa) |
| `hover:shadow-md` | Sombra mais forte | default | Cards ao passar mouse |
| `transition-colors` | Fade de cor | 150ms | Links, botões |
| `transition-all` | Todas propriedades | 300-500ms depende | Modais, painéis |

### 8. **Transições de Entrada/Saída**

**Toast**:
- Entrada: `opacity 0→1 + translateX(20px→0)`, **0.35s**, `ease`
- Saída: reverso no timeout (padrão 3000ms)

**Splash Screen**:
- Entrada: opacity 1, scale 1 (padrão)
- Saída: `opacity 0 + scale(1.04)`, **0.65s**, `cubic-bezier(.4,0,.2,1)`

**Modal Overlay**:
- Entrada: `opacity 0→1 + backdrop-blur 0→full`, **0.2s**
- Saída: reverso

---

## 🎯 Componentes UI

### Botão Primário
```html
<button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all text-base">
  Acessar meu painel
</button>
```
- Background: `bg-blue-600 hover:bg-blue-700`
- Padding: `py-3 px-4` (vertical/horizontal)
- Sombra: `shadow-lg shadow-blue-500/30` (sombra colorida)
- Radius: `rounded-xl`
- Transição: `transition-all`

### Card de Saldo
```html
<div class="bg-gradient-to-r from-[#4f75ff] to-[#375ee3] rounded-[1.5rem] p-6 md:p-6 text-white shadow-lg">
  <h2 class="text-4xl md:text-[36px] font-extrabold mb-10 md:mb-5 tracking-tight leading-none">R$ 0,00</h2>
</div>
```
- Background: gradiente azul
- Padding responsivo: `p-6 md:p-6`
- Sombra: `shadow-lg`
- Texto: branco, extrabold

### Input/Select
```html
<input type="text" class="w-full px-4 py-2.5 rounded-xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 font-medium transition-colors text-sm">
```
- Border: `border-2 border-slate-100`
- Focus: muda para `bg-white` e `border-blue-500`
- Transição: `transition-colors`

### Badge/Tag
```html
<span class="w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">3</span>
```
- Tamanho: `w-4 h-4`
- Background colorido
- Texto branco, bold, mini
- Circular: `rounded-full`

### Modal Overlay
```html
<div class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end justify-center z-[70]">
  <div class="bg-white w-full max-w-sm rounded-t-3xl p-6 shadow-2xl">
    <!-- Conteúdo -->
  </div>
</div>
```
- Overlay: `fixed inset-0` (cobre tudo)
- Escurecimento: `bg-slate-900/40`
- Blur: `backdrop-blur-sm`
- Sheet: sobe pelo bottom, `rounded-t-3xl`
- Z-index: `z-[70]`

---

## 🌓 Dark Mode

Implementado via `dark-mode.js`, injetado em todas as páginas.

### Toggle
```javascript
// Ativar dark mode
document.body.classList.add('dark');

// Desativar
document.body.classList.remove('dark');

// Salvar em localStorage
localStorage.setItem('nexo_dark_mode', 'true');
```

### Mapeamento de Cores

CSS dinamicamente aplicado quando `body.dark` está ativo:

```css
body.dark { background-color: #0f172a !important; color: #e2e8f0 !important; }
body.dark .bg-white { background: #1e293b !important; }
body.dark .bg-[#f4f7fb] { background: #0f172a !important; }
body.dark .text-slate-800 { color: #e2e8f0 !important; }
body.dark .border-slate-200 { border-color: #334155 !important; }
body.dark .glass-card { background: rgba(30,41,59,0.9) !important; }
```

### Primeira Visita
Se usuário nunca ativou dark mode, respeita preferência do SO:
```javascript
const stored = localStorage.getItem('nexo_dark_mode');
if (stored === 'true' || (stored === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.body.classList.add('dark');
}
```

### Transição Suave
```css
body { transition: background-color 0.2s ease, color 0.2s ease; }
```

---

## 📱 Responsive Design

### Breakpoints (Tailwind padrão)
```css
sm: 640px   /* small phones */
md: 768px   /* tablets em portrait */
lg: 1024px  /* tablets em landscape / desktops pequenos */
xl: 1280px  /* desktops */
2xl: 1536px /* desktops grandes */
```

### Padrões de Responsividade

| Elemento | Mobile | Desktop |
|---|---|---|
| **Padding page** | `p-4` | `md:p-8` |
| **Fonte título** | `text-lg` | `md:text-2xl` |
| **Grid** | `grid-cols-2` | `md:grid-cols-4` |
| **Sidebar** | Hidden fixed + toggle | Always visible |
| **Header** | Compacto | Completo |
| **Seletor mês** | Modal bottom sheet | Inline no header |

### Mobile First
Sempre declarar mobile primeiro, depois desktop com `md:`, `lg:`, etc.

```html
<div class="p-4 md:p-8 text-sm md:text-lg">
  <!-- Padrão mobile (p-4, text-sm) -->
  <!-- Com override para desktop (md:p-8, md:text-lg) -->
</div>
```

---

## 🖼️ Splash Screen

Injetado 100% via JavaScript (`bud-loader.js`), no `<head>` antes do `<body>` renderizar.

### Estrutura

- **ID**: `#bud-splash`
- **Conteúdo**:
  - Halo decorativo (glow)
  - Logo texto com gradiente
  - Subtítulo "FINANÇAS"
  - Spinner (anel giratório + anel pulsante)

### Timing
- **Mínimo**: 700ms (garante que vê a animação)
- **Máximo**: 6000ms (timeout se carregar muito rápido)
- **Aparece**: 1x por sessão (usa `sessionStorage`)
- **Não aparece em**: login, cadastro, recuperar senha, onboarding, home

### Saída
```css
#bud-splash.splash-out {
  opacity: 0;
  transform: scale(1.04);
  pointer-events: none;
  transition: opacity 0.65s cubic-bezier(.4,0,.2,1), 
              transform 0.65s cubic-bezier(.4,0,.2,1);
}
```
- Fade out + leve zoom
- Easing customizado para saída suave

---

## 📊 Sistema de Cores por Categoria

Usado em gráficos (donut, barras):

| Categoria | Cor | Hex |
|---|---|---|
| Acessórios | Roxo | `#a855f7` |
| Alimentos | Verde | `#22c55e` |
| Assinatura | Azul | `#3b82f6` |
| Beleza | Rosa | `#ec4899` |
| Combustível | Laranja | `#f97316` |
| Educação | Violeta | `#8b5cf6` |
| Eletrônicos | Ciano | `#06b6d4` |
| Entretenimento | Amarelo | `#eab308` |
| Farmácia | Vermelho | `#ef4444` |
| Fitness | Verde escuro | `#16a34a` |
| Lazer | Índigo | `#6366f1` |
| Moradia | Âmbar | `#f59e0b` |
| Saúde | Teal | `#14b8a6` |
| Transporte | Cinza | `#6b7280` |
| Viagem | Rosa claro | `#fb7185` |
| Outros | Slate | `#64748b` |

---

## 🧮 Calculador de Responsive Font Size

Para valores monetários que escalam com a tela:

```css
font-size: clamp(0.7rem, 2.8vw, 1.5rem);
```

Significa:
- **Mínimo**: 0.7rem (11px em base 16px)
- **Preferido**: 2.8% do viewport width
- **Máximo**: 1.5rem (24px)

---

## 🔗 Referências de Implementação

### Injetar estilos CSS globais
```javascript
const style = document.createElement('style');
style.textContent = `/* CSS aqui */`;
document.head.appendChild(style);
```

### Bloquear scroll
```css
body { overflow: hidden; height: 100vh; }
```

### Viewport units (mobile)
```css
height: 100dvh; /* Dynamic viewport height */
height: 100vh;  /* Fallback */
```

### Escaper HTML (para XSS)
```javascript
window.escapeHTML = (str) => String(str || '').replace(/[&<>'"]/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[m]);
```

---

## ✅ Checklist de Implementação para Novo Projeto

- [ ] Carregar `tailwind.css` compilado (ou compilar `tailwind.input.css`)
- [ ] Carregar Inter font do Google Fonts
- [ ] Injetar `dark-mode.js` no `<head>` (antes de styles)
- [ ] Injetar `bud-loader.js` no `<head>` (splash screen)
- [ ] Injetar `bud-utils.js` antes de scripts de página
- [ ] Configurar Firebase config (`firebase-config.js`)
- [ ] Implementar `.glass-card` e `.glass-panel` no CSS global
- [ ] Implementar `.icon-3d` com drop-shadow
- [ ] Implementar animações (@keyframes) no CSS global
- [ ] Testar dark mode em todas as páginas
- [ ] Testar responsividade mobile (< 768px)
- [ ] Configurar viewport meta tag com `viewport-fit=cover` para notch support
- [ ] Testar splash screen (min 700ms)
- [ ] Validar gradientes em navegadores antigos (Safari)
- [ ] Auditar contraste de cores (WCAG AA)

---

## 📝 Notas Finais

- **Tailwind é build estático**: Não usar classes dinâmicas geradas em JS. Usar `style` inline para elementos criados dinamicamente.
- **Dark mode é pré-processado**: Todas as cores já estão mapeadas. Basta adicionar `dark` classe no body.
- **Animações devem ser suaves**: Evitar transições muito rápidas (< 0.15s) ou muito lentas (> 1s) sem motivo.
- **Mobile-first sempre**: Declarar estilo mobile base, depois override com `md:`, `lg:`, etc.
- **Acessibilidade**: Manter contraste mínimo WCAG AA (4.5:1 para texto pequeno, 3:1 para grande).
- **Performance**: Usar `will-change` e `transform: translateZ(0)` para animações GPU.

---

**Gerado em**: 06 de abril de 2026  
**Projeto**: Bud Finanças v2 (Restart)

---

# 🐛 AUDITORIA DE CONSISTÊNCIA — Identidade Visual

> Auditoria realizada em 08/04/2026 — Verificação cross-page de consistência com o guia de identidade visual.

---

## Problemas Encontrados: 6

### 🟡 Problema #1 — MÉDIO: Regra de Tailwind Dinâmico Violada em TODAS as Telas JS

**Onde:** `js/configuracoes.js`, `js/dividas.js`, `js/carteira.js`, `js/index.js`, `js/recorrentes.js`, `js/cartoes.js`  
**O quê:** Apesar da nota final deste documento dizer "Não usar classes dinâmicas geradas em JS", **toda tela que cria modais via JS usa `className` com valores arbitrários**:
```javascript
ov.className = 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center';
```
Encontrado em: 5 locais em configuracoes.js, 5 em dividas.js, 1+ em carteira.js, 1+ em index.js, múltiplos em recorrentes.js e cartoes.js.

**Impacto:** A regra documentada é sistematicamente violada. Todos os modais criados via JS são invisíveis.

**🔧 SOLUÇÃO:**
Criar utility function global em `bud-utils.js`:
```javascript
window.budCreateOverlay = function(onClick) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
  if (onClick) ov.addEventListener('click', (e) => { if (e.target === ov) onClick(); });
  return ov;
};
window.budCreateModalCard = function() {
  const card = document.createElement('div');
  card.style.cssText = 'background:var(--card-bg,#fff);border-radius:1rem;padding:1.5rem;margin:1rem;max-width:24rem;width:100%;text-align:center;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);';
  return card;
};
```

---

### 🟡 Problema #2 — MÉDIO: Cor de Overlay Inconsistente (slate vs black)

**Onde:** HTML usa `bg-slate-900/40`, JS usa `bg-black/40`  
**O quê:** O guia não define uma cor padrão de overlay. Resultado:
- `dividas.html` linha 182: `bg-slate-900/40` (slate = `rgba(15,23,42,0.4)`)
- `js/dividas.js` linha 860: `bg-black/40` (black = `rgba(0,0,0,0.4)`)
- `js/configuracoes.js`: `bg-black/50` (mais escuro)

**Impacto:** Overlays com nuances visuais diferentes entre telas. Incoerência visual.

**🔧 SOLUÇÃO:**
Adicionar ao guia de identidade visual:
```
### Overlays
- Cor padrão: rgba(15, 23, 42, 0.4)  /* slate-900/40 */
- Blur:       backdrop-filter: blur(4px)
- Z-index:    9999
```
E padronizar em `budCreateOverlay()` acima.

---

### 🟡 Problema #3 — MÉDIO: Nomenclatura "Nexo" Legada em Código

**Onde:** `tutorial.js`, `tutorial-steps.js`, `plan-utils.js`, `plano-config.js`  
**O quê:** Enquanto o app se chama "Bud Finanças", múltiplos arquivos usam nomenclatura "Nexo":
- `window.NexoPlanos` (plan-utils.js)
- `nexo-welcome-overlay` (tutorial.js)
- `nexo_tutorial_done_` (localStorage key)
- `nexo-tour-fab` (tutorial.js)

**Impacto:** Confusão de marca. Código difícil de manter com duas nomenclaturas.

**🔧 SOLUÇÃO:**
Renomear gradualmente — mas manter aliases de retrocompatibilidade:
```javascript
window.BudPlanos = window.NexoPlanos; // Alias
// Em novas features, usar BudPlanos
```

---

### 🟢 Problema #4 — LEVE: Dark Mode Não Testado em Modais JS

**Onde:** Todos os modais criados via `innerHTML` em JS  
**O quê:** Os modais usam classes como `dark:bg-slate-800`, mas como são criadas via innerHTML com Tailwind estático, essas classes podem não estar no build.

**Impacto:** Cards de modal podem ficar brancos mesmo em dark mode.

**🔧 SOLUÇÃO:**
Usar CSS custom properties no `budCreateModalCard()`:
```javascript
card.style.cssText = 'background:var(--card-bg, #fff);color:var(--text-primary, #1e293b);...';
```
E definir as variáveis no CSS:
```css
:root { --card-bg: #fff; --text-primary: #1e293b; }
.dark { --card-bg: #1e293b; --text-primary: #f8fafc; }
```

---

### 🟢 Problema #5 — LEVE: Fonte Inter Não Especifica Fallback Completo

**Onde:** `identidade-visual.md` e `tailwind.config.js`  
**O quê:** O guia define `font-family: 'Inter', sans-serif` mas não especifica fallbacks completos para sistemas que não carregam Google Fonts.

**Impacto:** Em redes lentas/bloqueadas, texto renderiza em serif (Times) antes do fallback.

**🔧 SOLUÇÃO:**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

---

### 🟢 Problema #6 — LEVE: Sem Definição de Z-Index Scale no Guia

**Onde:** `identidade-visual.md`  
**O quê:** O guia não define uma escala de z-index, resultando em valores aleatórios pelo código:
- Sidebar: `z-50`
- Mobile overlay: `z-40`
- Modais JS: `z-[9999]`
- FAB tutorial: `z-[9990]`

**Impacto:** Conflitos de camadas visuais. Elementos ficam atrás/na frente errados.

**🔧 SOLUÇÃO:**
Adicionar ao guia:
```
### Z-Index Scale
| Camada        | Z-Index | Uso               |
|---------------|---------|-------------------|
| Background    | 0       | Conteúdo normal   |
| Sidebar       | 40      | Navegação         |
| Dropdown      | 50      | Menus flutuantes  |
| Modal overlay | 9998    | Fundo do modal    |
| Modal card    | 9999    | Conteúdo do modal |
| FAB           | 10000   | Botão flutuante   |
| Toast         | 10001   | Notificações      |
```

---

## ✅ CHECKLIST DE CORREÇÃO

### 🟡 PRIORIDADE ALTA
- [ ] Problema #1 — Criar `budCreateOverlay()` e `budCreateModalCard()` em bud-utils.js
- [ ] Problema #2 — Padronizar cor de overlays (`rgba(15,23,42,0.4)`)
- [ ] Problema #3 — Criar aliases BudPlanos → NexoPlanos

### 🟢 PRIORIDADE BAIXA
- [ ] Problema #4 — Usar CSS custom properties para dark mode em modais
- [ ] Problema #5 — Completar stack de fallback da fonte Inter
- [ ] Problema #6 — Documentar Z-Index Scale no guia

---

## 📊 RESUMO DE MÉTRICAS

| Severidade | Quantidade |
|---|---|
| 🔴 GRAVE | 0 |
| 🟡 MÉDIO | 3 |
| 🟢 LEVE | 3 |
| **TOTAL** | **6** |

| Categoria | Bugs |
|---|---|
| Tailwind Dinâmico (Systêmico) | #1 |
| Consistência Visual | #2, #4 |
| Nomenclatura | #3 |
| Tipografia | #5 |
| Z-Index | #6 |

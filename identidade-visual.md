# 🎨 Identidade Visual – Bud Finance

**Versão**: 2.0 (Imersão Cromática)  
**Data**: 15/04/2026  
**Propósito**: Guia completo de design system para manutenção, novo projeto e sistema de temas imersivos.

---

## 📋 Sumário Executivo

O Bud Finance possui uma identidade visual moderna, responsiva e **altamente imersiva**, baseada em:
- **Fonte única**: Inter (Google Fonts), pesos 400-900
- **Efeito glassmorphism adaptativo**: Vidro que reage à base de cor do fundo
- **Sistema de Imersão Cromática**: 8 temas — Padrão Gelo, Dark HBO, e 6 cores sólidas imersivas
- **Animações suaves**: Transições de 0.2-0.65s, easing cubic-bezier
- **Design mobile-first**: Responsivo via Tailwind, 100% funcional em qualquer tela

---

## 🔤 Tipografia

### Fonte Base
- **Família**: Inter (Google Fonts)
- **Carregamento**: `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">`
- **Aplicação global**: `body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }`

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

## 🎨 Paleta de Cores e Sistema de Temas

### Cores de Sentimento (Fixas em todos os temas)

| Nome | Hex | Tailwind | Uso |
|---|---|---|---|
| **Verde (receita/positivo)** | `#10b981` | emerald-500 | Receitas, setas up, positivo |
| **Vermelho (despesa/negativo)** | `#ef4444` | red-500 | Despesas, alertas, setas down |
| **Âmbar (aviso)** | `#f59e0b` | amber-500 | Lembretes, pendências |
| **Ciano (destaque)** | `#06b6d4` | cyan-500 | Efeito secundário |

> As cores de sentimento **não mudam** entre temas. São universais.

---

### 🧊 Tema 1 — Padrão Gelo (Default)

Visual limpo, minimalista, inspirado em iOS. Base clara com cards de vidro translúcido.

| Elemento | Valor | CSS Variable |
|---|---|---|
| **Fundo** | `#f4f7fb` | `--bg-page` |
| **Texto principal** | `#1e293b` (slate-800) | `--text-main` |
| **Texto secundário** | `#475569` (slate-600) | `--text-sec` |
| **Card (vidro)** | `rgba(255, 255, 255, 0.7)` | `--card-bg` |
| **Card borda** | `rgba(255, 255, 255, 1)` | `--card-border` |
| **Card texto** | `#1e293b` | `--card-text` |
| **Card texto sec** | `#475569` | `--card-text-sec` |
| **Botão primário bg** | `#2563eb` (blue-600) | `--btn-bg` |
| **Botão primário texto** | `#ffffff` | `--btn-text` |
| **Input bg** | `#f8fafc` (slate-50) | `--input-bg` |
| **Input border** | `#f1f5f9` (slate-100) | `--input-border` |
| **Input border focus** | `#3b82f6` (blue-500) | `--input-focus` |
| **Saldo gradiente from** | `#4f75ff` | `--balance-from` |
| **Saldo gradiente to** | `#375ee3` | `--balance-to` |
| **Saldo texto** | `#ffffff` | `--balance-text` |
| **Saldo mini bg** | `rgba(255,255,255,0.15)` | `--balance-mini-bg` |

---

### 🌑 Tema 2 — Dark HBO (Preto Puro)

Inspirado na HBO Max. Preto absoluto com cards quase opacos e bordas sutis.

| Elemento | Valor | CSS Variable |
|---|---|---|
| **Fundo** | `#000000` (preto puro) | `--bg-page` |
| **Texto principal** | `#ffffff` | `--text-main` |
| **Texto secundário** | `#94a3b8` (slate-400) | `--text-sec` |
| **Card (vidro)** | `rgba(15, 20, 25, 0.95)` | `--card-bg` |
| **Card borda** | `rgba(255, 255, 255, 0.1)` | `--card-border` |
| **Card texto** | `#e2e8f0` | `--card-text` |
| **Card texto sec** | `#94a3b8` | `--card-text-sec` |
| **Botão primário bg** | `#ffffff` | `--btn-bg` |
| **Botão primário texto** | `#000000` | `--btn-text` |
| **Input bg** | `rgba(255, 255, 255, 0.08)` | `--input-bg` |
| **Input border** | `rgba(255, 255, 255, 0.15)` | `--input-border` |
| **Input border focus** | `#ffffff` | `--input-focus` |
| **Saldo gradiente from** | `#1e293b` | `--balance-from` |
| **Saldo gradiente to** | `#0f172a` | `--balance-to` |
| **Saldo texto** | `#ffffff` | `--balance-text` |
| **Saldo mini bg** | `rgba(255,255,255,0.08)` | `--balance-mini-bg` |

---

### 🎨 Temas 3-8 — Cores Imersivas (Sólidas)

Quando o usuário escolhe uma cor, **o fundo inteiro** assume o tom sólido. Os cards ficam **quase opacos em branco** (`rgba(255,255,255,0.92)`), criando contraste nítido com o fundo colorido (estilo iOS). Botão primário inverte para branco (ou preto) para contraste. O **card de saldo** assume um gradiente mais escuro da cor do tema.

| # | Tema | Hex Fundo | Texto (página) | Texto Sec (página) | Card BG | Card Borda | Card Texto | Card Texto Sec | Botão BG | Botão Texto | Inspiração |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | **Azul** | `#1075e8` | `#ffffff` | `#dbeafe` | `rgba(255,255,255,0.92)` | `rgba(255,255,255,0.5)` | `#1e293b` | `#475569` | `#ffffff` | `#1075e8` | Amil / Nav Dasa |
| 4 | **Roxo** | `#8c52ff` | `#ffffff` | `#ede9fe` | `rgba(255,255,255,0.92)` | `rgba(255,255,255,0.5)` | `#1e293b` | `#475569` | `#ffffff` | `#8c52ff` | Life360 |
| 5 | **Rosa** | `#ff4d94` | `#ffffff` | `#fce7f3` | `rgba(255,255,255,0.92)` | `rgba(255,255,255,0.5)` | `#1e293b` | `#475569` | `#ffffff` | `#ff4d94` | — |
| 6 | **Amarelo** | `#ffc700` | `#1a1a1a` | `#78716c` | `rgba(255,255,255,0.93)` | `rgba(255,255,255,0.7)` | `#1a1a1a` | `#57534e` | `#1a1a1a` | `#ffc700` | Will Bank |
| 7 | **Verde** | `#21c25e` | `#ffffff` | `#dcfce7` | `rgba(255,255,255,0.92)` | `rgba(255,255,255,0.5)` | `#1e293b` | `#475569` | `#ffffff` | `#21c25e` | PicPay |
| 8 | **Vermelho** | `#c8102e` | `#ffffff` | `#fee2e2` | `rgba(255,255,255,0.92)` | `rgba(255,255,255,0.5)` | `#1e293b` | `#475569` | `#ffffff` | `#c8102e` | Flamengo |

> **Amarelo** tem regras especiais: texto escuro (`#1a1a1a`), card texto escuro (`#1a1a1a` / `#57534e`), botão preto — tudo para manter contraste WCAG AA.

### Card de Saldo — Gradiente por Tema

O card de saldo usa gradiente específico por tema (tom mais escuro da cor base):

| # | Tema | `--balance-from` | `--balance-to` | `--balance-text` | `--balance-mini-bg` |
|---|---|---|---|---|---|
| 1 | **Gelo** | `#4f75ff` | `#375ee3` | `#ffffff` | `rgba(255,255,255,0.15)` |
| 2 | **HBO** | `#1e293b` | `#0f172a` | `#ffffff` | `rgba(255,255,255,0.08)` |
| 3 | **Azul** | `#0a5cc4` | `#084da8` | `#ffffff` | `rgba(255,255,255,0.18)` |
| 4 | **Roxo** | `#7040d4` | `#5a2ebf` | `#ffffff` | `rgba(255,255,255,0.18)` |
| 5 | **Rosa** | `#d4407d` | `#b83568` | `#ffffff` | `rgba(255,255,255,0.18)` |
| 6 | **Amarelo** | `#b8930a` | `#9a7b08` | `#ffffff` | `rgba(255,255,255,0.22)` |
| 7 | **Verde** | `#178a42` | `#126b34` | `#ffffff` | `rgba(255,255,255,0.18)` |
| 8 | **Vermelho** | `#a00d24` | `#8b0a1e` | `#ffffff` | `rgba(255,255,255,0.18)` |

### Input nos Temas Imersivos

Nos temas imersivos os inputs ficam dentro dos cards opacos, então usam fundo claro:

| Elemento | Temas (Azul–Vermelho exceto Amarelo) | Tema Amarelo |
|---|---|---|
| **Input bg** | `#f8fafc` | `#fffcf0` |
| **Input border** | `#e2e8f0` | `#e2e8f0` |
| **Input border focus** | cor do tema (ex: `#1075e8`) | `#b8930a` |
| **Input text** | `#1e293b` (escuro, dentro do card) | `#1a1a1a` |
| **Placeholder** | `rgba(0, 0, 0, 0.4)` | `rgba(0, 0, 0, 0.4)` |

---

### Implementação CSS Variables

```css
:root {
  /* Padrão Gelo (Default) */
  --bg-page: #f4f7fb;
  --text-main: #1e293b;
  --text-sec: #475569;
  --card-bg: rgba(255, 255, 255, 0.7);
  --card-border: rgba(255, 255, 255, 1);
  --card-text: #1e293b;
  --card-text-sec: #475569;
  --btn-bg: #2563eb;
  --btn-text: #ffffff;
  --input-bg: #f8fafc;
  --input-border: #f1f5f9;
  --input-focus: #3b82f6;
  --balance-from: #4f75ff;
  --balance-to: #375ee3;
  --balance-text: #ffffff;
  --balance-mini-bg: rgba(255,255,255,0.15);
  --overlay-bg: rgba(15, 23, 42, 0.4);
}
```

### Troca de Tema via JS

```javascript
const themes = {
  padrao: {
    bg:'#f4f7fb', text:'#1e293b', sec:'#475569',
    glass:'rgba(255,255,255,0.7)', border:'rgba(255,255,255,1)',
    cardText:'#1e293b', cardTextSec:'#475569',
    btnBg:'#2563eb', btnText:'#ffffff',
    inputBg:'#f8fafc', inputBorder:'#f1f5f9', inputFocus:'#3b82f6',
    balFrom:'#4f75ff', balTo:'#375ee3', balText:'#fff', balMiniBg:'rgba(255,255,255,0.15)'
  },
  hbo: {
    bg:'#000000', text:'#ffffff', sec:'#94a3b8',
    glass:'rgba(15,20,25,0.95)', border:'rgba(255,255,255,0.1)',
    cardText:'#e2e8f0', cardTextSec:'#94a3b8',
    btnBg:'#ffffff', btnText:'#000000',
    inputBg:'rgba(255,255,255,0.08)', inputBorder:'rgba(255,255,255,0.15)', inputFocus:'#ffffff',
    balFrom:'#1e293b', balTo:'#0f172a', balText:'#fff', balMiniBg:'rgba(255,255,255,0.08)'
  },
  azul: {
    bg:'#1075e8', text:'#ffffff', sec:'#dbeafe',
    glass:'rgba(255,255,255,0.92)', border:'rgba(255,255,255,0.5)',
    cardText:'#1e293b', cardTextSec:'#475569',
    btnBg:'#ffffff', btnText:'#1075e8',
    inputBg:'#f8fafc', inputBorder:'#e2e8f0', inputFocus:'#1075e8',
    balFrom:'#0a5cc4', balTo:'#084da8', balText:'#fff', balMiniBg:'rgba(255,255,255,0.18)'
  },
  roxo: {
    bg:'#8c52ff', text:'#ffffff', sec:'#ede9fe',
    glass:'rgba(255,255,255,0.92)', border:'rgba(255,255,255,0.5)',
    cardText:'#1e293b', cardTextSec:'#475569',
    btnBg:'#ffffff', btnText:'#8c52ff',
    inputBg:'#f8fafc', inputBorder:'#e2e8f0', inputFocus:'#8c52ff',
    balFrom:'#7040d4', balTo:'#5a2ebf', balText:'#fff', balMiniBg:'rgba(255,255,255,0.18)'
  },
  rosa: {
    bg:'#ff4d94', text:'#ffffff', sec:'#fce7f3',
    glass:'rgba(255,255,255,0.92)', border:'rgba(255,255,255,0.5)',
    cardText:'#1e293b', cardTextSec:'#475569',
    btnBg:'#ffffff', btnText:'#ff4d94',
    inputBg:'#f8fafc', inputBorder:'#e2e8f0', inputFocus:'#ff4d94',
    balFrom:'#d4407d', balTo:'#b83568', balText:'#fff', balMiniBg:'rgba(255,255,255,0.18)'
  },
  amarelo: {
    bg:'#ffc700', text:'#1a1a1a', sec:'#78716c',
    glass:'rgba(255,255,255,0.93)', border:'rgba(255,255,255,0.7)',
    cardText:'#1a1a1a', cardTextSec:'#57534e',
    btnBg:'#1a1a1a', btnText:'#ffc700',
    inputBg:'#fffcf0', inputBorder:'#e2e8f0', inputFocus:'#b8930a',
    balFrom:'#b8930a', balTo:'#9a7b08', balText:'#fff', balMiniBg:'rgba(255,255,255,0.22)'
  },
  verde: {
    bg:'#21c25e', text:'#ffffff', sec:'#dcfce7',
    glass:'rgba(255,255,255,0.92)', border:'rgba(255,255,255,0.5)',
    cardText:'#1e293b', cardTextSec:'#475569',
    btnBg:'#ffffff', btnText:'#21c25e',
    inputBg:'#f8fafc', inputBorder:'#e2e8f0', inputFocus:'#21c25e',
    balFrom:'#178a42', balTo:'#126b34', balText:'#fff', balMiniBg:'rgba(255,255,255,0.18)'
  },
  vermelho: {
    bg:'#c8102e', text:'#ffffff', sec:'#fee2e2',
    glass:'rgba(255,255,255,0.92)', border:'rgba(255,255,255,0.5)',
    cardText:'#1e293b', cardTextSec:'#475569',
    btnBg:'#ffffff', btnText:'#c8102e',
    inputBg:'#f8fafc', inputBorder:'#e2e8f0', inputFocus:'#c8102e',
    balFrom:'#a00d24', balTo:'#8b0a1e', balText:'#fff', balMiniBg:'rgba(255,255,255,0.18)'
  }
};

function applyTheme(name) {
  const t = themes[name];
  if (!t) return;
  const r = document.documentElement.style;
  r.setProperty('--bg-page', t.bg);
  r.setProperty('--text-main', t.text);
  r.setProperty('--text-sec', t.sec);
  r.setProperty('--card-bg', t.glass);
  r.setProperty('--card-border', t.border);
  r.setProperty('--card-text', t.cardText);
  r.setProperty('--card-text-sec', t.cardTextSec);
  r.setProperty('--btn-bg', t.btnBg);
  r.setProperty('--btn-text', t.btnText);
  r.setProperty('--input-bg', t.inputBg);
  r.setProperty('--input-border', t.inputBorder);
  r.setProperty('--input-focus', t.inputFocus);
  r.setProperty('--balance-from', t.balFrom);
  r.setProperty('--balance-to', t.balTo);
  r.setProperty('--balance-text', t.balText);
  r.setProperty('--balance-mini-bg', t.balMiniBg);
  localStorage.setItem('bud_theme', name);
}

// Carregar tema salvo
const saved = localStorage.getItem('bud_theme');
if (saved && themes[saved]) applyTheme(saved);
```

### Persistência do Tema
```javascript
// Salva em localStorage
localStorage.setItem('bud_theme', 'roxo');

// Carrega na inicialização (antes de renderizar)
const saved = localStorage.getItem('bud_theme') || 'padrao';
applyTheme(saved);
```

---

## 🎭 Gradientes

### Gradiente Card de Saldo (Adaptativo por Tema)
```css
background: linear-gradient(to right, var(--balance-from), var(--balance-to));
color: var(--balance-text);
```
- Cada tema define seu próprio gradiente via `--balance-from` e `--balance-to`
- No Gelo: azul `#4f75ff → #375ee3`; no Verde: `#178a42 → #126b34`; etc.

### Gradiente Banner Premium / Dark Panels
```css
background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0c4a6e 100%);
```

### Gradiente Splash Screen (Fundo)
```css
background: linear-gradient(145deg, #0b1120 0%, #162036 45%, #0f172a 100%);
```

### Gradiente Logo Splash (Texto)
```css
background: linear-gradient(135deg, #60a5fa 0%, #818cf8 50%, #a78bfa 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

### Gradiente Shimmer (Botão Premium)
```css
background: linear-gradient(90deg, #38bdf8 0%, #818cf8 50%, #38bdf8 100%);
background-size: 200%;
animation: shimmer 3s linear infinite;
```

### Gradiente Barra de Progresso (Orçamento)
```css
background: linear-gradient(90deg, #10b981, #059669);
```

### Efeito Radial (Decorativo nos Banners)
```css
background:
  radial-gradient(ellipse at 100% 0%, rgba(99,102,241,0.3) 0%, transparent 60%),
  radial-gradient(ellipse at 0% 100%, rgba(56,189,248,0.2) 0%, transparent 60%);
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

As superfícies de vidro se adaptam ao tema ativo via CSS variables.

### `.glass-card`
```css
.glass-card {
  background: var(--card-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--card-border);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
}
```
- No tema Gelo: vidro branco semi-transparente (`rgba(255,255,255,0.7)`)
- Nos temas imersivos: vidro branco quase opaco (`rgba(255,255,255,0.92)`) — cria contraste com fundo colorido
- No tema HBO: vidro escuro, quase opaco (`rgba(15,20,25,0.95)`)
- Texto dentro dos cards usa `var(--card-text)` e `var(--card-text-sec)` (separado do texto de página)

### `.glass-panel`
```css
.glass-panel {
  background: var(--card-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-right: 1px solid var(--card-border);
}
```
- Usado em header e sidebar

---

## 🌌 Efeito Blob (Fundo Decorativo)

Presente nas páginas de auth e internas. **Visível apenas nos temas Gelo e HBO** (oculto nos imersivos, pois o fundo sólido já domina).

```html
<!-- Canto superior esquerdo (azul) -->
<div class="blob-deco absolute top-0 left-0 w-[40%] h-[40%] bg-blue-300/40 rounded-full blur-[100px] pointer-events-none z-0"></div>

<!-- Canto inferior direito (ciano) -->
<div class="blob-deco absolute bottom-0 right-0 w-[30%] h-[30%] bg-cyan-300/30 rounded-full blur-[100px] pointer-events-none z-0"></div>
```

```javascript
// Ocultar blobs nos temas imersivos
function updateBlobs(themeName) {
  const blobs = document.querySelectorAll('.blob-deco');
  const show = (themeName === 'padrao' || themeName === 'hbo');
  blobs.forEach(b => b.style.display = show ? '' : 'none');
}
```

---

## 😊 Ícones 3D (Emojis)

### Classe `.icon-3d`
```css
.icon-3d {
  filter:
    drop-shadow(0px 1px 1px rgba(0,0,0,0.05))
    drop-shadow(0px 3px 4px rgba(0,0,0,0.13))
    drop-shadow(0px 6px 10px rgba(0,0,0,0.07));
  display: inline-block;
  transform: translateZ(0);
}
```

### Classe `.icon-3d-lg` (versão grande)
```css
.icon-3d-lg {
  filter:
    drop-shadow(0px 2px 2px rgba(0,0,0,0.06))
    drop-shadow(0px 5px 8px rgba(0,0,0,0.14))
    drop-shadow(0px 10px 16px rgba(0,0,0,0.06));
  display: inline-block;
  transform: translateZ(0);
}
```

---

## 🎬 Animações

### 1. Shimmer (Botão Premium)
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```
- Duração: 3s, linear, infinite

### 2. Slide Up (Modais, Bottom Sheets)
```css
@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
```
- Duração: 0.3s, ease-out

### 3. Splash Glow
```css
@keyframes splGlow {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.25); opacity: 1; }
}
```
- Duração: 3s, ease-in-out, infinite

### 4. Splash Spin (Spinner)
```css
@keyframes splSpin {
  to { transform: rotate(360deg); }
}
```
- Duração: 0.85s, linear, infinite

### 5. Splash Pulse (Anel pulsante)
```css
@keyframes splPulse {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.45); opacity: 0; }
}
```
- Duração: 2s, ease-in-out, infinite

### 6. Accordion Panel
```css
.card-panel {
  transition: max-height 0.3s ease-in-out, padding 0.3s ease-in-out;
  max-height: 0;
  overflow: hidden;
}
.card-panel.open { max-height: 600px; }
```

### 7. Hover Effects

| Trigger | Efeito | Duração | Uso |
|---|---|---|---|
| `hover:scale-105` | Cresce 5% | 150ms | Avatar, badges |
| `hover:-translate-y-1` | Sobe 4px | default | Cards |
| `hover:shadow-md` | Sombra mais forte | default | Cards ao passar mouse |
| `transition-colors` | Fade de cor | 150ms | Links, botões |
| `transition-all` | Todas propriedades | 300ms | Modais, painéis |

### 8. Transições de Entrada/Saída

| Componente | Entrada | Saída | Duração |
|---|---|---|---|
| **Toast** | opacity 0→1 + translateX(20px→0) | Reverso | 0.35s ease |
| **Splash Screen** | opacity 1, scale 1 (padrão) | opacity 0 + scale(1.04) | 0.65s cubic-bezier(.4,0,.2,1) |
| **Modal Overlay** | opacity 0→1 | Reverso | 0.2s |
| **Troca de Tema** | background-color transition | — | 0.15s ease-in-out |

---

## 🎯 Componentes UI

### Botão Primário
```css
.btn-primary {
  background: var(--btn-bg);
  color: var(--btn-text);
  font-weight: 800;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  transition: all 0.15s;
  width: 100%;
}
```

### Card de Saldo
```css
/* Mantém gradiente próprio, não segue tema */
background: linear-gradient(to right, #4f75ff, #375ee3);
border-radius: 1.5rem;
color: #ffffff;
```

### Input/Select
```css
.input-field {
  background: var(--input-bg);
  border: 2px solid var(--input-border);
  border-radius: 0.75rem;
  padding: 0.625rem 1rem;
  color: var(--text-main);
  transition: border-color 0.15s, background-color 0.15s;
}
.input-field:focus {
  border-color: var(--input-focus);
  outline: none;
}
```

### Modal Overlay
```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  z-index: 9998;
}
.modal-card {
  background: var(--card-bg);
  backdrop-filter: blur(24px);
  border: 1px solid var(--card-border);
  border-radius: 1.5rem;
  padding: 1.5rem;
  max-width: 24rem;
  width: 100%;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}
```

---

## 📐 Z-Index Scale

| Camada | Z-Index | Uso |
|---|---|---|
| Background | 0 | Conteúdo normal, blobs |
| Sidebar | 40 | Navegação |
| Dropdown | 50 | Menus flutuantes |
| Modal overlay | 9998 | Fundo do modal |
| Modal card | 9999 | Conteúdo do modal |
| FAB | 10000 | Botão flutuante |
| Toast | 10001 | Notificações |

---

## 📱 Responsive Design

### Breakpoints (Tailwind padrão)
```
sm: 640px   — small phones
md: 768px   — tablets em portrait
lg: 1024px  — tablets landscape / desktops pequenos
xl: 1280px  — desktops
2xl: 1536px — desktops grandes
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

---

## 🖼️ Splash Screen

Injetado via JavaScript (`bud-loader.js`), no `<head>`.

- **ID**: `#bud-splash`
- **Conteúdo**: Halo decorativo + logo texto com gradiente + subtítulo + spinner
- **Mínimo**: 700ms | **Máximo**: 6000ms
- **1x por sessão** (usa `sessionStorage`)
- **Não aparece em**: login, cadastro, recuperar senha, onboarding

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

---

## 📊 Cores por Categoria (Gráficos)

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

> Estas cores **não mudam** entre temas. São fixas para consistência nos gráficos.

---

## 🧮 Responsive Font Size (Valores monetários)

```css
font-size: clamp(0.7rem, 2.8vw, 1.5rem);
```
- Mínimo: 0.7rem (11px) | Preferido: 2.8vw | Máximo: 1.5rem (24px)

---

## 🔗 Referências de Implementação

### Injetar estilos CSS globais
```javascript
const style = document.createElement('style');
style.textContent = `/* CSS aqui */`;
document.head.appendChild(style);
```

### Viewport units (mobile)
```css
height: 100dvh; /* Dynamic viewport height */
height: 100vh;  /* Fallback */
```

### Escaper HTML (XSS)
```javascript
window.escapeHTML = (str) => String(str || '').replace(/[&<>'"]/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[m]);
```

---

## ✅ Checklist de Correção Pendente

### 🟡 PRIORIDADE ALTA
- [ ] Criar `budCreateOverlay()` e `budCreateModalCard()` em bud-utils.js (usar `style` inline, nunca Tailwind dinâmico)
- [ ] Padronizar cor de overlays via `var(--overlay-bg)`
- [ ] Criar aliases `BudPlanos` → `NexoPlanos`

### 🟢 PRIORIDADE BAIXA
- [ ] Usar CSS custom properties para dark mode em modais
- [ ] Limpeza de classes z-index espalhadas no HTML (seguir tabela de Z-Index Scale)

---

## 📝 Notas Finais

- **Tailwind é build estático**: Não usar classes dinâmicas geradas em JS. Usar `style` inline para elementos criados dinamicamente.
- **Temas usam CSS variables**: Toda cor dinâmica deve referenciar `var(--nome)`, nunca valor hardcoded.
- **Animações suaves**: Evitar transições < 0.15s ou > 1s sem motivo.
- **Mobile-first sempre**: Estilo mobile base, override com `md:`, `lg:`.
- **Acessibilidade**: Contraste mínimo WCAG AA (4.5:1 texto pequeno, 3:1 grande).
- **Performance**: `will-change` e `transform: translateZ(0)` para animações GPU.

---

**Gerado em**: 15 de abril de 2026  
**Projeto**: Bud Finance v2.0

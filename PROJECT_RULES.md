# PROJECT_RULES.md — Regras Invioláveis do Projeto

**Projeto**: Bud Finance  
**Última atualização**: 15/04/2026

---

## 1. Stack e Versões Exatas

| Tecnologia | Versão | Observação |
|---|---|---|
| **HTML5** | — | Páginas estáticas (.html) |
| **Tailwind CSS** | Build estático (compilado) | Arquivo `tailwind.css` pré-compilado |
| **JavaScript** | ES6+ (Vanilla) | Sem frameworks (React, Vue, Angular) |
| **Firebase** | 10.8.1 | App, Auth, Firestore |
| **Google Fonts** | Inter | Fonte principal |
| **EmailJS** | — | Envio de emails (chamados, signup) |
| **Node.js** | — | Cloud Functions (backend) |

---

## 2. Estrutura de Pastas Obrigatória

```
/
├── index.html                  (Login)
├── cadastro.html               (Sign-up)
├── recuperar-senha.html        (Solicitar reset)
├── acao-auth.html              (Processar reset via link)
├── trocar-senha.html           (Primeiro login — troca senha)
├── dashboard.html              (App principal)
├── politica-privacidade.html   (LGPD)
├── admin.html                  (Painel admin)
├── css/
│   └── tailwind.css            (Build estático Tailwind)
├── js/
│   ├── index.js                (Lógica do login)
│   ├── cadastro.js             (Lógica do cadastro)
│   ├── recuperar-senha.js      (Lógica de recuperação)
│   ├── acao-auth.js            (Lógica do reset)
│   ├── trocar-senha.js         (Lógica da troca de senha)
│   ├── firebase-config.js      (Config Firebase — window.BUD_FIREBASE_CONFIG)
│   ├── bud-utils.js            (Toasts, helpers globais)
│   └── dark-mode.js            (Toggle dark mode)
├── .github/
│   └── copilot-instructions.md
├── PROJECT_RULES.md
├── ARCHITECTURE_MAP.md
├── DECISIONS_LOG.md
├── ERRORS_LOG.md
└── ROADMAP.md
```

---

## 3. Convenções de Código

### Idioma
- **Código** (variáveis, funções, comentários técnicos): **Inglês**
- **Textos de UI** (labels, toasts, placeholders): **Português (BR)**
- **Documentação** (docs de governança): **Português (BR)**

### Naming
- **IDs de HTML**: camelCase (`btnLogin`, `identificador`, `novaSenha`)
- **Classes CSS**: Tailwind utility-first
- **Variáveis JS**: camelCase (`userData`, `firebaseConfig`)
- **Funções JS**: camelCase (`buscarEmailPorMatricula`, `gerarCodigoUnico`)
- **Constantes**: UPPER_SNAKE_CASE (`EMAILJS_SERVICE_ID`, `APP_URL`)
- **Arquivos**: kebab-case (`firebase-config.js`, `bud-utils.js`)

### Patterns
- **Módulos JS**: ES Modules (`import/export`) via CDN do Firebase
- **Autenticação**: Firebase Auth (email/password)
- **Banco de dados**: Firestore (collection `usuarios`)
- **Toasts**: Função global `window.budShowToast(msg, tipo)`
- **Config Firebase**: Exposta via `window.BUD_FIREBASE_CONFIG`

---

## 4. Regras de UI/UX

### Paleta de Cores

| Uso | Cor | Classe Tailwind |
|---|---|---|
| **Background body** | `#f0f4f8` | `bg-[#f0f4f8]` |
| **Card glass** | `rgba(255,255,255,0.9)` | `bg-white/90` |
| **Primário** | `#2563eb` | `text-blue-600`, `bg-blue-600` |
| **Primário hover** | `#1d4ed8` | `hover:bg-blue-700` |
| **Texto principal** | `#1e293b` | `text-slate-800` |
| **Texto secundário** | `#64748b` | `text-slate-500` |
| **Input bg** | `#f8fafc` | `bg-slate-50` |
| **Input border** | `#f1f5f9` | `border-slate-100` |
| **Input border focus** | `#3b82f6` | `focus:border-blue-500` |
| **Blob azul** | `bg-blue-300/40` | — |
| **Blob ciano** | `bg-cyan-300/30` | — |
| **Dark bg** | `#0f172a` | — |

### Bordas e Arredondamento
- **Card**: `rounded-[2rem]` (32px)
- **Inputs**: `rounded-xl` (12px)
- **Botões**: `rounded-xl` (12px)
- **Logo icon**: `rounded-xl`
- **Inputs border**: `border-2`

### Espaçamento
- **Card padding**: `p-6` mobile / `md:p-8` desktop
- **Card margem horizontal**: `mx-4` mobile
- **Input padding**: `px-4 py-2.5`
- **Botão padding**: `py-3`
- **Gap entre seções**: `mt-4`, `mb-1.5`

### Responsividade
- **Breakpoint principal**: `md:` (768px)
- **Card**: `w-full max-w-sm` (100% até 384px)
- **Min-height**: `100vh` + `100dvh` (dynamic viewport)
- **Testar em**: iPhone SE (375px), iPhone 12 (390px), iPad (768px), Desktop (1280px+)

### Glassmorphism
- `backdrop-blur-xl` no card
- `bg-white/90` (semi-transparente)
- `shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]`
- `border border-white`

---

## 5. Proibições Explícitas (NUNCA fazer)

1. **NUNCA usar classes Tailwind dinâmicas em JS** — O build é estático; classes como `z-[9999]`, `bg-black/40` criadas via `innerHTML` ou `createElement` não existem no CSS compilado. Usar `style` inline.
2. **NUNCA expor dados sensíveis** — Erros de login devem ser genéricos ("credenciais inválidas"), nunca revelar se email existe ou não.
3. **NUNCA usar frameworks JS** — Projeto é 100% Vanilla JS com ES Modules.
4. **NUNCA salvar senha em localStorage/sessionStorage** — Firebase Auth gerencia sessão automaticamente.
5. **NUNCA criar componente/helper sem consultar ARCHITECTURE_MAP.md** — Pode já existir algo similar.
6. **NUNCA implementar feature do backlog sem pedido explícito** — Consultar ROADMAP.md.
7. **NUNCA ignorar o ERRORS_LOG.md** — Antes de debugar, verificar se o bug já foi resolvido.
8. **NUNCA refatorar padrão sem ler DECISIONS_LOG.md** — Decisões passadas devem ser respeitadas.
9. **NUNCA usar `type="email"` no campo de identificação do login** — Aceita matrícula (texto).
10. **NUNCA remover `rel="noopener noreferrer"` de links `target="_blank"`** — Segurança obrigatória.

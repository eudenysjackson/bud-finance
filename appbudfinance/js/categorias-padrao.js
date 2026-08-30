/**
 * categorias-padrao.js — Fonte Única de Verdade das Categorias
 * Bud Finance · Carregado como <script> regular (não-módulo)
 *
 * Expõe window.BUD_CATEGORIAS_PADRAO para uso em todas as telas.
 * Todas as telas que exibem dropdowns de categoria devem:
 *   1. Incluir este arquivo ANTES do módulo JS da tela
 *   2. Ler: const categoriasPadrao = window.BUD_CATEGORIAS_PADRAO;
 *
 * NUNCA editar os nomes sem revisar as transações existentes no Firestore
 * (o campo categoria é salvo como string — renomear aqui não migra dados).
 */

(function () {
  'use strict';

  window.BUD_CATEGORIAS_PADRAO = {

    /* ── Despesas (52 categorias) ─────────────────────────────────────── */
    despesa: [
      // Moradia
      { nome: 'Aluguel',              emoji: '🏠' },
      { nome: 'Condomínio',           emoji: '🏢' },
      { nome: 'Água',                 emoji: '💧' },
      { nome: 'Luz',                  emoji: '⚡' },
      { nome: 'Gás',                  emoji: '🔥' },
      { nome: 'Internet/TV',          emoji: '🌐' },
      { nome: 'Manutenção da Casa',   emoji: '🛠️' },
      { nome: 'Diarista/Limpeza',     emoji: '🧹' },
      // Alimentação
      { nome: 'Mercado',              emoji: '🛒' },
      { nome: 'Delivery/Ifood',       emoji: '🛵' },
      { nome: 'Restaurante',          emoji: '🍽️' },
      { nome: 'Padaria/Café',         emoji: '☕' },
      // Transporte
      { nome: 'Combustível',          emoji: '⛽' },
      { nome: 'Uber/Táxi',            emoji: '🚕' },
      { nome: 'Ônibus/Metrô',         emoji: '🚌' },
      { nome: 'Estacionamento',       emoji: '🅿️' },
      { nome: 'Manutenção Veículo',   emoji: '🔧' },
      { nome: 'IPVA/Seguro',          emoji: '📄' },
      { nome: 'Pedágio',              emoji: '🛣️' },
      // Saúde
      { nome: 'Plano de Saúde',       emoji: '🏥' },
      { nome: 'Farmácia',             emoji: '💊' },
      { nome: 'Consultas/Exames',     emoji: '🩺' },
      { nome: 'Terapia/Psicólogo',    emoji: '🛋️' },
      { nome: 'Dentista',             emoji: '🦷' },
      // Educação
      { nome: 'Faculdade/Escola',     emoji: '🏫' },
      { nome: 'Cursos',               emoji: '📚' },
      { nome: 'Material Escolar',     emoji: '✏️' },
      // Lazer
      { nome: 'Cinema/Teatro',        emoji: '🎬' },
      { nome: 'Shows/Eventos',        emoji: '🎟️' },
      { nome: 'Viagens',              emoji: '✈️' },
      { nome: 'Bares/Baladas',        emoji: '🍻' },
      { nome: 'Hobbies',              emoji: '🎨' },
      { nome: 'Jogos/Games',          emoji: '🎮' },
      { nome: 'Academia/Esportes',    emoji: '🏋️' },
      { nome: 'Assinaturas/Streaming',emoji: '📺' },
      // Pessoal
      { nome: 'Roupas/Sapatos',       emoji: '👕' },
      { nome: 'Acessórios',           emoji: '⌚' },
      { nome: 'Salão/Barbearia',      emoji: '✂️' },
      { nome: 'Cosméticos',           emoji: '🧴' },
      { nome: 'Presentes',            emoji: '🎁' },
      { nome: 'Pet',                  emoji: '🐶' },
      // Casa
      { nome: 'Eletrônicos',          emoji: '💻' },
      { nome: 'Casa/Móveis',          emoji: '🛏️' },
      { nome: 'Compras Online',       emoji: '🛍️' },
      // Financeiro
      { nome: 'Impostos/IRPF',        emoji: '🏛️' },
      { nome: 'Taxas Bancárias',      emoji: '💸' },
      { nome: 'Pix no Crédito',       emoji: '⚡' },
      { nome: 'Pagamento de Fatura',  emoji: '💳' },
      { nome: 'Empréstimos/Dívidas',  emoji: '📉' },
      { nome: 'Seguro de Vida',       emoji: '🛡️' },
      { nome: 'Doações/Dízimo',       emoji: '🤝' },
      // Outros
      { nome: 'Outros',               emoji: '📦' },
    ],

    /* ── Receitas (15 categorias) ────────────────────────────────────── */
    receita: [
      { nome: 'Salário',                     emoji: '💰' },
      { nome: 'Férias',                      emoji: '🏖️' },
      { nome: '13º Salário',                 emoji: '🎄' },
      { nome: 'Bônus/PLR',                   emoji: '🎁' },
      { nome: 'Vale Refeição/Alimentação',   emoji: '💳' },
      { nome: 'Freelance/Projetos',          emoji: '💻' },
      { nome: 'Rendimentos/Dividendos',      emoji: '📈' },
      { nome: 'Venda de Produtos',           emoji: '🛍️' },
      { nome: 'Venda de Imóvel/Carro',       emoji: '🚘' },
      { nome: 'Cashback',                    emoji: '🔄' },
      { nome: 'Restituição IR',              emoji: '🏛️' },
      { nome: 'Pensões',                     emoji: '👶' },
      { nome: 'Aluguéis Recebidos',          emoji: '🏠' },
      { nome: 'Doações Recebidas',           emoji: '🧧' },
      { nome: 'Outras Receitas',             emoji: '📦' },
    ],

  };

})();

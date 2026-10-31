# Publicação e notificações —31/10/2026

O titular autorizou publicar backend, site e regras/índices, depois de corrigir os avisos antigos. A versão revisada preserva os três commits da branch anterior.

- Regras e índices publicados no projeto bud-finance. Índices expiresAt das leituras e fragmentos confirmados READY; bytes não indexados.
- Código principal063abd1 publicado no Render com sucesso. Correção de build d39136c publicada no Pages com workflow#10 aprovado, incluindo61regressões. Build antigo usava sed e quebrava com newline nas variáveis; geração agora usa JSON e normalização, sem registrar valores.
- Pages passou de raiz da branch para GitHub Actions com pacote restrito. HTTPS ativado. Raiz, /budfinance/ e /appbudfinance/ retornam200; www redireciona para o domínio principal. CORS publicado permite DELETE e X-Bud-Async; checkout sem login401.
- Conta online do titular: sininho sem comunicados antigos e faixa de teste removida. Cache legado apagado pelo app; nenhum documento financeiro ou comunicado do servidor foi eliminado. Faixas somente para assinatura próxima (azul), vencida (vermelho) ou upgrade. Widgets proativos de prioridades, lembretes e dívidas em atraso também retirados da dashboard, mantendo consultas e lançamentos nas telas financeiras.
- Push: registro de celular/computador preservado, revogação individual, teste restrito à própria conta, TTL1h e regras financeiras sem Buddy/marketing. Pagamentos confirmados/faturas financiadas ou quitadas não são cobrados de novo. Payload recebido em primeiro plano usa aviso do sistema; listeners e URLs dos módulos unificados para evitar código antigo em cache.
- Titular informou que não recebeu o teste. Reenvio feito no botão do app online, com registro confirmado e resposta de envio bem-sucedida. Recebimento físico NÃO confirmado; continua pendente. Daily Push Notifications não foi reativado nem houve envio coletivo manual.
- Build identificou19alertas em dependências, incluindo2críticos/7altos. Atualizações compatíveis locais reduziram para9moderados, sem --force nem troca principal do Firebase Admin.61regressões,7grupos HTTP/emulador e4de recuperação passaram com o lock atualizado. Pendências moderadas exigem avaliar migração do SDK e dependências, sem presumir que todos os caminhos são exploráveis.

Permanecem: verificar publicação do último ajuste, confirmar entrega no dispositivo e ativação do agendamento, homologar entrega automática do webhook público do Mercado Pago com contas fictícias. Fatura longa medida em79,6s: cota externa pode impor espera; não há promessa de latência universal. Buddy/WhatsApp seguem fora da primeira versão.

Evidências locais não são incluídas no pacote público. Credenciais locais, emuladores, .tools e relatórios de navegador permanecem excluídos da publicação estática.

# Documentos fictícios para testes de IA

- `fatura.pdf`: duas compras (R$ 50 + R$ 25), total R$ 75.
- `cupom.png`: arroz (1 × R$ 10) e leite (2 × R$ 5), total R$ 20. Também exercita extração de transações a partir de imagem.
- `extrato.png`: Pix recebido de R$ 100, compra de R$ 25 e saldo de R$ 75.

Usados por `scripts/smoke-ia-local.js`, sem dados pessoais ou financeiros reais.
O teste chama a Groq e precisa da chave local, do backend e dos emuladores em execução.
Somente importa para revisão: não confirma nem salva transações no banco.

Executar na raiz: `node --env-file=backend/.env.local scripts/smoke-ia-local.js`.
Para repetir apenas um caso, passar seu nome, por exemplo: `"Fatura PDF"`.

- `escaneado.pdf`: cupom fictício incorporado como imagem; verifica caminho visual de PDF sem texto.
- `fatura-longa.pdf`: três páginas, 24 compras de R$ 1 a R$ 24, total R$ 300; verifica leitura em partes e espera automática da cota.

- `nubank-layout.pdf`: layout Nubank fictício, 24 compras e total R$300; testa leitura direta validada sem chamada externa.

- cupom-quatro-paginas.pdf: quatro produtos,10+20+30+40=100; regressão do corte na terceira página em Compras.
- contrato-seis-paginas.pdf: condições financeiras somente na sexta página; regressão do corte em Dívidas.
- contrato-escaneado.pdf e contrato-scan.png: contrato fictício rasterizado,1200/12x100; teste OCR local em Dívidas.

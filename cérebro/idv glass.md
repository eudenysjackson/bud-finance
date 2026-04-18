<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Orçamento - Efeito Glassmorphism</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            /* Fundo gradiente para destacar o efeito glass */
            background: linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%);
            margin: 0;
            padding: 40px 20px;
            color: #374151;
            min-height: 100vh;
        }
        
        .glass-panel {
            max-width: 800px;
            margin: 0 auto;
            border-radius: 24px;
            padding: 48px;
            
            /* Efeito Glassmorphism Principal */
            background: rgba(255, 255, 255, 0.4);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.6);
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
        }

        .company-info h1 {
            font-size: 24px;
            font-weight: 700;
            color: #1f2937;
            margin: 0 0 8px 0;
            text-shadow: 0 1px 2px rgba(255,255,255,0.8);
        }

        .company-info p {
            margin: 0;
            color: #4b5563;
            font-size: 14px;
        }

        .badge {
            background: rgba(209, 250, 229, 0.7);
            color: #059669;
            padding: 6px 16px;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 600;
            display: inline-block;
            border: 1px solid rgba(255, 255, 255, 0.5);
        }

        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 40px;
        }

        .info-box {
            /* Glassmorphism Secundário (Camada interna) */
            background: rgba(255, 255, 255, 0.5);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.8);
            padding: 20px;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .section-title {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #6b7280;
            font-weight: 600;
            margin-bottom: 8px;
            display: block;
        }

        .info-box h2 {
            font-size: 18px;
            margin: 0 0 4px 0;
            color: #1f2937;
        }

        .info-box p {
            margin: 0;
            color: #4b5563;
            font-size: 14px;
            line-height: 1.5;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 32px;
        }

        th {
            text-align: left;
            padding: 12px 8px;
            font-size: 12px;
            text-transform: uppercase;
            color: #4b5563;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
            font-weight: 600;
        }

        td {
            padding: 16px 8px;
            font-size: 15px;
            color: #374151;
            border-bottom: 1px solid rgba(255, 255, 255, 0.5);
        }

        td:last-child, th:last-child {
            text-align: right;
            font-weight: 500;
            color: #111827;
        }

        .totals-container {
            display: flex;
            justify-content: flex-end;
        }

        .totals {
            width: 350px;
            background: rgba(255, 255, 255, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            padding: 24px;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 14px;
            color: #4b5563;
        }

        .total-row span:last-child {
            color: #1f2937;
            font-weight: 500;
        }

        .total-row.final {
            font-size: 20px;
            font-weight: 700;
            color: #2563eb;
            border-top: 1px solid rgba(0, 0, 0, 0.1);
            padding-top: 16px;
            margin-top: 8px;
        }

        .total-row.final span:last-child {
            color: #2563eb;
            font-weight: 700;
        }

        .footer {
            margin-top: 48px;
            padding-top: 24px;
            border-top: 1px solid rgba(255, 255, 255, 0.5);
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }

        .footer-block p {
            margin: 4px 0;
            font-size: 13px;
            color: #4b5563;
        }
    </style>
</head>
<body>
    <div class="glass-panel">
        <div class="header">
            <div class="company-info">
                <h1>ORÇAMENTO</h1>
                <p>Na Ponta dos Pés - Espetáculo Dança Entretenimento</p>
                <p>CNPJ: 55.278.379/0001-98</p>
            </div>
            <div>
                <span class="badge">Parceria / Aniversário</span>
            </div>
        </div>

        <div class="info-grid">
            <div class="info-box">
                <span class="section-title">Para</span>
                <h2>denys jackson</h2>
                <p>eudenysjackson@gmail.com</p>
            </div>
            <div class="info-box">
                <span class="section-title">Detalhes do Evento</span>
                <p><strong>Data:</strong> 04/04/2026</p>
                <p><strong>Local:</strong> Rio de Janeiro, RJ</p>
                <p><strong>Descrição:</strong> Apresentação curta de até 5 músicas ou 30m</p>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Valor</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Cachê Artista</td>
                    <td>R$ 400,00</td>
                </tr>
                <tr>
                    <td>Cachê Bailarinos</td>
                    <td>R$ 300,00</td>
                </tr>
                <tr>
                    <td>Maquiagem</td>
                    <td>R$ 105,00</td>
                </tr>
                <tr>
                    <td>Lavanderia</td>
                    <td>R$ 35,00</td>
                </tr>
                <tr>
                    <td>Quilometragem</td>
                    <td>R$ 26,00</td>
                </tr>
                <tr>
                    <td>Serviços Extras</td>
                    <td>R$ 150,00</td>
                </tr>
            </tbody>
        </table>

        <div class="totals-container">
            <div class="totals">
                <div class="total-row">
                    <span>Subtotal</span>
                    <span>R$ 1.016,00</span>
                </div>
                <div class="total-row">
                    <span>Margem (15%)</span>
                    <span>R$ 152,40</span>
                </div>
                <div class="total-row">
                    <span>Impostos (5%)</span>
                    <span>R$ 58,42</span>
                </div>
                <div class="total-row final">
                    <span>Total</span>
                    <span>R$ 1.226,82</span>
                </div>
            </div>
        </div>

        <div class="footer">
            <div class="footer-block">
                <span class="section-title">Forma de Pagamento</span>
                <p>PIX / Transferência Bancária</p>
                <p><strong>Validade do orçamento:</strong> 17/04/2026</p>
            </div>
            <div class="footer-block" style="text-align: right;">
                <p><strong>Denys Jackson</strong></p>
                <p>(21) 96506-4725</p>
                <p>denysjackson@denysjackson.com.br</p>
                <p>www.denysjackson.com.br</p>
            </div>
        </div>
    </div>
</body>
</html>
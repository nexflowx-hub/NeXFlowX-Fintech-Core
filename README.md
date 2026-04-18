# 🏦 NeXFlowX Fintech Core (V2)

Este é o **Core Bank e Motor de Orquestração** da plataforma NeXFlowX. Construído em Node.js com TypeScript, atua como o sistema nervoso central para processamento de pagamentos, roteamento inteligente de gateways e liquidação de tesouraria.

## 🚀 Arquitetura e Funcionalidades

* **Motor de Tesouraria (Ledger):** Sistema de 3 pools de liquidez (`Incoming`, `Pending`, `Available`) protegido por transações ACID (Prisma).
* **Smart Routing SaaS:** Roteamento dinâmico de pagamentos Multi-Tenant suportando Stripe, SumUp, NowPayments (Cripto) e Mistic (PIX/MBWay).
* **Payouts Automatizados:** Motor de saques em USDT integrados e geração de tickets manuais para fluxo FIAT.
* **Cron de Liquidação:** Motor noturno (`node-cron`) para transição de estado de fundos baseado no D+X de cada provedor.

## 🛠️ Stack Tecnológica

* **Runtime:** Node.js + Express
* **Linguagem:** TypeScript
* **ORM:** Prisma
* **Base de Dados:** PostgreSQL
* **Infraestrutura:** Docker & Docker Compose

## 📦 Como Instalar e Correr (Ambiente Local/Dev)

1. Clone o repositório e instale as dependências:
   ```bash
   git clone [https://github.com/nexflowx-hub/NeXFlowX-Fintech-Core.git](https://github.com/nexflowx-hub/NeXFlowX-Fintech-Core.git)
   cd NeXFlowX-Fintech-Core
   npm install
Configure as Variáveis de Ambiente:
Crie um ficheiro .env na raiz (Ver secção Variáveis de Ambiente).

Inicialize a Base de Dados (Prisma):

Bash
npx prisma generate
npx prisma db push
Suba os contentores Docker:

Bash
docker-compose up -d --build
A API ficará disponível em http://localhost:8080/api/v1.

🔐 Variáveis de Ambiente Críticas (.env)
Fragmento do código
DATABASE_URL="postgresql://user:password@localhost:5432/nexflowx_v2"
JWT_SECRET="sua_chave_jwt_secreta"
SUPABASE_JWT_SECRET="chave_do_supabase_para_sso"
NEXFLOWX_MASTER_KEY="chave_hex_32_bytes_para_encriptacao_de_api_keys"

# Gateways Master
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET="whsec_..."
NOWPAYMENTS_API_KEY="xxx"
NOWPAYMENTS_EMAIL="xxx"
NOWPAYMENTS_PASSWORD="xxx"
⚙️ Scripts de Operação (/ops)
O diretório /ops contém scripts cirúrgicos para gestão da base de dados e tesouraria:

node ops/create_admin.js - Gera um utilizador administrador de emergência.

node ops/fix_treasury.js - Força a reconciliação e verificação de integridade do Ledger.

node ops/sync_headless_api.js - Sincroniza configurações de Gateways.

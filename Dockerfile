FROM node:20-slim

# Instalar dependências necessárias para o binário do Prisma
RUN apt-get update && apt-get install -y openssl

WORKDIR /app

# 1. Copiar os ficheiros de definição de pacotes
COPY package*.json ./

# 2. Copiar a pasta prisma ANTES do npm install (Crucial!)
COPY prisma ./prisma/

# 3. Instalar dependências (isto vai correr o 'prisma generate' automaticamente)
RUN npm install

# 4. Copiar o resto do código e compilar o TypeScript
COPY . .
RUN npm run build

EXPOSE 8080

CMD ["node", "dist/server.js"]

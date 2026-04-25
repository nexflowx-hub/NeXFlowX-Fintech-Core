const fs = require('fs');

const serverFile = 'src/server.ts';
if (fs.existsSync(serverFile)) {
    let code = fs.readFileSync(serverFile, 'utf8');

    // Adicionamos os novos domínios Atlas à lista de confiança
    const newOrigins = `const allowedOrigins = [
  'https://central.nexflowx.tech',
  'https://atlas.nexflowx.tech',
  'https://pay.nexflowx.tech',
  'https://api-core.nexflowx.tech',
  'https://api.atlasglobal.digital',
  'https://dashboard.atlasglobal.digital',
  'http://localhost:3000'
];`;

    code = code.replace(/const allowedOrigins = \[[\s\S]*?\];/, newOrigins);
    fs.writeFileSync(serverFile, code);
    console.log("✅ CORS atualizado com os domínios AtlasGlobal.");
} else {
    console.log("❌ Ficheiro src/server.ts não encontrado.");
}

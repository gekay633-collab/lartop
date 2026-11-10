import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Examina somente os arquivos públicos servidos a navegadores após next build.
// Nunca exibe o valor de segredos, nem consulta o ambiente de produção.
const diretorio = ".next/static";
assert.ok(existsSync(diretorio), "Execute next build antes da auditoria de bundle");

const padroes = [
  /DATABASE_URL/i,
  /DIRECT_DATABASE_URL/i,
  /JWT_ACCESS_SECRET/i,
  /JWT_REFRESH_SECRET/i,
  /REDIS_URL/i,
  /REDIS_PASSWORD/i,
  /CLOUDINARY_API_SECRET/i,
  /VAPID_PRIVATE_KEY/i,
  /RESEND_API_KEY/i,
  /postgres(?:ql)?:\/\/[^\s"']+/i,
  /redis(?:s)?:\/\/[^\s"']+/i,
];
let arquivos = 0;
function conferir(diretorioAtual) {
  for (const arquivo of readdirSync(diretorioAtual, { withFileTypes: true })) {
    const caminho = join(diretorioAtual, arquivo.name);
    if (arquivo.isDirectory()) {
      conferir(caminho);
    } else if (arquivo.isFile() && /\.(?:js|css|json|map)$/.test(arquivo.name)) {
      arquivos++;
      const conteudo = readFileSync(caminho, "utf8");
      for (const padrao of padroes) {
        assert.ok(!padrao.test(conteudo),
          `Possível exposição da configuração privada no bundle público: ${caminho} (${padrao.source})`);
      }
    }
  }
}
conferir(diretorio);
assert.ok(arquivos > 0, "Não foram encontrados assets públicos para testar");
console.log(`Bundle público: ${arquivos} arquivos verificados; nenhuma referência privada encontrada`);

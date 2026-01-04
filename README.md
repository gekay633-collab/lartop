🚀 Lartop - Conectando Maricá a Serviços de Qualidade
O Lartop é uma plataforma robusta de serviços, focada em conectar clientes a prestadores profissionais em Maricá. O sistema conta com um banco de dados relacional e processamento de imagens na nuvem.

🛠️ Stack Tecnológica
O projeto utiliza uma arquitetura moderna para garantir agilidade e baixo custo de manutenção:

Frontend: React.js com Vite e TypeScript.

Backend: Node.js (Express) para API REST.

Banco de Dados: PostgreSQL gerenciado via Neon.tech.

Imagens: Cloudinary para hospedagem de fotos de perfil e serviços.

Segurança: Criptografia de senhas com bcrypt e autenticação via banco.

📋 Funcionalidades do Sistema
Gestão de Usuários: Separação entre Clientes, Prestadores e Administradores.

Perfis Profissionais: Exibição de nicho, localização, preço base e biografia.

Sistema de Avaliações: Feedbacks em tempo real com cálculo automático de média (Rating) no banco de dados.

Ordens de Serviço: Fluxo completo desde o pedido até a conclusão com fotos de "antes e depois".

⚙️ Configuração Local
Para rodar o projeto na sua máquina (C:\Users\yagoc...\lartop):

Bash

# 1. Instale as dependências no servidor e no client
npm install

# 2. Configure o arquivo .env com suas chaves:
# DATABASE_URL= (Pegue no console do Neon)
# CLOUDINARY_URL= (Pegue no console do Cloudinary)

# 3. Inicie o backend
node server/index.js

# 4. Inicie o frontend
npm run dev
🌐 Estratégia de Deploy
Banco de Dados: Mantido no plano gratuito do Neon (0,5 GB de armazenamento).

Backend: Pode ser hospedado em plataformas como Render ou Railway.

Frontend: Hospedagem sugerida na Vercel ou Netlify.
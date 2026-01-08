const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const dns = require('dns'); 
const path = require('path');
const cloudinary = require('cloudinary').v2;

// --- CONFIGURAÇÃO DE AMBIENTE LARTOP ---
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Resolve problemas de rede em ambientes locais (Windows/Node 17+)
dns.setDefaultResultOrder('ipv4first');

const app = express();

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- CONFIGURAÇÃO CLOUDINARY ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

// --- BANCO DE DADOS (POSTGRESQL - NEON) ---
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000, 
    idleTimeoutMillis: 30000,
    max: 20 
});

// Teste de conexão LARTOP
db.connect()
  .then(client => {
    console.log('✅ LARTOP conectado com sucesso ao PostgreSQL (Neon)!');
    client.release();
  })
  .catch(err => {
    console.error('❌ Erro de conexão no banco LARTOP:', err.message);
  });

db.on('error', (err) => {
    console.error('❌ Erro inesperado no pool do banco:', err.message);
});

// --- NODEMAILER (CONFIGURAÇÃO OTIMIZADA PARA RENDER) ---
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 20000, // Aumentado para evitar Timeout no Render
    greetingTimeout: 20000,
    socketTimeout: 30000
});

transporter.verify((error) => {
    if (error) {
        console.log('❌ Erro no Nodemailer:', error.message);
    } else {
        console.log('📧 LARTOP pronto para enviar e-mails!');
    }
});

// --- ROTAS GERAIS ---
app.get('/', (req, res) => res.send("API LARTOP Online"));
app.get('/api/status', (req, res) => res.json({ status: "online", database: "connected" }));

// --- ROTAS DE USUÁRIOS E AUTENTICAÇÃO ---

app.get('/api/users/find-by-email', async (req, res) => {
    const email = req.query.email?.toString().trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email não fornecido." });
    try {
        const result = await db.query(
            "SELECT id, nome, email, tipo, is_admin FROM users WHERE LOWER(email) = $1", 
            [email]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });
        res.json(result.rows[0]);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
});

app.post('/api/register', async (req, res) => {
    const { nome, telefone, email, senha, tipo, cidade, nicho, valor_base } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(senha, 10);
        const userResult = await db.query(
            "INSERT INTO users (nome, telefone, email, senha, tipo, cidade) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id", 
            [nome, telefone, email, hashedPassword, tipo, cidade]
        );
        const userId = userResult.rows[0].id;
        if (tipo === 'prestador') {
            await db.query(
                "INSERT INTO professional_profiles (user_id, nicho, valor_base, rating, status) VALUES ($1, $2, $3, 5.0, 'pendente')", 
                [userId, nicho || 'domestica', valor_base || 0]
            );
        }
        res.status(201).json({ message: "Cadastro realizado com sucesso!" });
    } catch (e) { 
        console.error(e);
        res.status(400).json({ error: "E-mail ou Telefone já existem no sistema." }); 
    }
});

app.post('/api/login', async (req, res) => {
    const { email, senha } = req.body;
    const sql = `
        SELECT u.*, p.valor_base, p.nicho, p.foto_url as prof_foto, p.status, p.working_days, p.descricao
        FROM users u 
        LEFT JOIN professional_profiles p ON u.id = p.user_id 
        WHERE u.email = $1 OR u.telefone = $1
    `;
    try {
        const result = await db.query(sql, [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Usuário não encontrado." });
        const user = result.rows[0];
        const match = await bcrypt.compare(senha, user.senha);
        if (!match) return res.status(401).json({ error: "Senha incorreta." });
        delete user.senha; 
        res.json({ user });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "Erro interno no servidor." }); 
    }
});

// --- RECUPERAÇÃO DE SENHA ---

app.post('/api/forgot-password', async (req, res) => {
    const { identifier } = req.body;
    const cleanId = identifier?.toString().trim().toLowerCase();
    try {
        const userRes = await db.query("SELECT id, nome, email FROM users WHERE LOWER(email) = $1 OR telefone = $1", [cleanId]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });
        const user = userRes.rows[0];
        const resetCode = Math.floor(100000 + Math.random() * 900000);
        await db.query("DELETE FROM password_resets WHERE email = $1", [user.email]);
        await db.query("INSERT INTO password_resets (email, code, expires_at) VALUES ($1, $2, NOW() + interval '15 minutes')", [user.email, resetCode]);
        
        await transporter.sendMail({
            from: `"LARTOP Suporte" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: `${resetCode} é seu código LARTOP`,
            html: `<div style="text-align:center; font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #FF5A5F;">LARTOP</h2>
                    <p>Olá <b>${user.nome}</b>, use o código abaixo:</p>
                    <div style="background: #f4f4f4; padding: 15px; border-radius: 10px; display: inline-block; margin: 15px 0;">
                        <b style="font-size: 32px; letter-spacing: 5px; color: #333;">${resetCode}</b>
                    </div>
                    <p style="font-size: 12px; color: #777;">Expira em 15 min.</p>
                </div>`
        });
        res.json({ message: "Código enviado!" });
    } catch (e) { 
        console.error("Erro ao enviar email:", e.message);
        res.status(500).json({ error: "Falha ao enviar e-mail. Verifique sua conexão." }); 
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    try {
        const resetRes = await db.query(`SELECT * FROM password_resets WHERE email = $1 AND CAST(code AS TEXT) = CAST($2 AS TEXT) AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`, [email, code]);
        if (resetRes.rows.length === 0) return res.status(400).json({ error: "Código inválido ou expirado." });
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query("UPDATE users SET senha = $1 WHERE email = $2", [hashedPassword, email]);
        await db.query("DELETE FROM password_resets WHERE email = $1", [email]);
        res.json({ message: "Senha alterada!" });
    } catch (e) { res.status(500).json({ error: "Erro ao atualizar senha." }); }
});

// --- ADMIN E PRESTADORES ---

app.get('/api/admin/providers', async (req, res) => {
    const sql = `SELECT u.id, u.nome, u.email, u.telefone, u.cidade, p.nicho, p.status, p.rating 
                 FROM users u INNER JOIN professional_profiles p ON u.id = p.user_id 
                 WHERE u.tipo = 'prestador' ORDER BY u.nome ASC`;
    try {
        const result = await db.query(sql);
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: "Erro ao buscar prestadores." }); }
});

app.patch('/api/admin/providers/:id/status', async (req, res) => {
    try {
        await db.query("UPDATE professional_profiles SET status = $1 WHERE user_id = $2", [req.body.status, req.params.id]);
        res.json({ message: "Status atualizado!" });
    } catch (e) { res.status(500).json({ error: "Erro ao atualizar status." }); }
});

app.get('/api/providers', async (req, res) => {
    const { nicho, id } = req.query;
    let sql = "SELECT u.id, u.nome, u.cidade, u.telefone, u.foto_url as user_foto, p.valor_base, p.nicho, p.foto_url, p.rating, p.status, p.working_days, p.descricao FROM users u INNER JOIN professional_profiles p ON u.id = p.user_id WHERE u.tipo = 'prestador'";
    const params = [];
    if (id) { sql += " AND u.id = $1"; params.push(id); }
    else { sql += " AND p.status = 'ativo'"; if (nicho) { sql += " AND p.nicho = $1"; params.push(nicho); } }
    try {
        const result = await db.query(sql, params);
        res.json(result.rows || []);
    } catch (e) { res.status(500).json({ error: "Erro ao listar prestadores." }); }
});

app.get('/api/professional_profiles/:id', async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM professional_profiles WHERE user_id = $1", [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Perfil não encontrado." });
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: "Erro ao buscar perfil profissional." }); }
});

// --- ATUALIZAÇÃO DE PERFIL ---
const handleUpdateUser = async (req, res) => {
    const { nome, telefone, cidade, valor_base, nicho, foto_url, working_days, descricao } = req.body;
    const userId = req.params.id;
    try {
        const currentData = await db.query(
            "SELECT u.nome, u.telefone, u.cidade, u.foto_url, p.nicho, p.valor_base FROM users u LEFT JOIN professional_profiles p ON u.id = p.user_id WHERE u.id = $1",
            [userId]
        );
        if (currentData.rows.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });
        const existing = currentData.rows[0];
        const finalNome = nome || existing.nome;
        const finalTelefone = telefone || existing.telefone;
        const finalCidade = cidade || existing.cidade;
        const finalFoto = foto_url || existing.foto_url;

        await db.query("UPDATE users SET nome = $1, telefone = $2, cidade = $3, foto_url = $4 WHERE id = $5", 
            [finalNome, finalTelefone, finalCidade, finalFoto, userId]);
        
        const profCheck = await db.query("SELECT id FROM professional_profiles WHERE user_id = $1", [userId]);
        if (profCheck.rows.length > 0) {
            const finalNicho = nicho || existing.nicho || 'domestica';
            const finalValor = valor_base !== undefined ? (parseFloat(valor_base) || 0) : existing.valor_base;
            await db.query(
                "UPDATE professional_profiles SET valor_base = $1, nicho = $2, foto_url = $3, working_days = $4, descricao = $5 WHERE user_id = $6", 
                [finalValor, finalNicho, finalFoto, working_days, descricao || '', userId]
            );
        }
        res.json({ message: "Perfil atualizado com sucesso!" });
    } catch (e) {
        console.error("❌ Erro ao atualizar perfil:", e.message);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
};

app.put('/api/users/:id', handleUpdateUser);
app.put('/api/providers/:id', handleUpdateUser);

// --- PEDIDOS (ORDERS) ---

app.post('/api/orders', async (req, res) => {
    const { user_id, provider_id, service_type, date, time, price, address, lat, lng, description_request, photos_request } = req.body;
    const sql = `INSERT INTO service_orders (user_id, provider_id, service_type, date, time, status, price, address, lat, lng, description_request, photos_request) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, $11)`;
    try {
        const photosJson = JSON.stringify(Array.isArray(photos_request) ? photos_request : []);
        await db.query(sql, [user_id, provider_id, service_type, date, time, price || 0, address, lat, lng, description_request, photosJson]);
        res.status(201).json({ message: "Solicitação enviada!" });
    } catch (e) { res.status(500).json({ error: "Erro ao processar pedido." }); }
});

app.get('/api/orders/user/:id', async (req, res) => {
    const sql = `SELECT o.*, u.nome as provider_nome, p.foto_url as provider_foto FROM service_orders o JOIN users u ON o.provider_id = u.id LEFT JOIN professional_profiles p ON u.id = p.user_id WHERE o.user_id = $1 ORDER BY o.created_at DESC`;
    try {
        const result = await db.query(sql, [req.params.id]);
        res.json(result.rows || []);
    } catch (e) { res.status(500).json({ error: "Erro ao buscar pedidos." }); }
});

app.get('/api/orders/provider/:id', async (req, res) => {
    const sql = `SELECT o.*, u.nome as cliente_nome, u.telefone as cliente_telefone, u.foto_url as cliente_foto FROM service_orders o JOIN users u ON o.user_id = u.id WHERE o.provider_id = $1 ORDER BY o.created_at DESC`;
    try {
        const result = await db.query(sql, [req.params.id]);
        res.json(result.rows || []);
    } catch (e) { res.status(500).json({ error: "Erro ao carregar agenda." }); }
});

app.patch('/api/orders/:id', async (req, res) => {
    const { status, price, photos_request, photo_before, photo_after } = req.body;
    const sets = []; const params = []; let count = 1;
    if (status) { sets.push(`status = $${count++}`); params.push(status); }
    if (price) { sets.push(`price = $${count++}`); params.push(price); }
    if (photos_request) { sets.push(`photos_request = $${count++}`); params.push(JSON.stringify(photos_request)); }
    if (photo_before) { sets.push(`photo_before = $${count++}`); params.push(photo_before); }
    if (photo_after) { sets.push(`photo_after = $${count++}`); params.push(photo_after); }
    params.push(req.params.id);
    const sql = `UPDATE service_orders SET ${sets.join(', ')} WHERE id = $${count}`;
    try {
        await db.query(sql, params);
        res.json({ message: "Pedido atualizado!" });
    } catch (e) { res.status(500).json({ error: "Erro ao atualizar pedido." }); }
});

// --- AVALIAÇÕES E COMPATIBILIDADE ---

// Rota de compatibilidade (Resolve o erro 404 no perfil)
app.get('/api/providers/:id/reviews', async (req, res) => {
    const { id } = req.params;
    try {
        const sql = `
            SELECT r.*, u.nome as cliente_nome, u.foto_url as cliente_foto 
            FROM reviews r 
            JOIN users u ON r.user_id = u.id 
            WHERE r.provider_id = $1 
            ORDER BY r.created_at DESC`;
        const result = await db.query(sql, [id]);
        res.json(result.rows || []);
    } catch (e) { 
        res.status(500).json({ error: "Erro ao buscar avaliações." }); 
    }
});

app.post('/api/reviews', async (req, res) => {
    const { provider_id, user_id, rating, comment, order_id } = req.body;
    try {
        await db.query("INSERT INTO reviews (provider_id, user_id, rating, comment, order_id) VALUES ($1, $2, $3, $4, $5)", [provider_id, user_id, rating, comment, order_id]);
        res.json({ message: "Avaliação registrada!" });
    } catch (e) { res.status(500).json({ error: "Erro ao salvar avaliação." }); }
});

app.get('/api/reviews/provider/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT r.id, r.rating, r.comment, r.created_at, u.nome 
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.provider_id = $1
            ORDER BY r.created_at DESC`;
        const result = await db.query(query, [id]);
        res.json(result.rows || []);
    } catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

// --- INICIALIZAÇÃO ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 LARTOP API Online | Porta: ${PORT}`);
});
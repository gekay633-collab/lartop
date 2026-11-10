import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import { verificarAccessToken } from './jwt.js';
import assert from 'node:assert/strict';
import { imagemDaContaLartop, imagemPertenceAoUsuario } from './imagem-segura.js';
import { gerarLinkWhatsapp } from './whatsapp.js';
import { atualizarPerfilSchema, adicionarFotoPortfolioSchema } from '../modules/perfil/perfil.schemas.js';
import { criarSolicitacaoSchema } from '../modules/solicitacao/solicitacao.schemas.js';
import { gerarLinkRecuperacao } from './email.js';
import {
  registrarClienteSchema, loginSchema, redefinirSenhaSchema,
} from '../modules/auth/auth.schemas.js';

test('bloqueia imagens remotas fora da conta Cloudinary do Lartop', () => {
  const anterior = process.env.CLOUDINARY_CLOUD_NAME;
  process.env.CLOUDINARY_CLOUD_NAME = 'conta-ci-lartop';
  try {
    const legitima = 'https://res.cloudinary.com/conta-ci-lartop/image/upload/v123/lartop/foto.jpg';
    assert.equal(imagemDaContaLartop(legitima), true);
    for (const link of [
      'https://malicioso.example/visita.jpg',
      'https://res.cloudinary.com.evil.test/conta-ci-lartop/image/upload/foto.jpg',
      'https://res.cloudinary.com/outra-conta/image/upload/foto.jpg',
      'http://res.cloudinary.com/conta-ci-lartop/image/upload/foto.jpg',
      'https://res.cloudinary.com/conta-ci-lartop/raw/upload/arquivo.svg',
      'https://res.cloudinary.com/conta-ci-lartop/image/upload/foto.jpg?tracker=1',
      'javascript:alert(1)',
    ]) {
      assert.equal(imagemDaContaLartop(link), false, link);
      assert.equal(atualizarPerfilSchema.safeParse({ fotoPerfilUrl: link }).success, false, link);
      assert.equal(adicionarFotoPortfolioSchema.safeParse({ urlDepois: link }).success, false, link);
    }
    assert.equal(atualizarPerfilSchema.safeParse({ fotoPerfilUrl: legitima }).success, true);
    assert.equal(adicionarFotoPortfolioSchema.safeParse({ urlDepois: legitima }).success, true);
    const entrada = {
      profissionalId: '11111111-1111-4111-8111-111111111111',
      categoriaId: '22222222-2222-4222-8222-222222222222',
      cep: '24900000', endereco: 'Rua fictícia, 10', tamanhoM2: 10, fotos: [legitima],
    };
    assert.equal(criarSolicitacaoSchema.safeParse(entrada).success, true);
    assert.equal(criarSolicitacaoSchema.safeParse({
      ...entrada, fotos: ['https://malicioso.example/foto.jpg'],
    }).success, false);
  } finally {
    if (anterior === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = anterior;
  }
});

test('imagens novas só podem ser vinculadas à pasta da conta que fez upload', () => {
  const anterior = process.env.CLOUDINARY_CLOUD_NAME;
  process.env.CLOUDINARY_CLOUD_NAME = 'conta-ci-lartop';
  const dono = '11111111-1111-4111-8111-111111111111';
  const outro = '22222222-2222-4222-8222-222222222222';
  const foto = (id: string) => `https://res.cloudinary.com/conta-ci-lartop/image/upload/v1234567890/lartop/${id}/imagem_abc123.jpg`;
  try {
    assert.equal(imagemPertenceAoUsuario(foto(dono), dono), true);
    assert.equal(imagemPertenceAoUsuario(foto(outro), dono), false);
    for (const url of [
      foto(dono).replace('v1234567890/', ''),
      foto(dono).replace('/v1234567890/', '/c_fill,w_500/v1234567890/'),
      foto(dono).replace('/imagem_abc123.jpg', '/%2Fimagem_abc123.jpg'),
      foto(dono).replace('/imagem_abc123.jpg', '/imagem_abc123.svg'),
      foto(dono).replace('https://', 'http://'),
      foto(dono) + '?download=1',
      'https://res.cloudinary.com/outra-conta/image/upload/v1234567890/lartop/' + dono + '/imagem_abc123.jpg',
    ]) {
      assert.equal(imagemPertenceAoUsuario(url, dono), false, url);
    }
    // A validação original continua separada: ela valida a conta Cloudinary,
    // enquanto a nova regra valida a pasta exclusiva do dono autenticado.
    assert.equal(imagemDaContaLartop(foto(outro)), true);
  } finally {
    if (anterior === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = anterior;
  }
});
test('links de redefinição usam HTTPS, origem oficial e parâmetros codificados', () => {
  const anterior = process.env.FRONTEND_URL;
  const modo = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.FRONTEND_URL;
    const link = new URL(gerarLinkRecuperacao('usuario-ci', 'token=ci&123'));
    assert.equal(link.origin, 'https://lartop-ats6.vercel.app');
    assert.equal(link.pathname, '/redefinir-senha');
    assert.equal(link.searchParams.get('token'), 'token=ci&123');
    assert.equal(link.searchParams.get('id'), 'usuario-ci');

    process.env.FRONTEND_URL = 'http://site-inseguro.example';
    assert.throws(() => gerarLinkRecuperacao('usuario-ci', 'token'));
    process.env.FRONTEND_URL = 'https://site.example/?redirect=outro';
    assert.throws(() => gerarLinkRecuperacao('usuario-ci', 'token'));
  } finally {
    if (anterior === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = anterior;
    if (modo === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = modo;
  }
});

test('contas são normalizadas e entradas de autenticação têm tamanho máximo', () => {
  const cliente = registrarClienteSchema.safeParse({
    nome: 'Cliente de teste', email: '  Teste@Example.COM  ', senha: 'SenhaSegura1234',
  });
  assert.equal(cliente.success, true);
  if (cliente.success) assert.equal(cliente.data.email, 'teste@example.com');
  assert.equal(loginSchema.safeParse({ email: 'teste@example.com', senha: 'x'.repeat(73) }).success, false);
  assert.equal(redefinirSenhaSchema.safeParse({
    usuarioId: '11111111-1111-4111-8111-111111111111',
    token: 'x'.repeat(257), novaSenha: 'SenhaSegura1234',
  }).success, false);
});

test('rejeita JWT assinado com algoritmo diferente de HS256', () => {
  const chave = process.env.JWT_ACCESS_SECRET;
  assert.ok(chave, 'CI exige segredo JWT descartável, não produção');
  const token = jwt.sign({
    sub: '11111111-1111-4111-8111-111111111111',
    tipo: 'CLIENTE', credenciaisVersao: 'versao-teste',
  }, chave, { algorithm: 'HS384', expiresIn: '10m' });
  assert.throws(() => verificarAccessToken(token));
});


test('WhatsApp recebe mensagem acentuada, legível e com metro quadrado em pt-BR', () => {
  const link = gerarLinkWhatsapp('(21) 98888-7777', {
    categoriaNome: 'Corte de grama',
    endereco: 'Rua das Acácias, nº 100 – Maricá',
    tamanhoM2: 1500.5,
    descricao: '  Preciso realizar a limpeza do jardim.  ',
  });
  const url = new URL(link);
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/5521988887777');
  assert.equal(url.searchParams.get('text'), [
    'Olá! Encontrei seu perfil na Lartop e gostaria de solicitar um orçamento.',
    '',
    '*Serviço:* Corte de grama',
    '*Endereço:* Rua das Acácias, nº 100 – Maricá',
    '*Tamanho aproximado:* 1.500,5 m²',
    '*Detalhes:* Preciso realizar a limpeza do jardim.',
  ].join('\n'));
});

test('WhatsApp omite Detalhes vazio sem prejudicar as informações essenciais', () => {
  const link = gerarLinkWhatsapp('5521999991111', {
    categoriaNome: 'Poda de árvores',
    endereco: 'Rua Um, nº 10',
    tamanhoM2: 100,
    descricao: '   ',
  });
  const mensagem = new URL(link).searchParams.get('text');
  assert.ok(mensagem?.includes('*Serviço:* Poda de árvores'));
  assert.ok(mensagem?.includes('*Tamanho aproximado:* 100 m²'));
  assert.equal(mensagem?.includes('Detalhes:'), false);
  assert.equal(new URL(link).pathname, '/5521999991111');
});

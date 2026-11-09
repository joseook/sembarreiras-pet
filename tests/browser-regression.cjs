/* Executa contra Flask real e SQLite em memória; não usa serviços publicados. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const results = [];
const artifacts = path.join(root, 'test-results');
fs.mkdirSync(artifacts, { recursive: true });
let server, browser, base;
const delay = ms => new Promise(r => setTimeout(r, ms));
const future = new Date();
future.setDate(future.getDate() + 7);
while ([0, 1].includes(future.getDay())) future.setDate(future.getDate() + 1);
const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
const password = 'FicticiaParaTeste123!';

async function check(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('OK', name); }
  catch (e) { results.push({ name, ok: false, error: e.message }); console.error('FALHOU', name, e.message); }
}
async function pageFor(fn) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(10000);
  try { await fn(p, ctx); } finally { await ctx.close(); }
}
async function signup(p, tag, name = 'Teste Navegador') {
  await p.goto(base + '/pages/cadastro.html', { waitUntil: 'networkidle' });
  await p.locator('#nome').fill(name);
  await p.locator('#email').fill(tag + '@example.test');
  await p.locator('#telefone').fill('(11) 91234-5678');
  await p.locator('#senha').fill(password);
  await p.locator('#casa').check();
  await p.locator('#consentimento').check();
}
async function submit(p) { await p.locator('button[type=submit]').click(); }
async function visit(p) {
  await p.locator('#visita-data').fill(date);
  await p.locator('#visita-horario').selectOption('14:00');
  await p.locator('#visita-mensagem').fill('Gostaria de conhecer este animal.');
}
async function me(p) { return p.evaluate(() => fetch('/api/auth/me').then(r => r.json())); }

(async () => {
  const allocator = net.createServer();
  await new Promise(resolve => allocator.listen(0, '127.0.0.1', resolve));
  const port = allocator.address().port;
  await new Promise(resolve => allocator.close(resolve));
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.env.PYTHON_EXE || 'python', ['-c', `from app import app; app.run(host='127.0.0.1',port=${port},use_reloader=False)`], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: 'sqlite:///:memory:', APP_ENV: 'development', VERCEL: '0', PYTHONPATH: root },
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  let serverError = '';
  server.stderr.on('data', b => { serverError = (serverError + b.toString()).slice(-4000); });
  server.on('error', e => { serverError = e.message; });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Servidor não iniciou: ' + serverError);
    try { if ((await fetch(base + '/api/status')).ok) { ready = true; break; } } catch {}
    await delay(100);
  }
  if (!ready) throw new Error('Servidor local indisponível: ' + serverError);
  browser = await chromium.launch({ headless: true });

  await pageFor(async p => {
    for (const width of [1440, 390, 320]) {
      await p.setViewportSize({ width, height: 900 });
      for (const url of ['/', '/pages/login.html', '/pages/cadastro.html', '/pages/como-funciona.html', '/pages/contato.html', '/pages/quem-somos.html', '/pages/pet.html?id=nina', '/privacidade.html']) {
        await check(`Página ${url} em ${width}px`, async () => {
          const errors = [];
          const listener = e => errors.push(e.message);
          p.on('pageerror', listener);
          try {
            const r = await p.goto(base + url, { waitUntil: 'networkidle' });
            assert.equal(r.status(), 200);
            assert.equal(await p.locator('h1').count(), 1);
            assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            assert.deepEqual(errors, []);
            const brokenLocal = await p.evaluate(() => [...document.images].filter(i => new URL(i.src).origin === location.origin && i.complete && !i.naturalWidth).map(i => i.src));
            assert.deepEqual(brokenLocal, []);
            const menu = p.locator('#botao-menu');
            if (await menu.isVisible()) {
              await menu.click();
              assert.equal(await menu.getAttribute('aria-expanded'), 'true');
              await p.keyboard.press('Escape');
              assert.equal(await menu.getAttribute('aria-expanded'), 'false');
            }
            if (width === 390) await p.screenshot({ path: path.join(artifacts, url.replace(/\W/g, '_') + '.png'), fullPage: true });
          } finally { p.off('pageerror', listener); }
        });
      }
    }
  });

  await check('Contato corrige erro e registra mensagem na API própria', () => pageFor(async p => {
    await p.goto(base + '/pages/contato.html', { waitUntil: 'networkidle' });
    await submit(p);
    assert.ok(await p.locator('[aria-invalid=true]').count());
    await p.locator('#nome').fill('Pessoa Teste');
    await p.locator('#email').fill('contato@example.test');
    await p.locator('#assunto').selectOption('adocao');
    await p.locator('#mensagem').fill('Quero saber mais sobre adoção responsável.');
    assert.equal(await p.locator('[aria-invalid=true]').count(), 0);
    const response = p.waitForResponse(r => r.url().endsWith('/api/contato') && r.request().method() === 'POST');
    await submit(p);
    assert.equal((await response).status(), 201);
    await p.getByText(/Protocolo:/).waitFor();
    assert.equal((await me(p)).autenticado, false);
  }));

  await check('Cadastro inicia sessão e visita mantém o pet escolhido', () => pageFor(async p => {
    await signup(p, 'cadastro');
    await submit(p);
    await p.waitForURL('**/index.html');
    assert.equal((await me(p)).autenticado, true);
    await p.goto(base + '/pages/pet.html?id=nina', { waitUntil: 'networkidle' });
    assert.equal(await p.getByText('Criar conta para adotar', { exact: true }).isVisible(), false);
    await p.getByRole('link', { name: 'Agendar visita', exact: true }).click();
    assert.equal(new URL(p.url()).searchParams.get('pet_id'), 'nina');
    await visit(p);
    const response = p.waitForResponse(r => r.url().endsWith('/api/agendamentos') && r.request().method() === 'POST');
    await p.locator('#form-visita button[type=submit]').click();
    const r = await response;
    assert.equal(r.status(), 201);
    const dados = await r.json();
    assert.equal(dados.agendamento.pet_id, 'nina');
    assert.ok(dados.agendamento.usuario_id);
    assert.equal(dados.agendamento.status, 'pendente');
  }));

  await check('Logout encerra sessão e mantém usuário anônimo após recarregar', () => pageFor(async p => {
    await signup(p, 'logout'); await submit(p); await p.waitForURL('**/index.html');
    await p.locator('.t-btn-logout').waitFor();
    await p.locator('.t-btn-logout').click();
    await p.waitForLoadState('networkidle');
    assert.equal((await me(p)).autenticado, false);
    await p.reload({ waitUntil: 'networkidle' });
    assert.equal(await p.locator('.t-btn-logout').count(), 0);
  }));

  await check('Falha de logout informa erro e não finge que saiu', () => pageFor(async p => {
    await signup(p, 'logout-falha'); await submit(p); await p.waitForURL('**/index.html');
    await p.route('**/api/auth/logout', route => route.abort());
    await p.locator('.t-btn-logout').click();
    await p.getByText(/Não foi possível sair/).waitFor();
    assert.equal((await me(p)).autenticado, true);
    assert.equal(await p.locator('.t-btn-logout').isEnabled(), true);
  }));

  await check('API indisponível não cria conta nem salva senha local', () => pageFor(async p => {
    await signup(p, 'offline');
    await p.route('**/api/auth/cadastro', route => route.abort());
    await submit(p);
    await p.getByText(/Não foi possível conectar ao serviço/).waitFor();
    assert.equal(await p.locator('#email').inputValue(), 'offline@example.test');
    assert.equal(new URL(p.url()).pathname, '/pages/cadastro.html');
    assert.equal(await p.evaluate(() => localStorage.getItem('sb_usuarios_locais')), null);
    assert.equal((await me(p)).autenticado, false);
  }));

  await check('Falha da API de login não autentica pela credencial antiga', () => pageFor(async p => {
    await p.goto(base + '/pages/login.html', { waitUntil: 'networkidle' });
    await p.route('**/api/auth/login', route => route.abort());
    await p.locator('#email').fill('admin@sembarreiras.pet');
    await p.locator('#senha').fill('senha1234');
    await submit(p);
    await p.getByText(/Não foi possível conectar ao serviço/).waitFor();
    assert.equal((await me(p)).autenticado, false);
    assert.equal(new URL(p.url()).pathname, '/pages/login.html');
  }));

  await check('Visita sem login mantém formulário e oferece retorno após entrar', () => pageFor(async p => {
    const retorno = '/pages/como-funciona.html?pet_id=nina#etapa-visita';
    await p.goto(base + retorno, { waitUntil: 'networkidle' });
    await visit(p);
    await p.locator('#form-visita button[type=submit]').click();
    const entrar = p.getByRole('link', { name: 'Entrar e continuar o agendamento' });
    await entrar.waitFor();
    assert.equal(await p.locator('#visita-data').inputValue(), date);
    const target = new URL(await entrar.getAttribute('href'), p.url());
    assert.equal(target.searchParams.get('retorno'), retorno);
  }));

  await check('Falha da API de visita preserva campos sem mostrar sucesso', () => pageFor(async p => {
    await signup(p, 'visita-offline'); await submit(p); await p.waitForURL('**/index.html');
    await p.goto(base + '/pages/como-funciona.html?pet_id=nina', { waitUntil: 'networkidle' });
    await p.route('**/api/agendamentos', route => route.abort());
    await visit(p); await p.locator('#form-visita button[type=submit]').click();
    await p.getByText(/Não foi possível conectar ao serviço/).waitFor();
    assert.equal(await p.locator('#visita-data').inputValue(), date);
    assert.equal(await p.locator('[data-form-status]').getAttribute('data-tipo'), 'erro');
  }));

  await check('Estado local legado é descartado sem executar nome malicioso', () => pageFor(async p => {
    await p.addInitScript(() => {
      localStorage.setItem('sb_usuario_atual', JSON.stringify({ nome: '<svg/onload=window.auditXss=true>' }));
      localStorage.setItem('sb_usuarios_locais', JSON.stringify([{ senha: 'ficticia' }]));
    });
    await p.goto(base + '/', { waitUntil: 'networkidle' });
    assert.equal(await p.evaluate(() => window.auditXss === true), false);
    assert.equal(await p.locator('.t-btn-logout').count(), 0);
    assert.equal(await p.evaluate(() => localStorage.getItem('sb_usuarios_locais')), null);
  }));

  await check('Nome recebido do servidor é texto e não executa HTML', () => pageFor(async p => {
    await signup(p, 'nome-html', '<svg/onload=window.auditXss=true> Pessoa');
    await submit(p); await p.waitForURL('**/index.html');
    await p.locator('.t-nav-usuario').waitFor();
    assert.ok((await p.locator('.t-nav-usuario').innerText()).includes('<svg/'));
    assert.equal(await p.evaluate(() => window.auditXss === true), false);
    assert.equal(await p.locator('.t-nav-entrar svg').count(), 0);
  }));

  await check('Quatro fichas, galeria e pet inexistente funcionam', () => pageFor(async p => {
    for (const id of ['nina', 'simba', 'bento', 'mel']) {
      await p.goto(base + '/pages/pet.html?id=' + id, { waitUntil: 'networkidle' });
      assert.equal((await p.locator('h1').innerText()).toLowerCase(), id);
      await p.getByRole('button', { name: 'Ver foto 2 de 3' }).click();
      assert.equal(await p.locator('.p-miniatura').nth(1).getAttribute('aria-pressed'), 'true');
      assert.ok((await p.locator('.p-foto-principal img').getAttribute('src')).endsWith('-2.jpg'));
    }
    await p.goto(base + '/pages/pet.html?id=inexistente', { waitUntil: 'networkidle' });
    assert.equal(await p.getByRole('heading', { name: 'Não encontramos esse animal' }).isVisible(), true);
  }));

  await check('Sessão ativa não pede novo login', () => pageFor(async p => {
    await signup(p, 'sessao-ativa'); await submit(p); await p.waitForURL('**/index.html');
    await p.goto(base + '/pages/login.html');
    await p.waitForURL('**/index.html');
    assert.equal((await me(p)).autenticado, true);
  }));

  await check('Quem somos usa imagens locais quando o provedor externo falha', () => pageFor(async p => {
    await p.route('https://images.unsplash.com/**', r => r.abort());
    await p.goto(base + '/pages/quem-somos.html', { waitUntil: 'networkidle' });
    await p.evaluate(async () => {
      document.querySelectorAll('img').forEach(img => { img.loading = 'eager'; });
      await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
    });
    await p.waitForFunction(() => [...document.querySelectorAll('img[data-fallback]')].every(img => img.complete && img.naturalWidth && new URL(img.src).origin === location.origin));
    assert.equal(await p.locator('img[data-fallback]').count(), 5);
  }));

  await check('Dados compartilhados mantêm ficha de leitura quando a API falha', () => pageFor(async p => {
    await p.route('**/api/pets/nina', r => r.abort());
    await p.goto(base + '/pages/pet.html?id=nina', { waitUntil: 'networkidle' });
    assert.equal(await p.getByRole('heading', { name: 'Nina', exact: true }).isVisible(), true);
    assert.equal(await p.getByText(/Esta ficha de exemplo está disponível apenas para leitura/).isVisible(), true);
    assert.equal(await p.getByRole('link', { name: 'Agendar visita', exact: true }).count(), 0);
    assert.equal(await p.getByText('Agendamento indisponível sem conexão').getAttribute('aria-disabled'), 'true');
  }));
})().catch(e => {
  results.push({ name: 'Inicialização', ok: false, error: e.message });
  console.error(e);
}).finally(async () => {
  if (browser) await browser.close();
  if (server) server.kill();
  fs.writeFileSync(path.join(artifacts, 'browser-results.json'), JSON.stringify(results, null, 2));
  const failed = results.filter(r => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} verificações aprovadas.`);
  process.exitCode = failed ? 1 : 0;
});

/* Uso: PLAYWRIGHT_MODULE e PYTHON_EXE podem apontar para instalações existentes.
   Ex.: node tests/browser_security.cjs auth (ou xss, contact, pet, pages).
   Servidor e dados são locais; evidências ficam numa pasta temporária do sistema. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'sbp-browser-security-'));
const filter = process.argv[2] || '';
const results = [];
let server, browser, base;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function test(group, name, fn) {
  if (filter && filter !== group) return;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Pacific/Honolulu' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(20000);
  try {
    await fn(page, context);
    results.push({ group, name, ok: true });
    console.log('OK', group, name);
  } catch (error) {
    results.push({ group, name, ok: false, error: error.message });
    console.error('FALHOU', group, name, error.message);
    await page.screenshot({ path: path.join(output, group + '-' + results.length + '.png') }).catch(() => {});
  } finally { await context.close(); }
}

const account = tag => ({ nome: 'Pessoa Teste', email: tag + '@example.test',
  telefone: '(11) 91234-5678', senha: 'FicticiaSomenteEmMemoria123!', tipo_moradia: 'casa', consentimento: true });
async function fillSignup(page, data) {
  await page.locator('#nome').fill(data.nome);
  await page.locator('#email').fill(data.email);
  await page.locator('#telefone').fill(data.telefone);
  await page.locator('#senha').fill(data.senha);
  await page.locator('#casa').check();
  await page.locator('#consentimento').check();
}
async function statusReady(page) {
  await page.waitForFunction(() => Boolean(document.querySelector('[data-form-status]')?.textContent.trim()));
}

(async () => {
  const allocator = net.createServer();
  await new Promise(resolve => allocator.listen(0, '127.0.0.1', resolve));
  const port = allocator.address().port;
  await new Promise(resolve => allocator.close(resolve));
  base = 'http://127.0.0.1:' + port;
  // As tabelas são criadas explicitamente num banco em memória exclusivo do processo.
  const code = "import sys,os;sys.path.insert(0,os.getcwd());from app import app;from database import db;from models import Pet;" +
    "ctx=app.app_context();ctx.push();db.create_all();db.session.add(Pet(id='nina',nome='Nina',especie='Cachorro',sexo='Fêmea',historia='História de teste da API.'));db.session.commit();" +
    "app.run(host='127.0.0.1',port=" + port + ",use_reloader=False)";
  server = spawn(process.env.PYTHON_EXE || 'python', ['-c', code], {
    cwd: root, windowsHide: true, stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: 'sqlite:///:memory:', SB_AUTO_INIT_DB: '0', SECRET_KEY: require('node:crypto').randomBytes(32).toString('hex'), PYTHONDONTWRITEBYTECODE: '1' },
  });
  let started = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Servidor local não iniciou. Confira PYTHON_EXE.');
    try { if ((await fetch(base + '/api/auth/me')).ok) { started = true; break; } } catch {}
    await wait(100);
  }
  if (!started) throw new Error('Servidor local indisponível.');
  browser = await chromium.launch();

  await test('xss', 'Nome e cache legado não executam HTML', async (page, context) => {
    const user = { ...account('nome-html'), nome: '<svg/onload=window.securityProbe=true> Pessoa' };
    assert.equal((await context.request.post(base + '/api/auth/cadastro', { data: user })).status(), 201);
    await page.addInitScript(data => localStorage.setItem('sb_usuario_atual', JSON.stringify(data)), user);
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    assert.equal(await page.evaluate(() => window.securityProbe === true), false);
    assert.equal(await page.locator('.t-nav-entrar svg').count(), 0);
    assert.ok((await page.locator('.t-nav-usuario').innerText()).includes('<svg/'));
  });

  await test('auth', 'API indisponível não cadastra nem grava senha local', async page => {
    await page.goto(base + '/pages/cadastro.html', { waitUntil: 'networkidle' });
    await page.route('**/api/auth/cadastro', route => route.abort());
    await fillSignup(page, account('cadastro-offline'));
    await page.locator('button[type=submit]').click();
    await statusReady(page);
    assert.equal(await page.evaluate(() => localStorage.getItem('sb_usuarios_locais')), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('sb_usuario_atual')), null);
    assert.ok(!/sucesso/i.test(await page.locator('[data-form-status]').innerText()));
    assert.equal(await page.locator('#email').inputValue(), 'cadastro-offline@example.test');
  });

  await test('auth', 'API indisponível não aceita o acesso demonstrativo', async page => {
    await page.goto(base + '/pages/login.html', { waitUntil: 'networkidle' });
    await page.route('**/api/auth/login', route => route.abort());
    await page.locator('#email').fill('admin@sembarreiras.pet');
    await page.locator('#senha').fill('senha1234');
    await page.locator('button[type=submit]').click();
    await statusReady(page);
    assert.equal(await page.evaluate(() => localStorage.getItem('sb_usuario_atual')), null);
    assert.ok(!/sucesso/i.test(await page.locator('[data-form-status]').innerText()));
  });

  await test('auth', 'Login real e logout dependem da sessão do servidor', async (page, context) => {
    const data = account('login-real');
    await context.request.post(base + '/api/auth/cadastro', { data });
    await context.request.post(base + '/api/auth/logout', { data: {} });
    await page.goto(base + '/pages/login.html', { waitUntil: 'networkidle' });
    await page.locator('#email').fill(data.email);
    await page.locator('#senha').fill(data.senha);
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/index.html');
    await page.locator('.t-btn-logout').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('sb_usuario_atual')), null);
    await page.locator('.t-btn-logout').click();
    await page.waitForLoadState('networkidle');
    assert.equal((await context.request.get(base + '/api/auth/me').then(r => r.json())).autenticado, false);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.t-btn-logout').count(), 0);
  });

  await test('auth', 'Cadastro real inicia sessão sem armazenar credenciais no navegador', async (page, context) => {
    await page.goto(base + '/pages/cadastro.html', { waitUntil: 'networkidle' });
    await fillSignup(page, account('cadastro-real'));
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/index.html');
    assert.equal((await context.request.get(base + '/api/auth/me').then(r => r.json())).autenticado, true);
    assert.equal(await page.evaluate(() => localStorage.getItem('sb_usuarios_locais')), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('sb_usuario_atual')), null);
  });

  await test('auth', 'Falha de logout mantém identificação e permite nova tentativa', async (page, context) => {
    await context.request.post(base + '/api/auth/cadastro', { data: account('logout-falha') });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.route('**/api/auth/logout', route => route.abort());
    await page.locator('.t-btn-logout').click();
    await page.getByText(/Não foi possível sair/).waitFor();
    assert.equal(await page.locator('.t-btn-logout').isEnabled(), true);
    assert.equal((await context.request.get(base + '/api/auth/me').then(r => r.json())).autenticado, true);
  });

  await test('contact', 'Contato demonstrativo valida sem chamar APIs ou criar conta', async (page, context) => {
    const posts = [];
    page.on('request', r => { if (r.method() === 'POST') posts.push(r.url()); });
    await page.goto(base + '/pages/contato.html', { waitUntil: 'networkidle' });
    await page.locator('button[type=submit]').click();
    assert.ok(await page.locator('[aria-invalid=true]').count());
    await page.locator('#nome').fill('Pessoa Teste');
    await page.locator('#email').fill('contato@example.test');
    await page.locator('#assunto').selectOption('adocao');
    await page.locator('#mensagem').fill('Mensagem fictícia para validar o formulário.');
    await page.locator('button[type=submit]').click();
    await page.getByText(/Sua mensagem está preenchida corretamente/).waitFor();
    assert.deepEqual(posts, []);
    assert.equal(await page.locator('[aria-invalid=true]').count(), 0);
    assert.equal((await context.request.get(base + '/api/auth/me').then(r => r.json())).autenticado, false);
  });

  await test('visit', 'Visita exige login e mantém preenchimento ao ser recusada', async page => {
    await page.goto(base + '/pages/como-funciona.html', { waitUntil: 'networkidle' });
    const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    await page.locator('#visita-data').fill(date);
    await page.locator('#visita-horario').selectOption('14:00');
    await page.locator('#visita-mensagem').fill('Mensagem da visita.');
    await page.locator('#form-visita button[type=submit]').click();
    await page.getByText('Entre na sua conta para solicitar uma visita.', { exact: true }).waitFor();
    assert.equal(await page.locator('#visita-data').inputValue(), date);
    assert.equal(await page.locator('#visita-mensagem').inputValue(), 'Mensagem da visita.');
  });

  await test('visit', 'Visita autenticada registra somente com resposta real da API', async (page, context) => {
    await context.request.post(base + '/api/auth/cadastro', { data: account('visita-real') });
    await page.goto(base + '/pages/pet.html?id=nina', { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Agendar visita', exact: true }).click();
    await page.waitForURL('**/como-funciona.html?pet_id=nina#etapa-visita');
    await page.locator('#visita-data').fill(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
    await page.locator('#visita-horario').selectOption('14:00');
    const response = page.waitForResponse(r => r.url().endsWith('/api/agendamentos') && r.request().method() === 'POST');
    await page.locator('#form-visita button[type=submit]').click();
    const result = await response;
    assert.equal(result.status(), 201);
    const registro = (await result.json()).agendamento;
    assert.ok(registro.usuario_id);
    assert.equal(registro.pet_id, 'nina');
    assert.equal(registro.horario, '14:00');
    await page.waitForFunction(() => document.querySelector('#form-visita [data-form-status]').dataset.tipo === 'sucesso');
    assert.match(await page.locator('#form-visita [data-form-status]').innerText(), /14:00.*horário de Brasília/);
  });

  await test('visit', 'Falha de rede não simula envio nem apaga a visita', async (page, context) => {
    await context.request.post(base + '/api/auth/cadastro', { data: account('visita-rede') });
    await page.goto(base + '/pages/como-funciona.html', { waitUntil: 'networkidle' });
    const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    await page.locator('#visita-data').fill(date);
    await page.locator('#visita-horario').selectOption('14:00');
    await page.route('**/api/agendamentos', r => r.abort());
    await page.locator('#form-visita button[type=submit]').click();
    await page.getByText(/Não foi possível conectar ao serviço/).waitFor();
    assert.equal(await page.locator('#form-visita [data-form-status]').getAttribute('data-tipo'), 'erro');
    assert.equal(await page.locator('#visita-data').inputValue(), date);
  });

  await test('pet', 'Dados incompletos mantêm valores da API e não inventam saúde', async page => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/pets/nina', route => route.fulfill({ json: {
      id: 'nina', nome: 'Nina API', especie: 'Cachorro', historia: 'História recebida do servidor.',
      vacinas: null, doencasAtuais: null, exames: [],
    } }));
    await page.goto(base + '/pages/pet.html?id=nina', { waitUntil: 'networkidle' });
    assert.deepEqual(errors, []);
    assert.equal(await page.getByRole('heading', { name: 'Nina API', exact: true }).count(), 1);
    assert.equal(await page.getByText('História recebida do servidor.', { exact: true }).count(), 1);
    assert.equal(await page.getByText('Sem doença atual', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Vacinas em dia', { exact: true }).count(), 0);
  });

  await test('pet', 'Valores estruturados inesperados não quebram a ficha', async page => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/pets/nina', route => route.fulfill({ json: {
      id: 'nina', nome: 'Nina', etiquetas: {}, fotos: [], convive: { criancas: 'desconhecido' },
      vacinas: [{ nome: 'Vacina de teste', status: 'desconhecido' }],
      temperamento: null, doencasAtuais: {}, doencasPassadas: [], exames: null,
    } }));
    await page.goto(base + '/pages/pet.html?id=nina', { waitUntil: 'networkidle' });
    assert.deepEqual(errors, []);
    assert.equal(await page.getByRole('heading', { name: 'Nina', exact: true }).count(), 1);
  });

  await test('pages', 'Páginas, fichas existentes e menu mantêm estrutura responsiva', async page => {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const url of ['/', '/pages/login.html', '/pages/cadastro.html', '/pages/contato.html',
                         '/pages/como-funciona.html', '/pages/quem-somos.html', '/privacidade.html',
                         '/pages/pet.html?id=nina', '/pages/pet.html?id=simba', '/pages/pet.html?id=bento', '/pages/pet.html?id=mel']) {
        const errors = [];
        const listener = e => errors.push(e.message);
        page.on('pageerror', listener);
        try {
          assert.equal((await page.goto(base + url, { waitUntil: 'domcontentloaded' })).status(), 200);
          await page.locator('h1').waitFor();
          assert.equal(await page.locator('h1').count(), 1);
          assert.deepEqual(errors, []);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          const menu = page.locator('#botao-menu');
          if (await menu.isVisible()) {
            await menu.click();
            assert.equal(await menu.getAttribute('aria-expanded'), 'true');
            await page.keyboard.press('Escape');
            assert.equal(await menu.getAttribute('aria-expanded'), 'false');
          }
          console.log('Página verificada:', width, url);
        } finally { page.off('pageerror', listener); }
      }
    }
  });
})().catch(error => {
  results.push({ name: 'Inicialização', ok: false, error: error.message });
  console.error(error.message);
}).finally(async () => {
  if (browser) await browser.close();
  if (server) server.kill();
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  const passed = results.filter(result => result.ok).length;
  console.log(`${passed}/${results.length} testes aprovados. Evidências: ${output}`);
  process.exitCode = passed === results.length && results.length ? 0 : 1;
});

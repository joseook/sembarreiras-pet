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
function dataDeVisita(dias = 7) {
  const data = new Date(Date.now() + dias * 86400000);
  while ([0, 1].includes(data.getUTCDay())) {
    data.setUTCDate(data.getUTCDate() + 1);
  }
  return data.toISOString().slice(0, 10);
}

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

  const code = "import sys,os;sys.path.insert(0,os.getcwd());from app import app;from database import db;from models import Pet,PetMidia,Usuario;" +
    "ctx=app.app_context();ctx.push();db.create_all();db.session.add(Pet(id='nina',nome='Nina',especie='Cachorro',sexo='Fêmea',historia='História de teste da API.'));" +
    "gerente=Usuario(nome='Gerente de teste',email='gerente@example.test',telefone='11999999999',tipo_moradia='casa',consentimento=True);gerente.set_senha('FicticiaGerente123!');db.session.add(gerente);db.session.flush();app.config['GERENTES_IDS']=str(gerente.id);" +
    "temporario=Usuario(nome='Gerente temporario',email='temporario@example.test',telefone='11999999999',tipo_moradia='casa',consentimento=True);temporario.set_senha('TemporariaFicticia123!',temporaria=True);db.session.add(temporario);db.session.flush();app.config['GERENTES_IDS']+=','+str(temporario.id);" +
    "db.session.add(PetMidia(pet_id='nina',fotos=[{'src':'../assets/img/pets/nina.jpg','alt':'Nina exemplo'}]));db.session.commit();" +
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

  await test('senha', 'Senha temporária exige troca antes da agenda e deixa de funcionar após trocar', async (page, context) => {
    await page.goto(base + '/pages/login.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#email').fill('temporario@example.test');
    await page.locator('#senha').fill('TemporariaFicticia123!');
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/alterar-senha.html');
    const bloqueio = await context.request.get(base + '/api/gerencia/agendamentos');
    assert.equal(bloqueio.status(), 403);
    assert.equal((await bloqueio.json()).codigo, 'TROCAR_SENHA');
    await page.locator('#senha-atual').fill('TemporariaFicticia123!');
    await page.locator('#nova-senha').fill('NovaFicticiaSegura456!');
    await page.locator('#confirmacao').fill('NovaFicticiaSegura456!');
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/gerencia.html');
    await page.locator('#painel:not([hidden])').waitFor();
    assert.equal((await context.request.get(base + '/api/gerencia/agendamentos')).status(), 200);
    assert.equal((await context.request.post(base + '/api/auth/login', { data: { email: 'temporario@example.test', senha: 'TemporariaFicticia123!' } })).status(), 401);
    assert.equal((await context.request.post(base + '/api/auth/login', { data: { email: 'temporario@example.test', senha: 'NovaFicticiaSegura456!' } })).status(), 200);
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

  await test('contact', 'Contato valida, registra mensagem e não cria conta', async (page, context) => {
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
    await page.getByText(/Mensagem registrada/).waitFor();
    assert.equal(posts.length, 1);
    assert.ok(posts[0].endsWith('/api/contato'));
    assert.equal(await page.locator('[aria-invalid=true]').count(), 0);
    assert.equal((await context.request.get(base + '/api/auth/me').then(r => r.json())).autenticado, false);
  });

  await test('visit', 'Visita exige login e mantém preenchimento ao ser recusada', async page => {
    await page.goto(base + '/pages/agendar-visita.html?pet_id=nina', { waitUntil: 'networkidle' });
    const date = dataDeVisita();
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
    await page.waitForURL('**/agendar-visita.html?pet_id=nina');
    await page.getByRole('heading', { name: 'Conhecer Nina', exact: true }).waitFor();
    assert.equal(await page.locator('#etapa-conta, #etapa-encontrar').count(), 0);
    await page.locator('#visita-data').fill(dataDeVisita());
    await page.locator('#visita-horario').selectOption('14:00');
    const response = page.waitForResponse(r => r.url().endsWith('/api/agendamentos') && r.request().method() === 'POST');
    await page.locator('#form-visita button[type=submit]').click();
    const result = await response;
    assert.equal(result.status(), 201);
    const registro = (await result.json()).agendamento;
    assert.ok(registro.usuario_id);
    assert.equal(registro.pet_id, 'nina');
    assert.equal(registro.pet_nome, 'Nina');
    assert.equal(registro.horario, '14:00');
    await page.waitForFunction(() => document.querySelector('#form-visita [data-form-status]').dataset.tipo === 'sucesso');
    assert.match(await page.locator('#form-visita [data-form-status]').innerText(), /14:00.*horário de Brasília/);
    assert.match(await page.locator('#form-visita [data-form-status]').innerText(), /para conhecer Nina/);
  });

  await test('visit', 'Falha de rede não simula envio nem apaga a visita', async (page, context) => {
    await context.request.post(base + '/api/auth/cadastro', { data: account('visita-rede') });
    await page.goto(base + '/pages/agendar-visita.html?pet_id=nina', { waitUntil: 'networkidle' });
    const date = dataDeVisita();
    await page.locator('#visita-data').fill(date);
    await page.locator('#visita-horario').selectOption('14:00');
    await page.route('**/api/agendamentos', r => r.abort());
    await page.locator('#form-visita button[type=submit]').click();
    await page.getByText(/Não foi possível conectar ao serviço/).waitFor();
    assert.equal(await page.locator('#form-visita [data-form-status]').getAttribute('data-tipo'), 'erro');
    assert.equal(await page.locator('#visita-data').inputValue(), date);
  });

  await test('visit', 'Página direta exige um pet válido e não oferece envio para animal inexistente', async page => {
    await page.goto(base + '/pages/agendar-visita.html', { waitUntil: 'networkidle' });
    await page.getByText('Escolha um pet na página inicial para agendar uma visita.', { exact: true }).waitFor();
    assert.equal(await page.locator('#form-visita button[type=submit]').isDisabled(), true);
    await page.goto(base + '/pages/agendar-visita.html?pet_id=inexistente', { waitUntil: 'networkidle' });
    await page.getByText('Este pet não está cadastrado para visitas. Escolha um pet disponível no início.', { exact: true }).waitFor();
    assert.equal(await page.locator('#form-visita button[type=submit]').isDisabled(), true);
  });

  await test('visit', 'Agendamento direto mostra o animal e cabe no celular', async page => {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/pages/agendar-visita.html?pet_id=nina', { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Conhecer Nina', exact: true }).waitFor();
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(output, `agendamento-direto-${width}.png`), fullPage: true });
    }
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

  await test('correcoes', 'Pet ausente não usa exemplo simulado; ficha cadastrada mantém foto', async page => {
    await page.goto(base + '/pages/pet.html?id=simba', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Não encontramos esse animal', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Agendar visita', exact: true }).count(), 0);
    await page.goto(base + '/pages/pet.html?id=nina', { waitUntil: 'domcontentloaded' });
    await page.locator('.p-galeria img').first().waitFor();
    assert.equal(await page.getByRole('link', { name: 'Agendar visita', exact: true }).count(), 1);
    assert.equal(await page.locator('.p-galeria img').first().evaluate(img => img.getAttribute('src')), '../assets/img/pets/nina.jpg');
  });

  await test('correcoes', 'Login retorna ao pet e restaura os dados da solicitação', async (page, context) => {
    const user = account('destino-corrigido');
    await context.request.post(base + '/api/auth/cadastro', { data: user });
    await context.request.post(base + '/api/auth/logout', { data: {} });
    await page.goto(base + '/pages/agendar-visita.html?pet_id=nina', { waitUntil: 'networkidle' });
    const data = dataDeVisita();
    await page.locator('#visita-data').fill(data);
    await page.locator('#visita-horario').selectOption('14:00');
    await page.locator('#visita-mensagem').fill('Quero conhecer a Nina.');
    await page.locator('.t-nav-entrar a').click();
    await page.locator('#email').fill(user.email); await page.locator('#senha').fill(user.senha);
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/agendar-visita.html?pet_id=nina');
    await page.waitForFunction(() => document.querySelector('#visita-horario').value === '14:00');
    assert.equal(await page.locator('#visita-data').inputValue(), data);
    assert.equal(await page.locator('#visita-mensagem').inputValue(), 'Quero conhecer a Nina.');
  });

  await test('correcoes', 'Destino externo é recusado no login', async (page, context) => {
    const user = account('destino-externo');
    await context.request.post(base + '/api/auth/cadastro', { data: user });
    await context.request.post(base + '/api/auth/logout', { data: {} });
    await page.goto(base + '/pages/login.html?next=https%3A%2F%2Foutro.example', { waitUntil: 'domcontentloaded' });
    await page.locator('#email').fill(user.email); await page.locator('#senha').fill(user.senha);
    await page.locator('button[type=submit]').click(); await page.waitForURL('**/index.html');
    assert.ok(page.url().startsWith(base));
  });

  await test('correcoes', 'Adotante acompanha confirmação, remarca e cancela sua visita', async (page, context) => {
    await context.request.post(base + '/api/auth/cadastro', { data: account('minhas-visitas') });
    const date = dataDeVisita(14);
    const criado = await context.request.post(base + '/api/agendamentos', { data: { data: date, horario: '14:00', pet_id: 'nina' } });
    assert.equal(criado.status(), 201); const id = (await criado.json()).agendamento.id;
    const gerente = await browser.newContext();
    try {
      await gerente.request.post(base + '/api/auth/login', { data: { email: 'gerente@example.test', senha: 'FicticiaGerente123!' } });
      assert.equal((await gerente.request.post(base + `/api/gerencia/agendamentos/${id}/confirmar`, { data: {} })).status(), 200);
      await page.goto(base + '/pages/minhas-visitas.html', { waitUntil: 'networkidle' });
      await page.getByText('Confirmada — sua visita foi aprovada', { exact: true }).waitFor();
      await page.getByText(/Sua visita para conhecer Nina está confirmada/).waitFor();
      await page.getByText('Remarcar visita', { exact: true }).click();
      await page.locator(`#remarcar-data-${id}`).fill(date); await page.locator(`#remarcar-hora-${id}`).selectOption('15:00');
      await page.getByRole('button', { name: 'Solicitar novo horário' }).click();
      await page.getByText('Pendente de confirmação', { exact: true }).waitFor();
      assert.equal((await gerente.request.get(base + '/api/gerencia/agendamentos')).status(), 200);
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: 'Cancelar visita', exact: true }).click();
      await page.getByText('Cancelada', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Cancelar visita', exact: true }).count(), 0);
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
    } finally { await gerente.close(); }
  });

  await test('correcoes', 'Contato fica disponível à gerência e não executa HTML', async (page, context) => {
    const resposta = await context.request.post(base + '/api/contato', { data: { nome: 'Contato teste', email: 'mensagem@example.test', assunto: 'outro', mensagem: '<img src=x onerror=window.contatoProbe=true> Teste de mensagem.' } });
    const protocolo = (await resposta.json()).protocolo;
    await context.request.post(base + '/api/auth/login', { data: { email: 'gerente@example.test', senha: 'FicticiaGerente123!' } });
    await page.goto(base + '/pages/gerencia.html', { waitUntil: 'networkidle' });
    await page.locator('#contatos summary').click();
    await page.getByText('Protocolo: ' + protocolo, { exact: true }).waitFor();
    assert.equal(await page.locator('#contatos-lista img').count(), 0);
    assert.equal(await page.evaluate(() => window.contatoProbe === true), false);
  });

  await test('correcoes', 'Início usa disponibilidade da API e privacidade descreve persistência', async page => {
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.h-pets-grade .h-pet').count(), 1);
    assert.equal(await page.locator('.h-pets-grade a[href*=simba]').count(), 0);
    await page.goto(base + '/privacidade.html', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#politica-secoes section').count(), 6);
    assert.ok((await page.locator('#politica-secoes').textContent()).includes('Minhas visitas'));
    assert.ok(!(await page.locator('main').textContent()).includes('não são enviados nem salvos'));
  });

  await test('correcoes', 'Navegação autenticada e menu de gerente cabem no celular', async (page, context) => {
    await context.request.post(base + '/api/auth/login', { data: { email: 'gerente@example.test', senha: 'FicticiaGerente123!' } });
    for (const width of [1440, 1100, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.locator('.t-nav-usuario').waitFor({ state: 'attached' });
      if (await page.locator('#botao-menu').isVisible()) await page.locator('#botao-menu').click();
      await page.locator('.t-nav').getByRole('link', { name: 'Minhas visitas', exact: true }).waitFor();
      await page.locator('.t-nav').getByRole('link', { name: 'Agenda da clínica', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Largura ${width}`);
    }
  });

  await test('pages', 'Páginas, fichas existentes e menu mantêm estrutura responsiva', async page => {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const url of ['/', '/pages/login.html', '/pages/cadastro.html', '/pages/contato.html',
                         '/pages/catalogo.html', '/pages/quem-somos.html', '/privacidade.html',
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

  await test('direto', 'Endereço antigo abre catálogo ou visita e não há controles de tutorial', async page => {
    await page.goto(base + '/pages/como-funciona.html', { waitUntil: 'networkidle' });
    assert.ok(page.url().endsWith('/pages/catalogo.html'));
    await page.getByRole('heading', { name: 'Pets para adoção', exact: true }).waitFor();
    const link = page.locator('.h-pet-link').first();
    assert.equal(new URL(await link.getAttribute('href')).pathname, '/pages/pet.html');
    assert.equal(await page.locator('.cf-tutorial, .cf-previa, .cf-pedido, #form-visita').count(), 0);
    await page.goto(base + '/pages/como-funciona.html?pet_id=nina#etapa-visita', { waitUntil: 'networkidle' });
    assert.equal(new URL(page.url()).pathname, '/pages/agendar-visita.html');
    assert.equal(new URL(page.url()).searchParams.get('pet_id'), 'nina');
    await page.getByRole('heading', { name: 'Conhecer Nina', exact: true }).waitFor();
    await page.goto(base + '/pages/login.html', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#lembrar').count(), 0);
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('a[href*=como-funciona], .h-passos, .h-caminho').count(), 0);
  });

  await test('direto', 'Falha da API não apresenta uma ficha fictícia', async page => {
    await page.route('**/api/pets/nina', route => route.abort());
    await page.goto(base + '/pages/pet.html?id=nina', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Não foi possível carregar a ficha', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Agendar visita', exact: true }).count(), 0);
    assert.equal(await page.locator('.p-galeria').count(), 0);
  });

  async function entrarGerente(context) {
    assert.equal((await context.request.post(base + '/api/auth/login', { data: { email: 'gerente@example.test', senha: 'FicticiaGerente123!' } })).status(), 200);
  }
  async function preencherPet(page, nome) {
    await page.locator('#pet-nome').fill(nome);
    await page.locator('#pet-especie').selectOption('Gato');
    await page.locator('#pet-sexo').selectOption('Fêmea');
    await page.locator('#pet-porte').selectOption('Pequeno');
  }

  await test('crud', 'Cadastrar, consultar, editar e excluir pet com foto', async (page, context) => {
    await entrarGerente(context);
    await page.goto(base + '/pages/gerencia-pets.html', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Cadastrar pet', exact: true }).click();
    await page.locator('#salvar-pet').click();
    assert.equal(await page.locator('#pet-nome').evaluate(input => input.validity.valueMissing), true);
    await preencherPet(page, 'Lua do CRUD');
    await page.locator('#pet-historia').fill('História informada para a apresentação.');
    await page.getByRole('button', { name: 'Adicionar foto', exact: true }).click();
    await page.locator('[data-foto-src]').fill('../assets/img/pets/nina.jpg');
    await page.locator('[data-foto-alt]').fill('Foto ilustrativa da Lua');
    const criada = page.waitForResponse(r => r.url().endsWith('/api/gerencia/pets') && r.request().method() === 'POST');
    await page.locator('#salvar-pet').click();
    const registro = await criada; assert.equal(registro.status(), 201);
    const pet = (await registro.json()).pet;
    assert.equal(pet.castrado, null); assert.equal(pet.fotos.length, 1);
    await page.locator('#editor').waitFor({ state: 'hidden' });
    await page.getByRole('heading', { name: 'Lua do CRUD', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Editar Lua do CRUD', exact: true }).click();
    assert.equal(await page.locator('[data-foto-alt]').inputValue(), 'Foto ilustrativa da Lua');
    await page.locator('#pet-nome').fill('Lua editada');
    await page.locator('#pet-castrado').selectOption('sim');
    await page.locator('#salvar-pet').click();
    await page.getByRole('heading', { name: 'Lua editada', exact: true }).waitFor();
    const publica = await (await context.request.get(base + '/api/pets/' + pet.id)).json();
    assert.equal(publica.nome, 'Lua editada'); assert.equal(publica.id, pet.id); assert.equal(publica.castrado, true);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Excluir Lua editada', exact: true }).click();
    await page.getByText('Pet excluído definitivamente.', { exact: true }).waitFor();
    assert.equal((await context.request.get(base + '/api/pets/' + pet.id)).status(), 404);
  });

  await test('crud', 'Histórico bloqueia exclusão e visitas ativas precisam ser resolvidas para arquivar', async (page, context) => {
    await entrarGerente(context);
    const r = await context.request.post(base + '/api/gerencia/pets', { data: { nome: 'Pet histórico CRUD', especie: 'Gato', sexo: 'Macho' } });
    const id = (await r.json()).pet.id;
    const adotante = await browser.newContext();
    try {
      await adotante.request.post(base + '/api/auth/cadastro', { data: account('crud-historico') });
      const visita = await adotante.request.post(base + '/api/agendamentos', { data: { pet_id: id, data: dataDeVisita(14), horario: '14:00' } });
      const visitaId = (await visita.json()).agendamento.id;
      await page.goto(base + '/pages/gerencia-pets.html', { waitUntil: 'networkidle' });
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: 'Excluir Pet histórico CRUD', exact: true }).click();
      await page.getByText(/Este pet possui histórico de visitas e não pode ser excluído/).waitFor();
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: 'Arquivar Pet histórico CRUD', exact: true }).click();
      await page.getByText(/Cancele ou resolva as visitas pendentes/).waitFor();
      assert.equal((await adotante.request.post(base + `/api/agendamentos/${visitaId}/cancelar`, { data: {} })).status(), 200);
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: 'Arquivar Pet histórico CRUD', exact: true }).click();
      await page.getByRole('button', { name: 'Reativar Pet histórico CRUD', exact: true }).waitFor();
      assert.equal((await context.request.get(base + '/api/pets/' + id)).status(), 410);
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: 'Reativar Pet histórico CRUD', exact: true }).click();
      await page.getByRole('button', { name: 'Arquivar Pet histórico CRUD', exact: true }).waitFor();
      assert.equal((await context.request.get(base + '/api/pets/' + id)).status(), 200);
    } finally { await adotante.close(); }
  });

  await test('crud', 'Escape e Cancelar preservam ou descartam alterações conforme escolha', async (page, context) => {
    await entrarGerente(context);
    await page.goto(base + '/pages/gerencia-pets.html', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Cadastrar pet', exact: true }).click();
    assert.equal(await page.locator('#pet-nome').evaluate(input => document.activeElement === input), true);
    await page.locator('#pet-nome').fill('Não salvar');
    page.once('dialog', dialog => dialog.dismiss()); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#editor').isVisible(), true);
    assert.equal(await page.locator('#pet-nome').inputValue(), 'Não salvar');
    page.once('dialog', dialog => dialog.accept()); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#editor').isVisible(), false);
    assert.equal(await page.getByRole('heading', { name: 'Não salvar', exact: true }).count(), 0);
  });

  await test('crud', 'Erro de foto explica correção sem apagar o formulário', async (page, context) => {
    await entrarGerente(context);
    await page.goto(base + '/pages/gerencia-pets.html', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Cadastrar pet', exact: true }).click();
    await preencherPet(page, 'Pet correção foto');
    await page.getByRole('button', { name: 'Adicionar foto', exact: true }).click();
    await page.locator('[data-foto-src]').fill('endereco-invalido');
    await page.locator('[data-foto-alt]').fill('Foto de teste');
    await page.locator('#salvar-pet').click(); await page.locator('#erro-fotos:not([hidden])').waitFor();
    assert.equal(await page.locator('#pet-nome').inputValue(), 'Pet correção foto');
    assert.equal(await page.locator('#form-erro').evaluate(node => node === document.activeElement), true);
    await page.locator('[data-foto-src]').fill('../assets/img/pets/nina.jpg');
    await page.locator('#salvar-pet').click();
    await page.getByRole('heading', { name: 'Pet correção foto', exact: true }).waitFor();
  });

  await test('crud', 'Catálogo público filtra nome, espécie e porte e permite limpar a busca', async (page, context) => {
    await entrarGerente(context);
    assert.equal((await context.request.post(base + '/api/gerencia/pets', { data: { nome: 'Pet busca WEB', especie: 'Gato', sexo: 'Fêmea', porte: 'Pequeno' } })).status(), 201);
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.locator('#catalogo-busca').fill('Pet busca WEB'); await page.locator('#catalogo-especie').selectOption('Gato'); await page.locator('#catalogo-porte').selectOption('Pequeno');
    await page.locator('#filtros-pets button[type=submit]').click();
    await page.getByRole('heading', { name: 'Pet busca WEB', exact: true }).waitFor();
    assert.equal(await page.locator('.h-pet').count(), 1);
    await page.locator('#catalogo-busca').fill('zzz-inexistente'); await page.locator('#filtros-pets button[type=submit]').click();
    await page.getByText(/Nenhum pet encontrado para estes filtros/).waitFor();
    await page.locator('#filtros-pets button[type=reset]').click();
    await page.waitForFunction(() => document.querySelectorAll('.h-pet').length > 0);
  });

  await test('crud', 'Tela e formulário de pets funcionam em celular e mantêm foco no diálogo', async (page, context) => {
    await entrarGerente(context);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/pages/gerencia-pets.html', { waitUntil: 'networkidle' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(output, `crud-lista-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Cadastrar pet', exact: true }).click();
      for (let n = 0; n < 8; n++) await page.keyboard.press('Tab');
      assert.equal(await page.locator('#editor').evaluate(node => node.contains(document.activeElement)), true);
      assert.equal(await page.locator('#editor').evaluate(node => node.scrollWidth > node.clientWidth), false);
      await page.screenshot({ path: path.join(output, `crud-form-${width}.png`) });
      await page.keyboard.press('Escape');
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

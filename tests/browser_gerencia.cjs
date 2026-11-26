const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'sbp-gerencia-'));
let server, browser;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const allocator = net.createServer();
  await new Promise(resolve => allocator.listen(0, '127.0.0.1', resolve));
  const port = allocator.address().port;
  await new Promise(resolve => allocator.close(resolve));
  const base = 'http://127.0.0.1:' + port;
  const code = `
from app import app
from database import db
from models import Usuario,Pet,Agendamento
from datetime import date,timedelta
with app.app_context():
 db.create_all()
 gerente=Usuario(nome='Gerente Teste',email='gerente@example.test',telefone='11999999999',tipo_moradia='casa',consentimento=True)
 gerente.set_senha('senha-ficticia-testes')
 pessoa=Usuario(nome='<img src=x onerror=window.probe=true>',email='pessoa@example.test',telefone='11888888888',tipo_moradia='casa',consentimento=True)
 pessoa.set_senha('senha-ficticia-testes')
 db.session.add_all([gerente,pessoa,Pet(id='teste',nome='Pet teste',especie='Gato',sexo='Macho')])
 db.session.flush()
 app.config['GERENTES_IDS']=str(gerente.id)
 for i in range(26):
  db.session.add(Agendamento(usuario_id=pessoa.id,pet_id='teste',data_visita=date.today()+timedelta(days=10),horario='14:30',mensagem='<svg onload=window.probe=true>'))
 db.session.commit()
app.run(host='127.0.0.1',port=${port},use_reloader=False)
`;
  server = spawn(process.env.PYTHON_EXE || 'python', ['-c', code], {
    cwd: path.resolve(__dirname, '..'), windowsHide: true, stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: 'sqlite:///:memory:', SB_AUTO_INIT_DB: '0',
      SECRET_KEY: require('node:crypto').randomBytes(32).toString('hex') },
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Servidor de testes não iniciou.');
    try { if ((await fetch(base + '/api/auth/me')).ok) { ready = true; break; } } catch {}
    await wait(100);
  }
  assert.ok(ready, 'Servidor disponível');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/pages/gerencia.html');
  await page.locator('#acesso:not([hidden])').waitFor();
  assert.equal(await page.locator('#painel').isVisible(), false);
  console.log('OK visitante sem acesso');
  await context.request.post(base + '/api/auth/login', { data: { email: 'pessoa@example.test', senha: 'senha-ficticia-testes' } });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#feedback').textContent.includes('Acesso exclusivo'));
  assert.equal(await page.locator('#painel').isVisible(), false);
  console.log('OK usuário comum sem acesso');
  await page.goto(base + '/pages/login.html');
  await page.locator('#email').fill('gerente@example.test');
  await page.locator('#senha').fill('senha-ficticia-testes');
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/pages/gerencia.html');
  await page.waitForFunction(() => document.querySelectorAll('.agenda-card').length === 25);
  assert.equal(await page.evaluate(() => window.probe === true), false);
  assert.equal(await page.locator('.agenda-card img, .agenda-card svg').count(), 0);
  assert.ok((await page.locator('.agenda-card').first().textContent()).includes('<img'));
  console.log('OK login de gerente, lista e conteúdo seguro');
  await page.locator('#proxima').click();
  await page.waitForFunction(() => document.querySelectorAll('.agenda-card').length === 1);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /^Confirmar visita: solicitação/ }).click();
  await page.waitForFunction(() => document.querySelector('#feedback').textContent.includes('Agendamento confirmado') && !document.querySelector('#painel').hasAttribute('aria-busy'));
  assert.ok((await page.locator('#pagina').textContent()).includes('Página 1 de 1'));
  await page.locator('#status').selectOption('confirmado');
  await page.locator('#filtros button').click();
  await page.waitForFunction(() => document.querySelectorAll('.agenda-status--confirmado').length === 1);
  assert.equal(await page.getByRole('button', { name: /^Confirmar visita: solicitação/ }).count(), 0);
  console.log('OK paginação, confirmação persistida, filtro e retorno à página válida');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Sem rolagem horizontal ${width}`);
    await page.screenshot({ path: path.join(output, `agenda-${width}.png`), fullPage: true });
  }
  console.log('OK layout em quatro larguras');
  await page.locator('#data').fill('2000-01-01');
  await page.locator('#filtros button').click();
  await page.waitForFunction(() => document.querySelector('#feedback').textContent.includes('Nenhum agendamento'));
  console.log('OK estado vazio');
  await page.route('**/api/gerencia/agendamentos?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erro: 'Serviço indisponível para teste.' }) }));
  await page.locator('#filtros button').click();
  await page.waitForFunction(() => document.querySelector('#feedback').textContent.includes('Serviço indisponível'));
  assert.equal(await page.locator('.agenda-card').count(), 0);
  await page.unroute('**/api/gerencia/agendamentos?*');
  console.log('OK falha de serviço sem dados antigos');
  await page.locator('#sair').click();
  await page.waitForURL('**/pages/login.html');
  assert.equal((await context.request.get(base + '/api/gerencia/agendamentos')).status(), 401);
  assert.deepEqual(errors, []);
  console.log('OK logout e ausência de erros JavaScript');
  console.log('Evidências:', output);
  await context.close();
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  server?.kill();
});

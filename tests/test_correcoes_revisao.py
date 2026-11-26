"""Regressões dos achados de 17/11; banco exclusivo em memória."""
import os
import time
from datetime import date, datetime, timedelta
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['SB_AUTO_INIT_DB'] = '0'
os.environ['SECRET_KEY'] = 'chave-isolada-das-regressoes-1234567890'

from app import create_app
from database import db
from models import Usuario, Pet, Agendamento, SessaoUsuario, TentativaAcesso, PetMidia, MensagemContato
from seguranca import agora
from politica import politica_atual, publicar_politica


class ConfigTeste:
    TESTING = True
    SECRET_KEY = 'chave-isolada-regressoes'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {}
    AUTO_INIT_DB = False
    GERENTES_IDS = '1'


class CorrecoesTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app(ConfigTeste)
        self.ctx = self.app.app_context(); self.ctx.push()
        db.create_all()
        for id, nome in [(1, 'gerente'), (2, 'adotante'), (3, 'outro')]:
            u = Usuario(id=id, nome=nome, email=nome+'@example.test', telefone='11912345678',
                tipo_moradia='casa', consentimento=True)
            u.set_senha('senha-ficticia-testes'); db.session.add(u)
        db.session.add(Pet(id='nina', nome='Nina', especie='Cachorro', sexo='Fêmea', status='disponivel'))
        db.session.commit()
        self.client = self.app.test_client()
        futuro = date.today() + timedelta(days=14)
        while futuro.weekday() in {0, 6}: futuro += timedelta(days=1)
        self.data = futuro.isoformat()
        self.dados = {'data': self.data, 'horario': '14:00', 'pet_id': 'nina', 'mensagem': 'Visita de teste.'}

    def tearDown(self):
        db.session.remove(); db.drop_all(); db.engine.dispose(); self.ctx.pop()

    def login(self, nome='adotante', client=None):
        resposta = (client or self.client).post('/api/auth/login', json={
            'email': nome+'@example.test', 'senha': 'senha-ficticia-testes'})
        self.assertEqual(resposta.status_code, 200)
        return resposta

    def criar(self):
        resposta = self.client.post('/api/agendamentos', json=self.dados)
        self.assertEqual(resposta.status_code, 201)
        return resposta.json['agendamento']['id']

    def test_cookie_copiado_revogado_no_logout_em_outro_cliente(self):
        self.login('gerente')
        cookie = self.client.get_cookie('session').value
        copia = self.app.test_client(); copia.set_cookie('session', cookie)
        self.assertEqual(copia.get('/api/gerencia/agendamentos').status_code, 200)
        self.assertEqual(self.client.post('/api/auth/logout', json={}).status_code, 200)
        self.assertFalse(copia.get('/api/auth/me').json['autenticado'])
        self.assertEqual(copia.get('/api/gerencia/agendamentos').status_code, 401)
        self.assertEqual(copia.post('/api/agendamentos', json=self.dados).status_code, 401)

    def test_recuperacao_por_email_redefine_senha_e_revoga_sessoes(self):
        self.login()
        visitante = self.app.test_client()
        solicitar = '/api/auth/recuperar-senha'
        with visitante.get('/pages/login.html') as pagina:
            self.assertIn('esqueci-senha.html', pagina.get_data(as_text=True))
        with visitante.get('/pages/esqueci-senha.html') as pagina:
            self.assertEqual(pagina.status_code, 200)
        self.assertEqual(visitante.post(solicitar, json={'email': 'adotante@example.test'}).status_code, 503)
        self.app.config.update(SB_PUBLIC_URL='https://pets.example.test', SMTP_HOST='smtp.example.test',
                               SMTP_FROM='pets@example.test')
        with patch('recuperacao.smtplib.SMTP') as smtp:
            existente = visitante.post(solicitar, json={'email': 'Adotante@example.test'})
            ausente = visitante.post(solicitar, json={'email': 'ausente@example.test'})
            self.assertEqual(existente.status_code, 202)
            self.assertEqual(existente.json, ausente.json)
            envio = smtp.return_value.__enter__.return_value.send_message
            envio.assert_called_once()
            mensagem = envio.call_args.args[0]
        self.assertEqual(mensagem['To'], 'adotante@example.test')
        link = urlsplit(mensagem.get_content().splitlines()[2])
        self.assertEqual(link.netloc, 'pets.example.test')
        self.assertEqual(link.path, '/pages/esqueci-senha.html')
        redefinir = '/api/auth/redefinir-senha'
        payload = {'token': link.fragment, 'nova_senha': 'nova-senha-segura', 'confirmacao': 'nova-senha-segura'}
        with patch('itsdangerous.timed.time.time', return_value=time.time() + 1801):
            self.assertEqual(visitante.post(redefinir, json=payload).status_code, 400)
        self.assertEqual(visitante.post(redefinir, json=payload).status_code, 200)
        self.assertEqual(visitante.post(redefinir, json=payload).status_code, 400)
        self.assertFalse(self.client.get('/api/auth/me').json['autenticado'])
        self.assertEqual(visitante.post('/api/auth/login', json={
            'email': 'adotante@example.test', 'senha': 'nova-senha-segura'}).status_code, 200)

    def test_falha_smtp_informa_erro_real_ao_usuario(self):
        import smtplib
        self.app.config.update(SB_PUBLIC_URL='https://pets.example.test', SMTP_HOST='smtp.example.test',
                               SMTP_FROM='pets@example.test')
        with patch('recuperacao.smtplib.SMTP', side_effect=smtplib.SMTPAuthenticationError(535, b'x')):
            resposta = self.app.test_client().post('/api/auth/recuperar-senha',
                                                   json={'email': 'adotante@example.test'})
        self.assertEqual(resposta.status_code, 503)
        self.assertIn('Não foi possível enviar', resposta.json['erro'])

    def test_rotas_api_inexistentes_respondem_json(self):
        cliente = self.app.test_client()
        self.assertEqual(cliente.get('/api/nao-existe').json, {'erro': 'Recurso não encontrado.'})
        resposta = cliente.get('/api/auth/logout')
        self.assertIn(resposta.status_code, (404, 405))
        self.assertIn('erro', resposta.json)

    def test_login_invalido_revoga_conta_anterior_e_cookie_copiado(self):
        for payload in [{'email': 'outro@example.test', 'senha': 'errada'}, []]:
            self.login('gerente')
            cookie = self.client.get_cookie('session').value
            self.assertIn(self.client.post('/api/auth/login', json=payload).status_code, (400, 401))
            self.assertFalse(self.client.get('/api/auth/me').json['autenticado'])
            copia = self.app.test_client(); copia.set_cookie('session', cookie)
            self.assertEqual(copia.get('/api/gerencia/agendamentos').status_code, 401)

    def test_sessao_expira_e_guarda_somente_hash_do_token(self):
        self.login()
        with self.client.session_transaction() as sessao:
            token = sessao['sid']
        registro = SessaoUsuario.query.one()
        self.assertNotEqual(token, registro.token_hash)
        registro.expira_em = agora() - timedelta(seconds=1); db.session.commit()
        self.assertFalse(self.client.get('/api/auth/me').json['autenticado'])

    def test_cookie_legado_com_usuario_id_nao_autoriza(self):
        with self.client.session_transaction() as sessao: sessao['usuario_id'] = 1
        self.assertEqual(self.client.get('/api/gerencia/agendamentos').status_code, 401)

    def test_troca_de_conta_rotaciona_sessao(self):
        self.login('gerente'); cookie = self.client.get_cookie('session').value
        self.login('adotante')
        self.assertEqual(self.client.get('/api/auth/me').json['usuario']['nome'], 'adotante')
        copia = self.app.test_client(); copia.set_cookie('session', cookie)
        self.assertEqual(copia.get('/api/gerencia/agendamentos').status_code, 401)

    def test_cadastro_valida_formatos_e_limites_sem_gravar(self):
        base = {'nome': 'Pessoa', 'email': 'nova@example.test', 'telefone': '11912345678',
                'senha': 'senha-ficticia-testes', 'consentimento': True}
        for campo, valor in [('nome', 'x'*121), ('email', 'sem-arroba'), ('email', 'x'*121+'@a.test'),
                             ('telefone', 'abc'), ('telefone', '1'*31), ('senha', 'x'*129)]:
            with self.subTest(campo=campo, valor=valor):
                self.assertEqual(self.client.post('/api/auth/cadastro', json={**base, campo: valor}).status_code, 400)
        self.assertEqual(Usuario.query.count(), 3)

    def test_limitador_persistente_por_conta_mesmo_em_outro_cliente(self):
        for _ in range(10):
            self.assertEqual(self.client.post('/api/auth/login', json={'email': 'naoexiste@example.test', 'senha': 'errada'}).status_code, 401)
        outro = self.app.test_client()
        resposta = outro.post('/api/auth/login', json={'email': 'naoexiste@example.test', 'senha': 'errada'})
        self.assertEqual(resposta.status_code, 429)
        self.assertEqual(resposta.headers['Retry-After'], '900')
        self.assertTrue(all('example' not in x.chave for x in TentativaAcesso.query.all()))
        self.assertEqual(outro.post('/api/auth/login', json={'email': 'outra@example.test', 'senha': 'errada'}).status_code, 401)

    def test_limite_de_corpo_json(self):
        r = self.client.post('/api/auth/cadastro', json={'nome': 'x'*40000})
        self.assertEqual(r.status_code, 413)
        self.assertIn('erro', r.json)

    def test_pet_indisponivel_nao_pode_ser_solicitado_nem_confirmado(self):
        self.login(); id = self.criar()
        pet = db.session.get(Pet, 'nina'); pet.status = 'adotado'; db.session.commit()
        self.assertEqual(self.client.post('/api/agendamentos', json=self.dados).status_code, 409)
        self.login('gerente')
        self.assertEqual(self.client.post(f'/api/gerencia/agendamentos/{id}/confirmar', json={}).status_code, 409)
        self.assertEqual(db.session.get(Agendamento, id).status, 'pendente')
        self.assertEqual(self.client.get('/api/pets?status=disponivel').json, [])

    def test_dias_e_horarios_validados_na_api_e_confirmacao(self):
        self.login()
        domingo = date.fromisoformat(self.data)
        while domingo.weekday() != 6: domingo += timedelta(days=1)
        for dados in [{**self.dados, 'data': domingo.isoformat()}, {**self.dados, 'data': (domingo+timedelta(days=1)).isoformat()},
                      {**self.dados, 'horario': '03:17'}, {**self.dados, 'horario': '12:30'}]:
            self.assertEqual(self.client.post('/api/agendamentos', json=dados).status_code, 400)
        visita = Agendamento(usuario_id=2, pet_id='nina', data_visita=domingo, horario='14:00')
        db.session.add(visita); db.session.commit(); self.login('gerente')
        self.assertEqual(self.client.post(f'/api/gerencia/agendamentos/{visita.id}/confirmar', json={}).status_code, 409)

    def test_reenvio_nao_duplica_solicitacao(self):
        self.login(); id = self.criar()
        r = self.client.post('/api/agendamentos', json=self.dados)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json['agendamento']['id'], id)
        self.assertEqual(Agendamento.query.count(), 1)

    def test_minhas_visitas_isolam_dados_e_impedem_alteracao_alheia(self):
        self.login(); id = self.criar()
        self.login('outro')
        self.assertEqual(self.client.get('/api/agendamentos').json['total'], 0)
        for acao in ['cancelar', 'remarcar']:
            self.assertEqual(self.client.post(f'/api/agendamentos/{id}/{acao}', json=self.dados).status_code, 404)
        self.assertEqual(self.client.get('/api/gerencia/contatos').status_code, 403)

    def test_status_chega_ao_adotante_remarcacao_exige_nova_confirmacao(self):
        self.login(); id = self.criar()
        gerente = self.app.test_client(); self.login('gerente', gerente)
        self.assertEqual(gerente.post(f'/api/gerencia/agendamentos/{id}/confirmar', json={}).status_code, 200)
        self.assertEqual(self.client.get('/api/agendamentos').json['agendamentos'][0]['status'], 'confirmado')
        r = self.client.post(f'/api/agendamentos/{id}/remarcar', json={'data': self.data, 'horario': '15:00'})
        self.assertEqual(r.status_code, 200); self.assertEqual(r.json['agendamento']['status'], 'pendente')
        self.assertEqual(gerente.get('/api/gerencia/agendamentos').json['agendamentos'][0]['horario'], '15:00')
        r = self.client.post(f'/api/agendamentos/{id}/cancelar', json={})
        self.assertEqual(r.json['agendamento']['status'], 'cancelado')
        self.assertEqual(self.client.post(f'/api/agendamentos/{id}/cancelar', json={}).status_code, 200)
        self.assertEqual(self.client.post(f'/api/agendamentos/{id}/remarcar', json=self.dados).status_code, 409)

    def test_remarcar_nao_cria_horario_duplicado(self):
        self.login(); id = self.criar()
        self.client.post('/api/agendamentos', json={**self.dados, 'horario': '15:00'})
        r = self.client.post(f'/api/agendamentos/{id}/remarcar', json={'data': self.data, 'horario': '15:00'})
        self.assertEqual(r.status_code, 409)
        self.assertEqual(db.session.get(Agendamento, id).horario, '14:00')

    def test_contato_gera_protocolo_e_so_gerente_consulta(self):
        dados = {'nome': 'Pessoa', 'email': 'pessoa@example.test', 'assunto': 'adocao', 'mensagem': '<img src=x onerror=alert(1)> Mensagem teste.'}
        r = self.client.post('/api/contato', json=dados)
        self.assertEqual(r.status_code, 201); self.assertEqual(MensagemContato.query.count(), 1)
        self.assertFalse(self.client.get('/api/auth/me').json['autenticado'])
        self.assertEqual(self.client.get('/api/gerencia/contatos').status_code, 401)
        self.login('gerente')
        self.assertEqual(self.client.get('/api/gerencia/contatos').json['contatos'][0]['protocolo'], r.json['protocolo'])
        for extra in [{'email': 'invalido'}, {'mensagem': 'curta'}, {'assunto': 'inexistente'}]:
            self.assertEqual(self.client.post('/api/contato', json={**dados, **extra}).status_code, 400)

    def test_politica_atual_nao_promete_dados_nao_salvos(self):
        self.assertEqual(self.client.get('/api/privacidade').json, politica_atual())
        from models import PoliticaPrivacidade
        publicar_politica(); publicar_politica()
        self.assertEqual(PoliticaPrivacidade.query.count(), 1)
        secao = PoliticaPrivacidade.query.one().secoes[0]
        secao.conteudo = 'Revisão preservada'; db.session.commit(); publicar_politica()
        self.assertEqual(secao.conteudo, 'Revisão preservada')

    def test_fotos_vem_do_registro_sem_inventar_saude(self):
        fotos = [{'src': '../assets/img/pets/nina.jpg', 'alt': 'Foto autorizada de teste'}]
        db.session.add(PetMidia(pet_id='nina', fotos=fotos)); db.session.commit()
        dados = self.client.get('/api/pets/nina').json
        self.assertEqual(dados['fotos'], fotos); self.assertIsNone(dados['vacinas'])

    def test_prepare_db_idempotente_preserva_usuarios_e_visitas(self):
        self.login(); id = self.criar()
        for _ in range(2):
            r = self.app.test_cli_runner().invoke(args=['prepare-db'])
            self.assertEqual(r.exit_code, 0, r.output)
        self.assertEqual(Usuario.query.count(), 3)
        self.assertEqual(db.session.get(Agendamento, id).status, 'pendente')

    def test_fotos_exemplo_so_associadas_a_exemplo_reconhecido_sem_sobrescrita(self):
        from seed import importar_fotos_exemplo, exemplos
        importar_fotos_exemplo()
        self.assertEqual(PetMidia.query.count(), 0)
        pet = db.session.get(Pet, 'nina')
        exemplo = next(p for p in exemplos() if p['id'] == 'nina')
        for campo in ('nome', 'especie', 'raca', 'historia'):
            setattr(pet, campo, exemplo[campo])
        db.session.commit(); importar_fotos_exemplo()
        self.assertEqual(PetMidia.query.one().fotos, exemplo['fotos'])
        PetMidia.query.one().fotos = [{'src': 'foto-real-autorizada.jpg'}]
        db.session.commit(); importar_fotos_exemplo()
        self.assertEqual(PetMidia.query.one().fotos, [{'src': 'foto-real-autorizada.jpg'}])

    def test_confirmar_remarcado_revalida_novo_horario(self):
        self.login(); id = self.criar()
        self.client.post(f'/api/agendamentos/{id}/remarcar', json={'data': self.data, 'horario': '15:00'})
        self.login('gerente')
        r = self.client.post(f'/api/gerencia/agendamentos/{id}/confirmar', json={})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json['agendamento']['horario'], '15:00')

    def test_sessao_nao_e_autorizada_por_cookie_de_outro_usuario(self):
        self.login('adotante')
        with self.client.session_transaction() as sessao: sessao['usuario_id'] = 1
        self.assertEqual(self.client.get('/api/gerencia/agendamentos').status_code, 401)

    def test_temporaria_exige_troca_e_revoga_copias_ao_alterar(self):
        gerente = db.session.get(Usuario, 1)
        gerente.set_senha('TemporariaTeste123!', temporaria=True); db.session.commit()
        resposta = self.client.post('/api/auth/login', json={'email': gerente.email, 'senha': 'TemporariaTeste123!'})
        self.assertTrue(resposta.json['usuario']['trocar_senha'])
        copia = self.app.test_client(); copia.set_cookie('session', self.client.get_cookie('session').value)
        self.assertEqual(self.client.get('/api/gerencia/agendamentos').json['codigo'], 'TROCAR_SENHA')
        dados = {'senha_atual': 'TemporariaTeste123!', 'nova_senha': 'NovaSenhaTeste456!', 'confirmacao': 'NovaSenhaTeste456!'}
        self.assertEqual(self.client.post('/api/auth/senha', json={**dados, 'senha_atual': 'errada'}).status_code, 400)
        r = self.client.post('/api/auth/senha', json=dados)
        self.assertEqual(r.status_code, 200); self.assertFalse(r.json['usuario']['trocar_senha'])
        self.assertEqual(self.client.get('/api/gerencia/agendamentos').status_code, 200)
        self.assertEqual(copia.get('/api/gerencia/agendamentos').status_code, 401)
        self.assertFalse(gerente.check_senha('TemporariaTeste123!'))
        self.assertTrue(gerente.check_senha('NovaSenhaTeste456!'))

    def test_temporaria_expira_sem_alterar_hashs_legados(self):
        usuario = db.session.get(Usuario, 1)
        self.assertFalse(usuario.senha_temporaria)
        self.assertTrue(usuario.check_senha('senha-ficticia-testes'))
        usuario.set_senha('TesteTemporaria123!', temporaria=True)
        partes = usuario.senha_hash.split('$', 2)
        usuario.senha_hash = 'temporaria$1$' + partes[2]
        self.assertFalse(usuario.check_senha('TesteTemporaria123!'))

    def test_troca_exige_autenticacao_confirmacao_e_senha_diferente(self):
        self.assertEqual(self.client.post('/api/auth/senha', json={}).status_code, 401)
        self.login()
        for dados in [{}, {'senha_atual': 'senha-ficticia-testes', 'nova_senha': 'senha-ficticia-testes', 'confirmacao': 'senha-ficticia-testes'},
                      {'senha_atual': 'senha-ficticia-testes', 'nova_senha': 'nova', 'confirmacao': 'outra'}]:
            self.assertEqual(self.client.post('/api/auth/senha', json=dados).status_code, 400)


if __name__ == '__main__':
    unittest.main()

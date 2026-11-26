"""Agenda da clínica: autenticação, permissões e persistência em banco isolado."""
import os
from datetime import date, timedelta
import unittest
from unittest.mock import patch

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['SB_AUTO_INIT_DB'] = '0'
os.environ['SECRET_KEY'] = 'chave-exclusiva-de-testes-1234567890'

from app import create_app
from database import db
from models import Usuario, Pet, Agendamento


class ConfigTeste:
    TESTING = True
    SECRET_KEY = 'chave-de-testes'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {}
    AUTO_INIT_DB = False
    GERENTES_IDS = ''


class GerenciaTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app(ConfigTeste)
        self.context = self.app.app_context()
        self.context.push()
        db.create_all()
        self.client = self.app.test_client()
        self.gerente = Usuario(nome='Gerente', email='gerente@example.test',
            telefone='11999999999', tipo_moradia='casa', consentimento=True)
        self.comum = Usuario(nome='Visitante', email='visita@example.test',
            telefone='11888888888', tipo_moradia='casa', consentimento=True)
        for usuario in (self.gerente, self.comum):
            usuario.set_senha('senha-ficticia-testes')
        pet = Pet(id='teste', nome='Pet teste', especie='Gato', sexo='Macho')
        db.session.add_all([self.gerente, self.comum, pet])
        db.session.flush()
        data_visita = date.today() + timedelta(days=10)
        while data_visita.weekday() in {0, 6}:
            data_visita += timedelta(days=1)
        self.visita = Agendamento(usuario_id=self.comum.id, pet_id=pet.id,
            data_visita=data_visita, horario='14:30', mensagem='<script>teste</script>')
        db.session.add(self.visita)
        db.session.commit()
        self.app.config['GERENTES_IDS'] = str(self.gerente.id)
        self.url = f'/api/gerencia/agendamentos/{self.visita.id}/confirmar'

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        self.context.pop()

    def autenticar(self, usuario):
        resposta = self.client.post('/api/auth/login', json={
            'email': usuario.email, 'senha': 'senha-ficticia-testes'})
        self.assertEqual(resposta.status_code, 200)

    def test_apenas_gerentes_leem_e_confirmam(self):
        self.assertEqual(self.client.get('/api/gerencia/agendamentos').status_code, 401)
        self.assertEqual(self.client.post(self.url, json={}).status_code, 401)
        self.autenticar(self.comum)
        self.assertEqual(self.client.get('/api/gerencia/agendamentos').status_code, 403)
        self.assertEqual(self.client.post(self.url, json={'gerente': True}).status_code, 403)
        self.assertEqual(self.visita.status, 'pendente')
        self.autenticar(self.gerente)
        self.assertEqual(self.client.get('/api/gerencia/agendamentos').status_code, 200)
        self.app.config['GERENTES_IDS'] = ''
        self.assertEqual(self.client.post(self.url, json={}).status_code, 403)

    def test_listagem_filtros_paginacao_e_dados_limitados(self):
        self.autenticar(self.gerente)
        resposta = self.client.get('/api/gerencia/agendamentos').json
        item = resposta['agendamentos'][0]
        self.assertEqual(item['solicitante']['email'], self.comum.email)
        self.assertEqual(item['pet_nome'], 'Pet teste')
        self.assertNotIn('senha_hash', str(resposta))
        self.assertEqual(self.client.get('/api/gerencia/agendamentos?status=confirmado').json['total'], 0)
        self.assertEqual(self.client.get('/api/gerencia/agendamentos?data=2000-01-01').json['total'], 0)
        self.assertEqual(self.client.get('/api/gerencia/agendamentos?pagina=2').json['agendamentos'], [])
        for filtro in ('status=qualquer', 'pagina=0', 'pagina=abc', 'data=invalida'):
            self.assertEqual(self.client.get('/api/gerencia/agendamentos?' + filtro).status_code, 400)
        for _ in range(26):
            db.session.add(Agendamento(data_visita=self.visita.data_visita, horario='15:00'))
        db.session.commit()
        self.assertEqual(len(self.client.get('/api/gerencia/agendamentos').json['agendamentos']), 25)
        self.assertEqual(len(self.client.get('/api/gerencia/agendamentos?pagina=2').json['agendamentos']), 2)

    def test_confirmacao_persistente_idempotente(self):
        self.autenticar(self.gerente)
        self.assertEqual(self.client.post(self.url, json={}).status_code, 200)
        db.session.expire_all()
        self.assertEqual(db.session.get(Agendamento, self.visita.id).status, 'confirmado')
        self.assertEqual(self.client.post(self.url, json={}).status_code, 200)
        self.assertEqual(self.client.get('/api/gerencia/agendamentos').json['total'], 0)
        self.assertEqual(self.client.get('/api/gerencia/agendamentos?status=confirmado').json['total'], 1)

    def test_cancelados_passados_inexistentes_e_origem_externa(self):
        self.autenticar(self.gerente)
        self.assertEqual(self.client.post(self.url, json={}, headers={'Origin': 'https://estranho.test'}).status_code, 403)
        self.assertEqual(self.client.post('/api/gerencia/agendamentos/99999/confirmar', json={}).status_code, 404)
        self.visita.status = 'cancelado'
        db.session.commit()
        self.assertEqual(self.client.post(self.url, json={}).status_code, 409)
        self.visita.status = 'pendente'
        self.visita.data_visita = date(2000, 1, 1)
        db.session.commit()
        self.assertEqual(self.client.post(self.url, json={}).status_code, 409)
        self.assertEqual(self.visita.status, 'pendente')

    def test_cadastro_publico_nao_concede_permissao(self):
        resposta = self.client.post('/api/auth/cadastro', json={
            'nome': 'Novo', 'email': 'novo@example.test', 'telefone': '11999999999',
            'senha': 'senha-ficticia-testes', 'consentimento': True,
            'gerente': True, 'GERENTES_IDS': '3', 'id': self.gerente.id,
        })
        self.assertEqual(resposta.status_code, 201)
        self.assertFalse(resposta.json['usuario']['gerente'])
        self.assertEqual(self.client.get('/api/gerencia/agendamentos').status_code, 403)

    def test_login_informa_permissao_e_sessao_excluida_nao_autoriza(self):
        resposta = self.client.post('/api/auth/login', json={
            'email': self.gerente.email, 'senha': 'senha-ficticia-testes'})
        self.assertTrue(resposta.json['usuario']['gerente'])
        self.assertTrue(self.client.get('/api/auth/me').json['usuario']['gerente'])
        with self.client.session_transaction() as sessao:
            sessao['usuario_id'] = 99999
        self.assertEqual(self.client.get('/api/gerencia/agendamentos').status_code, 401)

    def test_falha_de_commit_nao_confirma_nem_expoe_erro(self):
        self.autenticar(self.gerente)
        from sqlalchemy.exc import SQLAlchemyError
        with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('segredo-teste')):
            resposta = self.client.post(self.url, json={})
        self.assertEqual(resposta.status_code, 503)
        self.assertNotIn('segredo-teste', resposta.get_data(as_text=True))
        db.session.expire_all()
        self.assertEqual(self.visita.status, 'pendente')


if __name__ == '__main__':
    unittest.main()

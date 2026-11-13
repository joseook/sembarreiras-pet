"""Regressões com SQLite em memória; nenhuma conexão com bancos remotos."""
import contextlib
import io
import json
import os
from pathlib import Path
import secrets
import sys
import unittest
from unittest.mock import patch

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['SB_AUTO_INIT_DB'] = '0'
os.environ['SECRET_KEY'] = 'chave-aleatoria-exclusiva-dos-testes-123456'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from database import db
from models import Agendamento, Usuario, Pet


class SecurityConfig:
    TESTING = True
    SECRET_KEY = 'chave-exclusiva-dos-testes'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {}
    AUTO_INIT_DB = False


class SecurityTest(unittest.TestCase):
    def setUp(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.app = create_app(SecurityConfig)
        self.context = self.app.app_context()
        self.context.push()
        db.create_all()
        self.client = self.app.test_client()
        self.password = secrets.token_urlsafe(24)
        usuario = Usuario(nome='Pessoa Teste', email='pessoa@example.test',
                          telefone='11912345678', tipo_moradia='casa', consentimento=True)
        usuario.set_senha(self.password)
        db.session.add(usuario)
        db.session.commit()
        self.user_id = usuario.id
        self.visit = {'data': '2026-12-01', 'horario': '14:30', 'mensagem': 'Visita de teste.'}

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        self.context.pop()

    def login(self):
        response = self.client.post('/api/auth/login', json={
            'email': 'pessoa@example.test', 'senha': self.password,
        })
        self.assertEqual(response.status_code, 200)

    def test_chave_publica_ausente_ou_curta_impede_inicializacao(self):
        for chave in ['', None, 'curta', 'sembarreiras-pet-chave-secreta-dev']:
            config = type('ProductionConfig', (SecurityConfig,), {'TESTING': False, 'SECRET_KEY': chave})
            with self.subTest(chave=chave), self.assertRaises(RuntimeError):
                create_app(config)
        config = type('ProductionConfig', (SecurityConfig,), {
            'TESTING': False, 'SECRET_KEY': secrets.token_urlsafe(48),
        })
        self.assertIsNotNone(create_app(config))

    def test_cadastro_exige_consentimento_booleano_explicito(self):
        dados = {'nome': 'Outra Pessoa', 'email': 'outra@example.test',
                 'telefone': '11912345678', 'senha': self.password}
        for extra in [{}, {'consentimento': False}, {'consentimento': 'false'},
                      {'consentimento': 1}, {'consentimento': None}]:
            with self.subTest(extra=extra):
                self.assertEqual(self.client.post('/api/auth/cadastro', json={**dados, **extra}).status_code, 400)
        self.assertEqual(Usuario.query.count(), 1)
        self.assertEqual(self.client.post('/api/auth/cadastro', json={**dados, 'consentimento': True}).status_code, 201)

    def test_visitas_rejeitam_passado_e_usam_brasilia(self):
        from datetime import datetime, timezone
        self.login()
        # 16:00 UTC corresponde a 13:00 em Brasília.
        class Clock(datetime):
            @classmethod
            def now(cls, tz=None):
                return datetime(2030, 1, 2, 16, tzinfo=timezone.utc).astimezone(tz)
        with patch('app.datetime', Clock):
            for data, horario in [('2000-01-01', '03:17'), ('2030-01-02', '12:59'),
                                  ('2030-01-02', '13:00')]:
                with self.subTest(data=data, horario=horario):
                    self.assertEqual(self.client.post('/api/agendamentos', json={
                        'data': data, 'horario': horario,
                    }).status_code, 400)
            self.assertEqual(self.client.post('/api/agendamentos', json={
                'data': '2030-01-02', 'horario': '13:01',
            }).status_code, 201)

    def test_seed_nao_cria_conta_nem_altera_credencial_existente(self):
        from seed import inicializar_banco
        usuario = Usuario.query.one()
        usuario.email = 'admin@sembarreiras.pet'
        db.session.commit()
        senha_hash = usuario.senha_hash
        with contextlib.redirect_stdout(io.StringIO()):
            inicializar_banco(self.app)
        self.assertEqual(Usuario.query.count(), 1)
        self.assertEqual(usuario.senha_hash, senha_hash)
        db.session.delete(usuario)
        db.session.commit()
        with contextlib.redirect_stdout(io.StringIO()):
            inicializar_banco(self.app)
        self.assertEqual(Usuario.query.count(), 0)

    def test_arquivos_privados_bloqueados_inclusive_caminhos_codificados(self):
        for path in ['/app.py', '/config.py', '/.env', '/requirements.txt',
                     '/assets/../app.py', '/assets/..%2fapp.py',
                     '/assets/%2e%2e%2fconfig.py', '/pages/..%2fapp.py',
                     '/assets/..%5capp.py']:
            with self.subTest(path=path), self.client.get(path) as response:
                self.assertEqual(response.status_code, 404)

    def test_arquivos_publicos_continuam_acessiveis(self):
        for path in ['/', '/index.html', '/privacidade', '/privacidade.html',
                     '/config.js', '/assets/css/global.css', '/pages/login.html']:
            with self.subTest(path=path), self.client.get(path) as response:
                self.assertEqual(response.status_code, 200)

    def test_visitante_nao_agenda_nem_informando_usuario_no_corpo(self):
        for extra in [{}, {'usuario_id': self.user_id}]:
            with self.subTest(extra=extra):
                response = self.client.post('/api/agendamentos', json={**self.visit, **extra})
                self.assertEqual(response.status_code, 401)
        self.assertEqual(Agendamento.query.count(), 0)

    def test_identidade_do_agendamento_vem_somente_da_sessao(self):
        self.login()
        response = self.client.post('/api/agendamentos', json={**self.visit, 'usuario_id': 99999})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json['agendamento']['usuario_id'], self.user_id)
        self.assertEqual(Agendamento.query.one().usuario_id, self.user_id)

    def test_sessao_sem_usuario_existente_nao_autoriza(self):
        with self.client.session_transaction() as session:
            session['usuario_id'] = 99999
        self.assertEqual(self.client.post('/api/agendamentos', json=self.visit).status_code, 401)
        self.assertFalse(self.client.get('/api/auth/me').json['autenticado'])

    def test_logout_limpa_sessao_expira_cookie_e_impede_nova_visita(self):
        self.login()
        with self.client.session_transaction() as session:
            session['outra_informacao'] = 'estado-temporario'
        response = self.client.post('/api/auth/logout', json={})
        self.assertEqual(response.status_code, 200)
        with self.client.session_transaction() as session:
            self.assertEqual(dict(session), {})
        self.assertFalse(self.client.get('/api/auth/me').json['autenticado'])
        self.assertEqual(self.client.post('/api/agendamentos', json=self.visit).status_code, 401)
        self.assertIn('Max-Age=0', response.headers.get('Set-Cookie', ''))

    def test_agendamento_rejeita_objetos_json_invalidos_sem_500(self):
        self.login()
        for payload in [[], None, {'data': 42, 'horario': '14:30'},
                        {'data': '2026-12-01', 'horario': []},
                        {**self.visit, 'mensagem': ['texto']}]:
            with self.subTest(payload=payload):
                response = self.client.post('/api/agendamentos', data=json.dumps(payload),
                                            content_type='application/json')
                self.assertEqual(response.status_code, 400)
        self.assertEqual(Agendamento.query.count(), 0)

    def test_agendamento_rejeita_origem_estranha_e_formulario_cross_site(self):
        self.login()
        response = self.client.post('/api/agendamentos', json=self.visit,
                                    headers={'Origin': 'https://outro.example'})
        self.assertEqual(response.status_code, 403)
        response = self.client.post('/api/agendamentos', data=self.visit)
        self.assertEqual(response.status_code, 415)

    def test_ficha_preserva_valores_cadastrados_e_diferencia_saude_nao_informada(self):
        pet = Pet(id='nina', nome='Nina do servidor', especie='Cachorro', sexo='Fêmea',
                  historia='História cadastrada.', vacinas=None, doencas_atuais=None)
        db.session.add(pet)
        db.session.commit()
        response = self.client.get('/api/pets/nina')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['historia'], 'História cadastrada.')
        self.assertIsNone(response.json['vacinas'])
        self.assertIsNone(response.json['doencasAtuais'])
        pet.doencas_atuais = []
        db.session.commit()
        self.assertEqual(self.client.get('/api/pets/nina').json['doencasAtuais'], [])

    def test_erro_de_cadastro_nao_expoe_detalhes_da_conexao(self):
        credencial_ficticia = 'marcador-sensivel-apenas-do-teste'
        with patch.object(db.session, 'commit', side_effect=RuntimeError(credencial_ficticia)):
            response = self.client.post('/api/auth/cadastro', json={
                'nome': 'Outra Pessoa', 'email': 'outra@example.test',
                'telefone': '11912345678', 'senha': self.password, 'consentimento': True,
            })
        self.assertEqual(response.status_code, 500)
        self.assertNotIn(credencial_ficticia, response.get_data(as_text=True))

    def test_seed_nao_imprime_url_nem_senha_em_logs(self):
        from seed import inicializar_banco
        marcador = 'marcador-sensivel-apenas-do-teste'
        output = io.StringIO()
        with patch.dict(self.app.config, {'SQLALCHEMY_DATABASE_URI': marcador}), \
             patch.object(db, 'create_all', side_effect=RuntimeError(marcador)), \
             contextlib.redirect_stdout(output):
            inicializar_banco(self.app)
        self.assertNotIn(marcador, output.getvalue())
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            inicializar_banco(self.app)
        self.assertNotIn('senha1234', output.getvalue())
        self.assertNotIn('sqlite://', output.getvalue())

    def test_autenticacao_rejeita_tipos_invalidos_sem_500(self):
        for endpoint, dados in [('/api/auth/login', {'email': [], 'senha': self.password}),
                                 ('/api/auth/cadastro', {'nome': {}, 'email': 'a@example.test',
                                  'telefone': '11912345678', 'senha': self.password})]:
            with self.subTest(endpoint=endpoint):
                self.assertEqual(self.client.post(endpoint, json=dados).status_code, 400)


if __name__ == '__main__':
    unittest.main()

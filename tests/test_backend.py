import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import unittest
from datetime import date
# Definido antes do import: a aplicação global também fica isolada do banco real.
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['SB_AUTO_INIT_DB'] = '0'
os.environ['SECRET_KEY'] = 'chave-aleatoria-exclusiva-dos-testes-123456'
from app import create_app

from database import db
from models import PoliticaPrivacidade, SecaoPrivacidade, Usuario, Pet, Agendamento
from seed import inicializar_banco

class TestConfig:
    TESTING = True
    SECRET_KEY = 'chave-teste'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {}

class BackendIntegrationTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        inicializar_banco(self.app)

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        self.app_context.pop()

    def test_seed_repetido_preserva_dados_existentes(self):
        politica = PoliticaPrivacidade.query.first()
        secao = SecaoPrivacidade.query.filter_by(politica_id=politica.id, ordem=1).one()
        secao.conteudo = 'Texto revisado pela equipe.'
        nina = db.session.get(Pet, 'nina')
        nina.resumo = 'Resumo revisado pela equipe.'
        db.session.commit()
        contagens = [modelo.query.count() for modelo in
                     (PoliticaPrivacidade, SecaoPrivacidade, Usuario, Pet)]

        self.assertTrue(inicializar_banco(self.app))

        self.assertEqual(contagens, [modelo.query.count() for modelo in
                         (PoliticaPrivacidade, SecaoPrivacidade, Usuario, Pet)])
        self.assertEqual(secao.conteudo, 'Texto revisado pela equipe.')
        self.assertEqual(nina.resumo, 'Resumo revisado pela equipe.')

    def test_status_endpoint(self):
        response = self.client.get('/api/status')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['status'], 'online')
        self.assertTrue(data['banco']['conectado'])
        self.assertIn('usuarios', data['banco']['tabelas'])
        self.assertIn('pets', data['banco']['tabelas'])

    def test_privacidade_endpoint(self):
        response = self.client.get('/api/privacidade')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn('secoes', data)
        self.assertGreaterEqual(len(data['secoes']), 6)

    def test_pets_endpoint(self):
        response = self.client.get('/api/pets')
        self.assertEqual(response.status_code, 200)
        pets = response.get_json()
        self.assertGreaterEqual(len(pets), 1)
        self.assertEqual(pets[0]['id'], 'nina')

    def test_auth_cadastro_e_login(self):
        # Cadastro
        resp_cad = self.client.post('/api/auth/cadastro', json={
            'nome': 'João Silva',
            'email': 'joao@exemplo.com',
            'telefone': '(11) 99999-8888',
            'senha': 'senhaSuperSegura123',
            'tipo_moradia': 'casa', 'consentimento': True
        })
        self.assertEqual(resp_cad.status_code, 201)

        # Login
        resp_login = self.client.post('/api/auth/login', json={
            'email': 'joao@exemplo.com',
            'senha': 'senhaSuperSegura123'
        })
        self.assertEqual(resp_login.status_code, 200)

        # Login com senha errada
        resp_fail = self.client.post('/api/auth/login', json={
            'email': 'joao@exemplo.com',
            'senha': 'senhaErrada'
        })
        self.assertEqual(resp_fail.status_code, 401)

    def test_agendamento_endpoint(self):
        self.client.post('/api/auth/cadastro', json={
            'nome': 'Pessoa Teste', 'email': 'visita@example.test',
            'telefone': '(11) 91234-5678', 'senha': 'CredencialFicticia123!',
            'tipo_moradia': 'casa', 'consentimento': True,
        })
        response = self.client.post('/api/agendamentos', json={
            'pet_id': 'nina',
            'data': '2026-12-01',
            'horario': '14:30',
            'mensagem': 'Gostaria de conhecer a Nina.'
        })
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertIn('agendamento', data)
        self.assertEqual(data['agendamento']['pet_id'], 'nina')

if __name__ == '__main__':
    unittest.main()

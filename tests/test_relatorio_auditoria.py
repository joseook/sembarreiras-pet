"""Regressões do relatório de auditoria (segurança e estabilidade)."""
import json
import os
import unittest
from datetime import date, datetime, timedelta
from pathlib import Path

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['SB_AUTO_INIT_DB'] = '0'
os.environ['SECRET_KEY'] = 'chave-isolada-da-auditoria-1234567890abc'

from app import create_app
from cabecalhos import CABECALHOS_SEGURANCA
from database import db
from models import Usuario, Pet
from regras import BRASILIA, email_valido, problema_senha, validar_visita

RAIZ = Path(__file__).resolve().parent.parent


class ConfigTeste:
    TESTING = True
    SECRET_KEY = 'chave-isolada-auditoria-1234567890abc'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {}
    AUTO_INIT_DB = False
    GERENTES_IDS = ''


def proxima_terca(base):
    dia = base + timedelta(days=1)
    while dia.weekday() != 1:
        dia += timedelta(days=1)
    return dia


class AuditoriaTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app(ConfigTeste)
        self.ctx = self.app.app_context(); self.ctx.push()
        db.create_all()
        u = Usuario(id=1, nome='Vítima', email='vitima@example.test', telefone='11912345678',
                    tipo_moradia='casa', consentimento=True)
        u.set_senha('senha-correta-da-vitima')
        db.session.add(u)
        db.session.add(Pet(id='nina', nome='Nina_100%', especie='Cachorro', sexo='Fêmea', status='disponivel'))
        db.session.add(Pet(id='bob', nome='Bob', especie='Gato', sexo='Macho', status='disponivel'))
        db.session.commit()

    def tearDown(self):
        db.session.remove(); db.drop_all(); self.ctx.pop()

    def test_atacante_nao_trava_conta_de_outra_pessoa(self):
        atacante = self.app.test_client()
        for _ in range(11):
            atacante.post('/api/auth/login', json={'email': 'vitima@example.test', 'senha': 'errada'},
                          environ_base={'REMOTE_ADDR': '10.0.0.66'})
        self.assertEqual(atacante.post('/api/auth/login', json={'email': 'vitima@example.test', 'senha': 'errada'},
                                       environ_base={'REMOTE_ADDR': '10.0.0.66'}).status_code, 429)
        vitima = self.app.test_client().post('/api/auth/login',
            json={'email': 'vitima@example.test', 'senha': 'senha-correta-da-vitima'},
            environ_base={'REMOTE_ADDR': '10.0.0.7'})
        self.assertEqual(vitima.status_code, 200)

    def test_cabecalhos_de_seguranca_e_sincronia_com_vercel(self):
        resposta = self.app.test_client().get('/api/auth/me')
        for nome in ('Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy'):
            self.assertIn(nome, resposta.headers)
        vercel = json.loads((RAIZ / 'vercel.json').read_text())
        configurados = {h['key']: h['value'] for bloco in vercel['headers'] for h in bloco['headers']}
        self.assertEqual(configurados, CABECALHOS_SEGURANCA)

    def test_data_de_visita_tem_janela_maxima(self):
        agora = datetime(2026, 11, 26, 10, tzinfo=BRASILIA)
        validar_visita(proxima_terca(date(2026, 11, 26)).isoformat(), '10:00', agora)
        with self.assertRaises(ValueError):
            validar_visita('9999-12-28', '10:00', agora)
        with self.assertRaises(ValueError):
            validar_visita(proxima_terca(date(2027, 3, 1)).isoformat(), '10:00', agora)

    def test_senhas_fracas_e_email_sem_tld(self):
        for fraca in (' ' * 8, '12345678', 'aaaaaaaa', 'Password'):
            self.assertIsNotNone(problema_senha(fraca), fraca)
        self.assertIsNone(problema_senha('cachorro-caramelo-7'))
        self.assertFalse(email_valido('a@b.c'))
        self.assertTrue(email_valido('pessoa@exemplo.com.br'))
        r = self.app.test_client().post('/api/auth/cadastro', json={
            'nome': 'Ana', 'email': 'ana@example.test', 'telefone': '11912345678',
            'senha': '12345678', 'consentimento': True})
        self.assertEqual(r.status_code, 400)
        self.assertIn('senha', r.json['campos'])

    def test_cadastro_duplicado_aponta_campo_email(self):
        r = self.app.test_client().post('/api/auth/cadastro', json={
            'nome': 'Outra', 'email': 'vitima@example.test', 'telefone': '11912345678',
            'senha': 'cachorro-caramelo-7', 'consentimento': True})
        self.assertEqual(r.status_code, 409)
        self.assertIn('email', r.json['campos'])

    def test_curingas_da_busca_sao_literais(self):
        cliente = self.app.test_client()
        self.assertEqual(cliente.get('/api/pets?q=%25').json and len(cliente.get('/api/pets?q=%25').json), 1)
        self.assertEqual(len(cliente.get('/api/pets?q=_').json), 1)
        self.assertEqual(len(cliente.get('/api/pets?q=B').json), 1)

    def test_contato_ignora_espacos_no_minimo(self):
        r = self.app.test_client().post('/api/contato', json={
            'nome': 'Ana', 'email': 'ana@example.test', 'assunto': 'outro', 'mensagem': 'a         b'})
        self.assertEqual(r.status_code, 400)


if __name__ == '__main__':
    unittest.main()

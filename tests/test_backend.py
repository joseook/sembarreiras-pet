"""Regressões de autenticação, persistência, autorização e publicação."""
import os
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import contextlib
import io
import json
import fnmatch
import unittest
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from unittest.mock import patch
from sqlalchemy.exc import OperationalError
from app import create_app
from database import db
from models import Usuario, Pet, Agendamento, MensagemContato
from seed import inicializar_banco

class TestConfig:
    TESTING = True
    SECRET_KEY = 'chave-teste-local'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {}

class BackendIntegrationTest(unittest.TestCase):
    def setUp(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()
        self.cadastro = dict(nome='Teste Auditoria', email='teste@example.test',
                             telefone='(11) 91234-5678', senha='FicticiaParaTeste123!',
                             tipo_moradia='casa', consentimento=True)
        futuro = datetime.now(ZoneInfo('America/Sao_Paulo')).date() + timedelta(days=7)
        while futuro.weekday() not in {1,2,3,4,5}:
            futuro += timedelta(days=1)
        self.visita = dict(data=futuro.isoformat(), horario='14:00', mensagem='Conhecer a Nina.', pet_id='nina')

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def entrar(self):
        resposta = self.client.post('/api/auth/cadastro', json=self.cadastro)
        self.assertEqual(resposta.status_code, 201)
        return resposta.get_json()['usuario']['id']

    def test_status_nao_expoe_detalhes(self):
        r = self.client.get('/api/status')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json['banco'], {'conectado': True})
        self.assertEqual(r.headers['Cache-Control'], 'no-store')

    def test_privacidade(self):
        self.assertGreaterEqual(len(self.client.get('/api/privacidade').json['secoes']), 6)

    def test_quatro_pets_com_contrato_da_ficha(self):
        pets = self.client.get('/api/pets').json
        self.assertEqual({p['id'] for p in pets}, {'nina','simba','bento','mel'})
        for pet in pets:
            self.assertTrue({'fotos','convive','etiquetas','energia','abrigo','cuidados','alimentacao'} <= pet.keys())
        self.assertTrue(all(p['especie']=='Gato' for p in self.client.get('/api/pets?especie=Gato').json))
        self.assertEqual(self.client.get('/api/pets/inexistente').status_code, 404)

    def test_cadastro_persiste_hash_inicia_sessao_e_normaliza_email(self):
        self.cadastro['email']='TESTE@example.test'
        usuario_id=self.entrar()
        usuario=db.session.get(Usuario, usuario_id)
        self.assertEqual(usuario.email,'teste@example.test')
        self.assertNotEqual(usuario.senha_hash,self.cadastro['senha'])
        self.assertTrue(usuario.check_senha(self.cadastro['senha']))
        self.assertNotIn('senha',self.client.get('/api/auth/me').json['usuario'])
        self.assertTrue(self.client.get('/api/auth/me').json['autenticado'])
        self.assertEqual(self.client.post('/api/auth/cadastro',json=self.cadastro).status_code,409)

    def test_login_errado_remove_sessao_anterior_e_logout(self):
        self.entrar()
        r=self.client.post('/api/auth/login',json={'email':self.cadastro['email'],'senha':'errada'})
        self.assertEqual(r.status_code,401)
        self.assertFalse(self.client.get('/api/auth/me').json['autenticado'])
        self.assertEqual(self.client.post('/api/auth/login',json=self.cadastro).status_code,200)
        self.assertEqual(self.client.post('/api/auth/logout',json={}).status_code,200)
        self.assertFalse(self.client.get('/api/auth/me').json['autenticado'])

    def test_sessao_nao_e_compartilhada_por_outro_navegador(self):
        self.entrar()
        self.assertFalse(self.app.test_client().get('/api/auth/me').json['autenticado'])

    def test_cadastro_rejeita_dados_invalidos(self):
        for alteracao in [
            {'nome':' '},{'email':'invalido'},{'telefone':'x'},{'senha':'curta'},
            {'tipo_moradia':'invalida'},{'consentimento':False},{'consentimento':'true'},
            {'email':[]},{'nome':1},{'senha':['12345678']},{'senha':'x'*129},
        ]:
            with self.subTest(alteracao=alteracao):
                self.assertEqual(self.client.post('/api/auth/cadastro',json={**self.cadastro,**alteracao}).status_code,400)
        self.assertEqual(Usuario.query.count(),0)

    def test_agendamento_exige_sessao_mesmo_com_usuario_no_corpo(self):
        for extras in [{},{'usuario_id':1}]:
            self.assertEqual(self.client.post('/api/agendamentos',json={**self.visita,**extras}).status_code,401)
        self.assertEqual(Agendamento.query.count(),0)

    def test_agendamento_usa_identidade_do_servidor_e_persiste_pet(self):
        usuario_id=self.entrar()
        r=self.client.post('/api/agendamentos',json={**self.visita,'usuario_id':999})
        self.assertEqual(r.status_code,201)
        agendamento=db.session.get(Agendamento,r.json['agendamento']['id'])
        self.assertEqual(agendamento.usuario_id,usuario_id)
        self.assertEqual(agendamento.pet_id,'nina')
        self.assertEqual(agendamento.status,'pendente')

    def test_agendamento_rejeita_dados_invalidos(self):
        self.entrar()
        for alteracao in [
            {'data':'2020-01-01'},{'data':42},{'data':'2026-99-99'},
            {'horario':'99:99'},{'horario':[]},{'mensagem':'x'*1001},{'mensagem':False},
        ]:
            with self.subTest(alteracao=alteracao):
                self.assertEqual(self.client.post('/api/agendamentos',json={**self.visita,**alteracao}).status_code,400)
        self.assertEqual(self.client.post('/api/agendamentos',json={**self.visita,'pet_id':'inexistente'}).status_code,404)
        self.assertEqual(Agendamento.query.count(),0)

    def test_nao_agenda_domingos_ou_segundas(self):
        self.entrar()
        data=datetime.now(ZoneInfo('America/Sao_Paulo')).date()+timedelta(days=7)
        while data.weekday()!=6:
            data+=timedelta(days=1)
        for dia in [data,data+timedelta(days=1)]:
            self.assertEqual(self.client.post('/api/agendamentos',json={**self.visita,'data':dia.isoformat()}).status_code,400)

    def test_pet_adotado_nao_aceita_visita(self):
        self.entrar()
        db.session.get(Pet,'nina').status='adotado'
        db.session.commit()
        self.assertEqual(self.client.post('/api/agendamentos',json=self.visita).status_code,409)

    def test_contato_persiste_sem_criar_usuario(self):
        dados=dict(nome='Pessoa Teste',email='contato@example.test',assunto='adocao',mensagem='Gostaria de informações sobre adoção.')
        r=self.client.post('/api/contato',json=dados)
        self.assertEqual(r.status_code,201)
        registro=db.session.get(MensagemContato,r.json['protocolo'])
        self.assertEqual(registro.mensagem,dados['mensagem'])
        self.assertEqual(Usuario.query.count(),0)
        self.assertFalse(self.client.get('/api/auth/me').json['autenticado'])
        self.assertEqual(self.client.post('/api/contato',json={**dados,'mensagem':'curta'}).status_code,400)

    def test_json_malformado_e_tipos_errados_nao_geram_500(self):
        for body in ['[]','null','{"nome":', '"texto"']:
            self.assertEqual(self.client.post('/api/auth/cadastro',data=body,content_type='application/json').status_code,400)
        self.assertEqual(self.client.post('/api/contato',data={'nome':'x'}).status_code,415)

    def test_bloqueia_origem_externa_e_permite_mesma_origem(self):
        r=self.client.post('/api/auth/cadastro',json=self.cadastro,headers={'Origin':'https://outro.example'})
        self.assertEqual(r.status_code,403)
        self.assertNotIn('Access-Control-Allow-Origin',r.headers)
        self.assertEqual(self.client.post('/api/auth/cadastro',json=self.cadastro,headers={'Origin':'http://localhost'}).status_code,201)

    def test_arquivos_privados_nao_podem_ser_baixados(self):
        for path in ['/app.py','/.env','/data/pets.json','/assets/../app.py',
                     '/assets/..%2fapp.py','/pages/..%2fapp.py','/assets/..%5capp.py','/assets/%2e%2e%2f.env']:
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code,404)
        for path in ['/assets/css/global.css', '/pages/login.html']:
            with self.client.get(path) as response:
                self.assertEqual(response.status_code, 200)

    def test_erros_do_banco_nao_expoem_sql_ou_conexao(self):
        with patch.object(db.session,'commit',side_effect=OperationalError('INSERT interno',{},Exception('segredo-interno'))):
            r=self.client.post('/api/auth/cadastro',json=self.cadastro)
        self.assertEqual(r.status_code,503)
        self.assertNotIn('segredo-interno',r.get_data(as_text=True))
        self.assertEqual(Usuario.query.count(),0)

    def test_seed_preserva_dados_e_nao_cria_conta_publica(self):
        self.assertEqual(Usuario.query.count(),0)
        nina=db.session.get(Pet,'nina')
        nina.nome='Nome atualizado pela equipe'
        db.session.commit()
        with contextlib.redirect_stdout(io.StringIO()) as output:
            inicializar_banco(self.app)
        self.assertEqual(db.session.get(Pet,'nina').nome,'Nome atualizado pela equipe')
        self.assertNotIn('sqlite:',output.getvalue())
        self.assertEqual(Usuario.query.count(),0)

    def test_senha_publica_legada_e_revogada_sem_apagar_conta(self):
        legado=Usuario(nome='Teste Legado',email='admin@sembarreiras.pet',telefone='11912345678',tipo_moradia='casa',consentimento=True)
        legado.set_senha('senha1234')
        db.session.add(legado)
        db.session.commit()
        usuario_id=legado.id
        with contextlib.redirect_stdout(io.StringIO()):
            inicializar_banco(self.app)
        db.session.expire_all()
        self.assertFalse(db.session.get(Usuario,usuario_id).check_senha('senha1234'))

    def test_producao_recusa_configuracao_insegura_antes_de_conectar(self):
        class Producao(TestConfig):
            PRODUCTION = True
        for chave, url in [(None, 'sqlite:///:memory:'),
                           ('sembarreiras-pet-chave-secreta-dev', 'postgresql://localhost/teste'),
                           ('x' * 64, 'sqlite:///:memory:')]:
            Producao.SECRET_KEY = chave
            Producao.SQLALCHEMY_DATABASE_URI = url
            with self.subTest(chave_ausente=chave is None, banco=url.split(':')[0]):
                with self.assertRaises(RuntimeError):
                    create_app(Producao)

    def test_vercel_publica_somente_arquivos_da_lista(self):
        config = json.loads((ROOT / 'vercel.json').read_text(encoding='utf-8-sig'))
        publicos = [build['src'] for build in config['builds'] if build['use'] == '@vercel/static']
        for privado in ['app.py', '.env', 'data/pets.json', 'tests/test_backend.py', 'sembarreiras.db']:
            self.assertFalse(any(fnmatch.fnmatch(privado, pattern) for pattern in publicos))
        self.assertTrue(any(fnmatch.fnmatch('assets/js/modules/api.js', pattern) for pattern in publicos))
        self.assertIn({'source': '/api/(.*)', 'destination': '/api/index.py'}, config['rewrites'])

if __name__=='__main__':
    unittest.main()

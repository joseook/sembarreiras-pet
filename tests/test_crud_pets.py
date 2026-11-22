"""CRUD real, histórico e validações do formulário de pets em banco isolado."""
import os
import sys
from pathlib import Path
from datetime import date, timedelta
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['SB_AUTO_INIT_DB'] = '0'
os.environ['SECRET_KEY'] = 'chave-exclusiva-dos-testes-crud-1234567890'
from app import create_app
from database import db
from models import Usuario, Pet, PetMidia, Agendamento


class ConfigTeste:
    TESTING = True
    SECRET_KEY = 'chave-de-testes-crud'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {}
    AUTO_INIT_DB = False
    GERENTES_IDS = '1'


class CrudPetsTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app(ConfigTeste); self.ctx = self.app.app_context(); self.ctx.push()
        db.create_all(); self.client = self.app.test_client()
        for id, nome in [(1, 'gerente'), (2, 'adotante')]:
            pessoa = Usuario(id=id, nome=nome, email=nome+'@example.test', telefone='11999999999', tipo_moradia='casa', consentimento=True)
            pessoa.set_senha('SenhaFicticiaTeste123!'); db.session.add(pessoa)
        db.session.commit()
        self.dados = {'nome': 'Pet de teste', 'especie': 'Gato', 'sexo': 'Fêmea', 'porte': 'Pequeno',
            'castrado': None, 'microchip': None, 'historia': 'História cadastrada.',
            'temperamento': ['Calmo'], 'fotos': [{'src': '../assets/img/pets/nina.jpg', 'alt': 'Foto de teste'}]}

    def tearDown(self):
        db.session.remove(); db.drop_all(); db.engine.dispose(); self.ctx.pop()

    def login(self, nome='gerente'):
        self.assertEqual(self.client.post('/api/auth/login', json={'email': nome+'@example.test', 'senha': 'SenhaFicticiaTeste123!'}).status_code, 200)

    def criar(self):
        r = self.client.post('/api/gerencia/pets', json=self.dados)
        self.assertEqual(r.status_code, 201, r.json)
        return r.json['pet']['id']

    def test_crud_completo_e_exclusao_fisica_da_midia(self):
        self.login(); id = self.criar()
        self.assertLessEqual(len(id), 50)
        self.assertTrue(id.startswith('pet-de-teste-'))
        r = self.client.get('/api/gerencia/pets/'+id)
        self.assertEqual(r.json['pet']['nome'], self.dados['nome'])
        self.assertIsNone(r.json['pet']['castrado'])
        self.assertIsNone(r.json['pet']['vacinas'])
        self.assertEqual(r.json['pet']['fotos'], self.dados['fotos'])
        r = self.client.put('/api/gerencia/pets/'+id, json={'nome': 'Nome editado', 'castrado': True})
        self.assertEqual(r.status_code, 200); self.assertEqual(r.json['pet']['id'], id)
        self.assertTrue(self.client.get('/api/pets/'+id).json['castrado'])
        self.assertEqual(self.client.delete('/api/gerencia/pets/'+id, json={}).status_code, 200)
        self.assertIsNone(db.session.get(Pet, id)); self.assertIsNone(db.session.get(PetMidia, id))
        self.assertEqual(self.client.get('/api/pets/'+id).status_code, 404)

    def test_visitante_e_adotante_nao_gerenciam_pets(self):
        for autenticado, esperado in [(False, 401), (True, 403)]:
            if autenticado: self.login('adotante')
            for metodo, url, dados in [('get', '/api/gerencia/pets', None), ('get', '/api/gerencia/pets/nina', None),
                ('post', '/api/gerencia/pets', self.dados), ('put', '/api/gerencia/pets/nina', self.dados), ('delete', '/api/gerencia/pets/nina', {})]:
                r = getattr(self.client, metodo)(url, **({'json': dados} if dados is not None else {}))
                self.assertEqual(r.status_code, esperado)
        self.assertEqual(Pet.query.count(), 0)

    def test_filtros_busca_paginacao_e_catalogo_publico(self):
        self.login(); id = self.criar()
        for n in range(14):
            db.session.add(Pet(id='outro-'+str(n), nome='Outro '+str(n), especie='Cachorro', sexo='Macho', status='disponivel'))
        db.session.add(Pet(id='arquivado', nome='Antigo', especie='Gato', sexo='Fêmea', status='arquivado'))
        db.session.commit()
        self.assertEqual(self.client.get('/api/gerencia/pets').json['total'], 16)
        self.assertEqual(len(self.client.get('/api/gerencia/pets').json['pets']), 12)
        self.assertEqual(len(self.client.get('/api/gerencia/pets?pagina=2').json['pets']), 4)
        self.assertEqual(self.client.get('/api/gerencia/pets?q=Pet%20de%20teste').json['pets'][0]['id'], id)
        self.assertEqual(self.client.get('/api/gerencia/pets?status=arquivado').json['total'], 1)
        self.assertEqual(len(self.client.get('/api/pets?q=Pet%20de%20teste&porte=Pequeno&especie=Gato').json), 1)
        self.assertTrue(all(p['status'] != 'arquivado' for p in self.client.get('/api/pets').json))
        self.assertEqual(self.client.get('/api/pets/arquivado').status_code, 410)
        for filtro in ['pagina=0', 'pagina=abc', 'status=errado', 'q='+'x'*121]:
            self.assertEqual(self.client.get('/api/gerencia/pets?'+filtro).status_code, 400)

    def test_campos_invalidos_nao_criam_registros(self):
        self.login()
        for dados in [None, [], {}, {**self.dados, 'nome': ''}, {**self.dados, 'nome': 'x'*101},
                      {**self.dados, 'especie': []}, {**self.dados, 'sexo': 'outro'},
                      {**self.dados, 'castrado': 'true'}, {**self.dados, 'status': 'errado'},
                      {**self.dados, 'temperamento': ['a'*51]}, {**self.dados, 'id': 'manual'}]:
            with self.subTest(dados=dados):
                r = self.client.post('/api/gerencia/pets', json=dados) if dados is not None else self.client.post('/api/gerencia/pets', data='null', content_type='application/json')
                self.assertEqual(r.status_code, 400)
                self.assertIn('campos', r.json)
        self.assertEqual(Pet.query.count(), 0)

    def test_fotos_validacao_edicao_e_remocao(self):
        self.login(); id = self.criar()
        for fotos in [[{'src': 'javascript:alert(1)', 'alt': 'Teste'}], [{'src': 'https://example.test/a.jpg', 'alt': ''}],
                      ['errado'], [{'src': '/assets/img/../../.env', 'alt': 'Teste'}], self.dados['fotos']*7]:
            self.assertEqual(self.client.put('/api/gerencia/pets/'+id, json={'fotos': fotos}).status_code, 400)
        fotos = [{'src': 'https://example.test/pet.jpg', 'alt': 'Foto descrita'}]
        self.assertEqual(self.client.put('/api/gerencia/pets/'+id, json={'fotos': fotos}).json['pet']['fotos'], fotos)
        self.assertEqual(self.client.put('/api/gerencia/pets/'+id, json={'fotos': []}).json['pet']['fotos'], [])

    def test_historico_impede_delete_e_arquivamento_preserva_vinculos(self):
        self.login(); id = self.criar()
        visita = Agendamento(pet_id=id, usuario_id=2, data_visita=date(2020, 1, 1), horario='14:00', status='cancelado')
        db.session.add(visita); db.session.commit(); visita_id = visita.id
        r = self.client.delete('/api/gerencia/pets/'+id, json={})
        self.assertEqual(r.status_code, 409); self.assertTrue(r.json['possui_agendamentos'])
        self.assertEqual(self.client.put('/api/gerencia/pets/'+id, json={'status': 'arquivado'}).status_code, 200)
        self.assertEqual(db.session.get(Agendamento, visita_id).pet_id, id)
        self.assertEqual(self.client.get('/api/pets/'+id).status_code, 410)
        self.assertEqual(self.client.put('/api/gerencia/pets/'+id, json={'status': 'disponivel'}).status_code, 200)
        self.assertEqual(self.client.get('/api/pets/'+id).status_code, 200)

    def test_visitas_ativas_precisam_ser_resolvidas_antes_de_mudar_disponibilidade(self):
        self.login(); id = self.criar()
        visita = Agendamento(pet_id=id, usuario_id=2, data_visita=date.today()+timedelta(days=10), horario='14:00', status='confirmado')
        db.session.add(visita); db.session.commit()
        for status in ['arquivado', 'adotado', 'em-adocao']:
            self.assertEqual(self.client.put('/api/gerencia/pets/'+id, json={'status': status}).status_code, 409)
        self.assertEqual(self.client.put('/api/gerencia/pets/'+id, json={'nome': 'Nome novo'}).status_code, 200)
        visita.status = 'cancelado'; db.session.commit()
        self.assertEqual(self.client.put('/api/gerencia/pets/'+id, json={'status': 'adotado'}).status_code, 200)

    def test_editar_preserva_dados_clinicos_omitidos_e_outros_pets(self):
        self.login(); id = self.criar()
        pet = db.session.get(Pet, id); pet.vacinas = [{'nome': 'Vacina cadastrada', 'status': 'em-dia'}]
        db.session.add(Pet(id='outro', nome='Outro', especie='Gato', sexo='Macho')); db.session.commit()
        self.client.put('/api/gerencia/pets/'+id, json={'historia': 'História revisada.'})
        self.assertEqual(db.session.get(Pet, id).vacinas[0]['nome'], 'Vacina cadastrada')
        self.assertEqual(db.session.get(Pet, 'outro').nome, 'Outro')
        for metodo in ['get', 'put', 'delete']:
            r = getattr(self.client, metodo)('/api/gerencia/pets/inexistente', **({'json': {'nome': 'Nome'}} if metodo == 'put' else {'json': {}} if metodo == 'delete' else {}))
            self.assertEqual(r.status_code, 404)


if __name__ == '__main__': unittest.main()

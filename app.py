"""API e páginas do Sem Barreiras Pet."""
from datetime import datetime
from pathlib import Path
import re
from zoneinfo import ZoneInfo
from flask import Flask, abort, jsonify, request, send_from_directory, session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from werkzeug.exceptions import HTTPException
from config import Config
from database import db
from models import Agendamento, MensagemContato, Pet, PoliticaPrivacidade, Usuario

ROOT = Path(__file__).resolve().parent
HORARIOS = {'09:00', '10:00', '11:00', '13:00', '14:00', '15:00'}
EMAIL = re.compile(r'[^\s@]+@[^\s@]+\.[^\s@]+')
FUSO = ZoneInfo('America/Sao_Paulo')

def create_app(config_class=Config):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_class)
    if not app.config.get('SECRET_KEY') or not app.config.get('SQLALCHEMY_DATABASE_URI'):
        raise RuntimeError('Configure SECRET_KEY e DATABASE_URL para executar em produção.')
    if app.config.get('PRODUCTION'):
        chave = app.config['SECRET_KEY']
        if len(chave) < 32 or chave == 'sembarreiras-pet-chave-secreta-dev':
            raise RuntimeError('Configure uma SECRET_KEY aleatória de pelo menos 32 caracteres.')
        if not app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgresql'):
            raise RuntimeError('Configure PostgreSQL persistente em produção.')
    db.init_app(app)
    with app.app_context():
        from seed import inicializar_banco
        if not inicializar_banco(app):
            app.logger.error('Banco indisponível na inicialização.')

    def erro(texto, status=400):
        return jsonify(erro=texto), status

    def dados_json():
        dados = request.get_json(silent=True)
        if not isinstance(dados, dict):
            abort(400, description='Envie um objeto JSON válido.')
        return dados

    def texto(dados, nome, limite, obrigatorio=True):
        valor = dados.get(nome, '')
        if not isinstance(valor, str):
            abort(400, description=f'Campo {nome} inválido.')
        valor = valor.strip()
        if (obrigatorio and not valor) or len(valor) > limite:
            abort(400, description=f'Confira o campo {nome} (máximo de {limite} caracteres).')
        return valor

    def usuario_da_sessao():
        usuario_id = session.get('usuario_id')
        usuario = db.session.get(Usuario, usuario_id) if isinstance(usuario_id, int) else None
        if usuario is None:
            session.clear()
        return usuario

    @app.before_request
    def proteger_origem():
        if not request.path.startswith('/api/'):
            return
        origem = request.headers.get('Origin')
        permitidas = {request.host_url.rstrip('/')}
        if app.config.get('FRONTEND_ORIGIN'):
            permitidas.add(app.config['FRONTEND_ORIGIN'])
        if origem and origem not in permitidas:
            return erro('Origem não autorizada.', 403)
        if request.method in {'POST', 'PUT', 'PATCH', 'DELETE'} and not request.is_json:
            return erro('Use Content-Type application/json.', 415)

    @app.after_request
    def cabecalhos(resposta):
        resposta.headers['X-Content-Type-Options'] = 'nosniff'
        resposta.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        if request.path.startswith('/api/'):
            resposta.headers['Cache-Control'] = 'no-store'
        origem = request.headers.get('Origin')
        if origem and origem == app.config.get('FRONTEND_ORIGIN'):
            resposta.headers['Access-Control-Allow-Origin'] = origem
            resposta.headers['Access-Control-Allow-Credentials'] = 'true'
            resposta.headers['Access-Control-Allow-Headers'] = 'Content-Type'
            resposta.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
            resposta.vary.add('Origin')
        return resposta

    @app.errorhandler(HTTPException)
    def erro_http(exc):
        if request.path.startswith('/api/'):
            return erro(exc.description, exc.code)
        return exc

    @app.errorhandler(SQLAlchemyError)
    def erro_banco(exc):
        db.session.rollback()
        app.logger.error('Falha de banco em %s (%s).', request.path, type(exc).__name__)
        return erro('Serviço temporariamente indisponível. Tente novamente.', 503)

    @app.route('/')
    def home():
        return send_from_directory(ROOT, 'index.html')

    @app.route('/privacidade')
    def privacidade():
        return send_from_directory(ROOT, 'privacidade.html')

    @app.route('/assets/<path:filename>')
    def assets(filename):
        return send_from_directory(ROOT / 'assets', filename)

    @app.route('/pages/<path:filename>')
    def pages(filename):
        if '/' in filename or '\\' in filename or not filename.endswith('.html'):
            abort(404)
        return send_from_directory(ROOT / 'pages', filename)

    @app.route('/<filename>')
    def arquivo_raiz(filename):
        if filename not in {'config.js', 'privacidade.html', 'index.html'}:
            abort(404)
        return send_from_directory(ROOT, filename)

    @app.get('/api/status')
    def status():
        db.session.execute(db.text('SELECT 1'))
        return jsonify(status='online', banco={'conectado': True})

    @app.get('/api/privacidade')
    def politica():
        politica = PoliticaPrivacidade.query.filter_by(ativo=True).order_by(PoliticaPrivacidade.id.desc()).first()
        return jsonify(politica.to_dict()) if politica else erro('Política não encontrada.', 404)

    @app.get('/api/pets')
    def listar_pets():
        query = Pet.query
        for campo in ('especie', 'porte'):
            valor = request.args.get(campo)
            if valor:
                query = query.filter(getattr(Pet, campo).ilike(f'%{valor}%'))
        return jsonify([pet.to_dict() for pet in query.all()])

    @app.get('/api/pets/<pet_id>')
    def obter_pet(pet_id):
        pet = db.session.get(Pet, pet_id)
        return jsonify(pet.to_dict()) if pet else erro('Pet não encontrado.', 404)

    @app.post('/api/auth/cadastro')
    def cadastrar_usuario():
        dados = dados_json()
        nome = texto(dados, 'nome', 120)
        email = texto(dados, 'email', 120).lower()
        telefone = texto(dados, 'telefone', 30)
        senha = dados.get('senha')
        moradia = dados.get('tipo_moradia')
        if len(nome.split()) < 2 or not EMAIL.fullmatch(email):
            return erro('Informe nome completo e e-mail válido.')
        if not re.fullmatch(r'[0-9()\s+.-]+', telefone) or len(re.sub(r'\D', '', telefone)) not in {10, 11}:
            return erro('Informe telefone com DDD.')
        if not isinstance(senha, str) or not 8 <= len(senha) <= 128:
            return erro('A senha deve conter de 8 a 128 caracteres.')
        if moradia not in {'casa', 'apartamento'} or dados.get('consentimento') is not True:
            return erro('Escolha a moradia e aceite a política de privacidade.')
        if Usuario.query.filter_by(email=email).first():
            return erro('Este e-mail já está cadastrado.', 409)
        usuario = Usuario(nome=nome, email=email, telefone=telefone, tipo_moradia=moradia, consentimento=True)
        usuario.set_senha(senha)
        db.session.add(usuario)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return erro('Este e-mail já está cadastrado.', 409)
        session.clear()
        session['usuario_id'] = usuario.id
        return jsonify(mensagem='Conta criada com sucesso!', usuario=usuario.to_dict()), 201

    @app.post('/api/auth/login')
    def login_usuario():
        # Uma tentativa de acesso substitui a sessão anterior, inclusive se falhar.
        session.clear()
        dados = dados_json()
        email = texto(dados, 'email', 120).lower()
        senha = dados.get('senha')
        if not isinstance(senha, str) or not 1 <= len(senha) <= 128:
            return erro('Informe a senha.')
        usuario = Usuario.query.filter_by(email=email).first()
        if not usuario or not usuario.check_senha(senha):
            return erro('Credenciais inválidas. Verifique seu e-mail e senha.', 401)
        session['usuario_id'] = usuario.id
        return jsonify(mensagem='Login realizado com sucesso!', usuario=usuario.to_dict())

    @app.get('/api/auth/me')
    def usuario_atual():
        usuario = usuario_da_sessao()
        return jsonify(autenticado=True, usuario=usuario.to_dict()) if usuario else jsonify(autenticado=False)

    @app.post('/api/auth/logout')
    def logout_usuario():
        session.clear()
        return jsonify(mensagem='Sessão encerrada.')

    @app.post('/api/agendamentos')
    def criar_agendamento():
        usuario = usuario_da_sessao()
        if not usuario:
            return erro('Entre na sua conta para solicitar uma visita.', 401)
        dados = dados_json()
        data_str = texto(dados, 'data', 10)
        horario = texto(dados, 'horario', 5)
        mensagem = texto(dados, 'mensagem', 1000, obrigatorio=False)
        pet_id = dados.get('pet_id')
        if pet_id is not None:
            if not isinstance(pet_id, str):
                return erro('Escolha um pet disponível no catálogo.', 404)
            pet = db.session.get(Pet, pet_id)
            if pet is None:
                return erro('Escolha um pet disponível no catálogo.', 404)
            if pet.status != 'disponivel':
                return erro('Este pet não está disponível para visita.', 409)
        if horario not in HORARIOS:
            return erro('Escolha um dos horários de visita disponíveis.')
        try:
            momento = datetime.strptime(f'{data_str} {horario}', '%Y-%m-%d %H:%M').replace(tzinfo=FUSO)
        except ValueError:
            return erro('Data inválida. Use AAAA-MM-DD.')
        if momento <= datetime.now(FUSO) or momento.weekday() not in {1, 2, 3, 4, 5}:
            return erro('Escolha uma data futura, de terça a sábado.')
        agendamento = Agendamento(usuario_id=usuario.id, pet_id=pet_id, data_visita=momento.date(), horario=horario, mensagem=mensagem or None)
        db.session.add(agendamento)
        db.session.commit()
        return jsonify(mensagem='Solicitação registrada. Aguarde a confirmação da visita.', agendamento=agendamento.to_dict()), 201

    @app.post('/api/contato')
    def contato():
        dados = dados_json()
        nome = texto(dados, 'nome', 100)
        email = texto(dados, 'email', 120).lower()
        assunto = texto(dados, 'assunto', 30)
        mensagem = texto(dados, 'mensagem', 2000)
        if not EMAIL.fullmatch(email) or assunto not in {'adocao', 'parceria', 'acessibilidade', 'sugestao', 'outro'} or len(mensagem) < 10:
            return erro('Confira o e-mail, o assunto e a mensagem (mínimo de 10 caracteres).')
        contato = MensagemContato(nome=nome, email=email, assunto=assunto, mensagem=mensagem)
        db.session.add(contato)
        db.session.commit()
        return jsonify(mensagem='Sua mensagem foi registrada com sucesso!', protocolo=contato.id), 201

    @app.cli.command('init-db')
    def init_db():
        from seed import inicializar_banco
        inicializar_banco(app)

    return app

app = create_app()
if __name__ == '__main__':
    app.run(port=5000)

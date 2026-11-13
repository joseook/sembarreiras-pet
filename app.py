"""Servidor Flask com suporte a PostgreSQL e rotas estáticas para o Sem Barreiras Pet."""
import os
from pathlib import Path
from datetime import datetime, timedelta, timezone
from flask import Flask, send_from_directory, request, jsonify, session, abort
from sqlalchemy.exc import SQLAlchemyError
from config import Config
from database import db
from models import PoliticaPrivacidade, SecaoPrivacidade, Usuario, Pet, Agendamento

ROOT = Path(__file__).resolve().parent

def create_app(config_class=Config):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_class)

    chave = app.config.get('SECRET_KEY')
    if not app.testing and (not isinstance(chave, str) or len(chave) < 32 or
                            chave == 'sembarreiras-pet-chave-secreta-dev'):
        raise RuntimeError('Configure SECRET_KEY com uma chave aleatória de pelo menos 32 caracteres.')

    # Inicializa SQLAlchemy
    db.init_app(app)

    # Cria tabelas automaticamente e popula dados iniciais se necessário
    with app.app_context():
        try:
            from seed import inicializar_banco
            # Testes desativam a inicialização automática antes de importar app.
            if app.config.get('AUTO_INIT_DB', os.getenv('SB_AUTO_INIT_DB', '1') == '1'):
                inicializar_banco(app)
        except Exception as e:
            app.logger.warning('Falha ao inicializar tabelas (%s).', type(e).__name__)

    @app.errorhandler(SQLAlchemyError)
    def falha_banco(erro):
        db.session.rollback()
        app.logger.error('Falha de banco em %s (%s).', request.path, type(erro).__name__)
        return jsonify({'erro': 'Serviço temporariamente indisponível. Tente novamente.'}), 503

    # -------------------------------------------------------------
    # Suporte a CORS para consumo frontend independente
    # -------------------------------------------------------------
    @app.after_request
    def adicionar_cabecalhos_cors(resposta):
        resposta.headers['Access-Control-Allow-Origin'] = '*'
        resposta.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
        resposta.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
        if request.path.startswith('/api/'):
            resposta.headers['Cache-Control'] = 'no-store'
        return resposta

    @app.before_request
    def tratar_preflight():
        if request.path.startswith('/api/') and request.method in {'POST', 'PUT', 'PATCH', 'DELETE'}:
            origem = request.headers.get('Origin')
            if origem and origem != request.host_url.rstrip('/'):
                return jsonify({'erro': 'Origem não autorizada.'}), 403
            if not request.is_json:
                return jsonify({'erro': 'Envie os dados como JSON.'}), 415
        if request.method == 'OPTIONS':
            from flask import Response
            res = Response()
            res.headers['Access-Control-Allow-Origin'] = '*'
            res.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
            res.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
            return res
    
    # -------------------------------------------------------------
    # Rotas de Arquivos Estáticos (mantém compatibilidade total)
    # -------------------------------------------------------------
    @app.route('/')
    def home():
        return send_from_directory(ROOT, 'index.html')

    @app.route('/privacidade')
    def politica_privacidade():
        return send_from_directory(ROOT, 'privacidade.html')

    @app.route('/<path:filename>')
    def arquivo_publico(filename):
        if filename in {'config.js', 'privacidade.html', 'index.html'}:
            return send_from_directory(ROOT, filename)
        pasta, separador, relativo = filename.partition('/')
        if pasta in {'assets', 'pages'} and separador and '\\' not in relativo:
            # safe_join opera dentro da pasta pública, não da raiz do projeto.
            return send_from_directory(ROOT / pasta, relativo)
        abort(404)

    # -------------------------------------------------------------
    # Rotas de API - Diagnóstico e Conexão de Banco (PostgreSQL)
    # -------------------------------------------------------------
    @app.route('/api/status', methods=['GET'])
    def status_sistema():
        """Endpoint útil para os desenvolvedores verificarem a conexão com o PostgreSQL."""
        banco_conectado = False
        erro_banco = None
        tabelas = []
        try:
            with db.engine.connect() as conexao:
                banco_conectado = True
                inspector = db.inspect(db.engine)
                tabelas = inspector.get_table_names()
        except Exception as e:
            erro_banco = 'Banco temporariamente indisponível.'

        return jsonify({
            'status': 'online',
            'versao_api': '1.0',
            'banco': {
                'driver': db.engine.name if hasattr(db, 'engine') else 'desconhecido',
                'conectado': banco_conectado,
                'tabelas': tabelas,
                'erro': erro_banco
            }
        })

    # -------------------------------------------------------------
    # Rotas de API - Política de Privacidade
    # -------------------------------------------------------------
    @app.route('/api/privacidade', methods=['GET'])
    def obter_politica_privacidade():
        politica = PoliticaPrivacidade.query.filter_by(ativo=True).order_by(PoliticaPrivacidade.id.desc()).first()
        if not politica:
            return jsonify({'erro': 'Nenhuma política de privacidade ativa cadastrada'}), 404
        return jsonify(politica.to_dict())

    # -------------------------------------------------------------
    # Rotas de API - Pets
    # -------------------------------------------------------------
    @app.route('/api/pets', methods=['GET'])
    def listar_pets():
        especie = request.args.get('especie')
        porte = request.args.get('porte')
        
        query = Pet.query
        if especie:
            query = query.filter(Pet.especie.ilike(f"%{especie}%"))
        if porte:
            query = query.filter(Pet.porte.ilike(f"%{porte}%"))
            
        pets = query.all()
        return jsonify([pet.to_dict() for pet in pets])

    @app.route('/api/pets/<pet_id>', methods=['GET'])
    def obter_pet(pet_id):
        pet = db.session.get(Pet, pet_id)
        if not pet:
            return jsonify({'erro': 'Pet não encontrado'}), 404
        return jsonify(pet.to_dict())

    # -------------------------------------------------------------
    # Rotas de API - Autenticação e Usuários
    # -------------------------------------------------------------
    @app.route('/api/auth/cadastro', methods=['POST'])
    def cadastrar_usuario():
        dados = request.get_json(silent=True)
        if not isinstance(dados, dict) or any(not isinstance(dados.get(campo, ''), str)
                                             for campo in ('nome', 'email', 'telefone', 'senha')):
            return jsonify({'erro': 'Confira os dados de cadastro enviados.'}), 400
        nome = (dados.get('nome') or '').strip()
        email = (dados.get('email') or '').strip().lower()
        telefone = (dados.get('telefone') or '').strip()
        senha = dados.get('senha') or ''
        tipo_moradia = dados.get('tipo_moradia') or 'casa'
        if not isinstance(tipo_moradia, str) or tipo_moradia not in {'casa', 'apartamento'}:
            return jsonify({'erro': 'Escolha um tipo de moradia válido.'}), 400
        if dados.get('consentimento') is not True:
            return jsonify({'erro': 'Confirme o consentimento para criar a conta.'}), 400
        consentimento = True
        
        if not nome or not email or not telefone or not senha:
            return jsonify({'erro': 'Todos os campos obrigatórios devem ser preenchidos.'}), 400
            
        if len(senha) < 8:
            return jsonify({'erro': 'A senha deve conter ao menos 8 caracteres.'}), 400

        if Usuario.query.filter_by(email=email).first():
            return jsonify({'erro': 'Este e-mail já está cadastrado no sistema.'}), 409

        novo_usuario = Usuario(
            nome=nome,
            email=email,
            telefone=telefone,
            tipo_moradia=tipo_moradia,
            consentimento=consentimento
        )
        novo_usuario.set_senha(senha)
        
        try:
            db.session.add(novo_usuario)
            db.session.commit()
            session['usuario_id'] = novo_usuario.id
            return jsonify({
                'mensagem': 'Usuário cadastrado com sucesso!',
                'usuario': novo_usuario.to_dict()
            }), 201
        except Exception as e:
            db.session.rollback()
            app.logger.error('Falha ao cadastrar usuário (%s).', type(e).__name__)
            return jsonify({'erro': 'Não foi possível registrar a conta. Tente novamente.'}), 500

    @app.route('/api/auth/login', methods=['POST'])
    def login_usuario():
        dados = request.get_json(silent=True)
        if not isinstance(dados, dict) or any(not isinstance(dados.get(campo, ''), str)
                                             for campo in ('email', 'senha')):
            return jsonify({'erro': 'Informe e-mail e senha válidos.'}), 400
        email = (dados.get('email') or '').strip().lower()
        senha = dados.get('senha') or ''
        
        if not email or not senha:
            return jsonify({'erro': 'E-mail e senha são obrigatórios.'}), 400
            
        usuario = Usuario.query.filter_by(email=email).first()
        if not usuario or not usuario.check_senha(senha):
            return jsonify({'erro': 'Credenciais inválidas. Verifique seu e-mail e senha.'}), 401
            
        session['usuario_id'] = usuario.id
        return jsonify({
            'mensagem': 'Login realizado com sucesso!',
            'usuario': usuario.to_dict()
        })

    @app.route('/api/auth/me', methods=['GET'])
    def usuario_atual():
        usuario_id = session.get('usuario_id')
        if not isinstance(usuario_id, int):
            session.clear()
            return jsonify({'autenticado': False}), 200
        usuario = db.session.get(Usuario, usuario_id)
        if not usuario:
            session.clear()
            return jsonify({'autenticado': False}), 200
        return jsonify({
            'autenticado': True,
            'usuario': usuario.to_dict()
        })

    @app.route('/api/auth/logout', methods=['POST'])
    def logout_usuario():
        session.clear()
        return jsonify({'mensagem': 'Logout efetuado com sucesso.'})

    # -------------------------------------------------------------
    # Rotas de API - Agendamento de Visita
    # -------------------------------------------------------------
    @app.route('/api/agendamentos', methods=['POST'])
    def criar_agendamento():
        usuario_id = session.get('usuario_id')
        usuario = db.session.get(Usuario, usuario_id) if isinstance(usuario_id, int) else None
        if usuario is None:
            session.clear()
            return jsonify({'erro': 'Entre na sua conta para solicitar uma visita.'}), 401

        dados = request.get_json(silent=True)
        if not isinstance(dados, dict):
            return jsonify({'erro': 'Envie um objeto JSON válido.'}), 400
        data_visita_str = dados.get('data')
        horario = dados.get('horario')
        mensagem = dados.get('mensagem')
        pet_id = dados.get('pet_id')
        # A identidade fornecida pelo cliente nunca autoriza a operação.
        usuario_id = usuario.id

        if not isinstance(data_visita_str, str) or not isinstance(horario, str):
            return jsonify({'erro': 'Data e horário devem ser textos válidos.'}), 400
        if mensagem is not None and (not isinstance(mensagem, str) or len(mensagem) > 1000):
            return jsonify({'erro': 'A mensagem deve conter até 1.000 caracteres.'}), 400
        if pet_id is not None:
            if not isinstance(pet_id, str) or len(pet_id) > 50:
                return jsonify({'erro': 'Identificador do pet inválido.'}), 400
            if db.session.get(Pet, pet_id) is None:
                return jsonify({'erro': 'Pet não encontrado.'}), 404

        if not data_visita_str or not horario:
            return jsonify({'erro': 'Data e horário são obrigatórios para agendar a visita.'}), 400

        try:
            data_visita = datetime.strptime(data_visita_str, '%Y-%m-%d').date()
            if len(data_visita_str) != 10 or len(horario) != 5:
                raise ValueError('Formato inválido')
            datetime.strptime(horario, '%H:%M')
        except ValueError:
            return jsonify({'erro': 'Formato de data inválido. Use AAAA-MM-DD.'}), 400

        brasilia = timezone(timedelta(hours=-3))
        momento = datetime.combine(data_visita, datetime.strptime(horario, '%H:%M').time(),
                                   tzinfo=brasilia)
        if momento <= datetime.now(brasilia):
            return jsonify({'erro': 'Escolha uma data e horário futuros (horário de Brasília).'}), 400

        agendamento = Agendamento(
            usuario_id=usuario_id,
            pet_id=pet_id,
            data_visita=data_visita,
            horario=horario,
            mensagem=mensagem
        )
        
        try:
            db.session.add(agendamento)
            db.session.commit()
            return jsonify({
                'mensagem': 'Solicitação de visita registrada com sucesso!',
                'agendamento': agendamento.to_dict()
            }), 201
        except Exception as e:
            db.session.rollback()
            app.logger.error('Falha ao registrar visita (%s).', type(e).__name__)
            return jsonify({'erro': 'Não foi possível registrar a visita. Tente novamente.'}), 500

    # -------------------------------------------------------------
    # Comandos CLI para Terminal (Flask)
    # -------------------------------------------------------------
    @app.cli.command('init-db')
    def init_db_command():
        """Cria as tabelas do banco de dados configurado no .env"""
        from seed import inicializar_banco
        inicializar_banco(app)

    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5000)

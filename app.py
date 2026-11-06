"""Servidor Flask com suporte a PostgreSQL e rotas estáticas para o Sem Barreiras Pet."""
from pathlib import Path
from datetime import datetime
from flask import Flask, send_from_directory, request, jsonify, session, abort
from config import Config
from database import db
from models import PoliticaPrivacidade, SecaoPrivacidade, Usuario, Pet, Agendamento

ROOT = Path(__file__).resolve().parent

def create_app(config_class=Config):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_class)
    
    # Inicializa SQLAlchemy
    db.init_app(app)
    
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
        path = Path(filename)
        if path.parts and (path.parts[0] in {'assets', 'pages'} or filename in {'config.js', 'privacidade.html', 'index.html'}):
            return send_from_directory(ROOT, filename)
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
            erro_banco = str(e)

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
        pet = Pet.query.get(pet_id)
        if not pet:
            return jsonify({'erro': 'Pet não encontrado'}), 404
        return jsonify(pet.to_dict())

    # -------------------------------------------------------------
    # Rotas de API - Autenticação e Usuários
    # -------------------------------------------------------------
    @app.route('/api/auth/cadastro', methods=['POST'])
    def cadastrar_usuario():
        dados = request.get_json() or request.form
        nome = (dados.get('nome') or '').strip()
        email = (dados.get('email') or '').strip().lower()
        telefone = (dados.get('telefone') or '').strip()
        senha = dados.get('senha') or ''
        tipo_moradia = dados.get('tipo_moradia') or 'casa'
        consentimento = bool(dados.get('consentimento', True))
        
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
            return jsonify({'erro': f'Erro ao salvar usuário no banco: {str(e)}'}), 500

    @app.route('/api/auth/login', methods=['POST'])
    def login_usuario():
        dados = request.get_json() or request.form
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
        if not usuario_id:
            return jsonify({'autenticado': False}), 200
        usuario = Usuario.query.get(usuario_id)
        if not usuario:
            session.pop('usuario_id', None)
            return jsonify({'autenticado': False}), 200
        return jsonify({
            'autenticado': True,
            'usuario': usuario.to_dict()
        })

    @app.route('/api/auth/logout', methods=['POST'])
    def logout_usuario():
        session.pop('usuario_id', None)
        return jsonify({'mensagem': 'Logout efetuado com sucesso.'})

    # -------------------------------------------------------------
    # Rotas de API - Agendamento de Visita
    # -------------------------------------------------------------
    @app.route('/api/agendamentos', methods=['POST'])
    def criar_agendamento():
        dados = request.get_json() or request.form
        data_visita_str = dados.get('data')
        horario = dados.get('horario')
        mensagem = dados.get('mensagem')
        pet_id = dados.get('pet_id')
        usuario_id = session.get('usuario_id') or dados.get('usuario_id')

        if not data_visita_str or not horario:
            return jsonify({'erro': 'Data e horário são obrigatórios para agendar a visita.'}), 400

        try:
            data_visita = datetime.strptime(data_visita_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'erro': 'Formato de data inválido. Use AAAA-MM-DD.'}), 400

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
            return jsonify({'erro': f'Erro ao salvar agendamento: {str(e)}'}), 500

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

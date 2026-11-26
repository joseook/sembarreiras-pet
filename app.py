"""Servidor Flask com suporte a PostgreSQL e rotas estáticas para o Sem Barreiras Pet."""
import os
import hmac
import secrets
import re
import smtplib
import unicodedata
from pathlib import Path
from datetime import datetime, timedelta, timezone
from flask import Flask, send_from_directory, request, jsonify, session, abort, redirect
from itsdangerous import BadData
from werkzeug.exceptions import HTTPException
from urllib.parse import urlencode
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload
from sqlalchemy import or_, null
from config import Config
from cabecalhos import CABECALHOS_SEGURANCA
from database import db
from models import PoliticaPrivacidade, SecaoPrivacidade, Usuario, Pet, PetMidia, Agendamento, MensagemContato, SessaoUsuario
from pet_form import validar_pet, STATUS as STATUS_PET
from seguranca import usuario_autenticado, iniciar_sessao, revogar_sessao, limitar_acao, ip_cliente
from regras import (email_valido, telefone_valido, validar_visita, BRASILIA, problema_senha,
                    texto_significativo, escapar_like)
from recuperacao import email_configurado, enviar_recuperacao, serializador, versao_senha

ROOT = Path(__file__).resolve().parent

def create_app(config_class=Config):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_class)
    app.config['SESSION_COOKIE_SAMESITE'] = app.config.get('SESSION_COOKIE_SAMESITE') or 'Lax'
    app.config['MAX_CONTENT_LENGTH'] = app.config.get('MAX_CONTENT_LENGTH') or 32 * 1024

    chave = app.config.get('SECRET_KEY')
    if not app.testing and (not isinstance(chave, str) or len(chave) < 32 or
                            chave == 'sembarreiras-pet-chave-secreta-dev'):
        raise RuntimeError('Configure SECRET_KEY com uma chave aleatória de pelo menos 32 caracteres.')

    db.init_app(app)

    def eh_gerente(usuario):
        ids = str(app.config.get('GERENTES_IDS', '')).split(',')
        return usuario is not None and str(usuario.id) in {item.strip() for item in ids}

    def dados_usuario(usuario):
        return {**usuario.to_dict(), 'gerente': eh_gerente(usuario)}

    def autorizar_gerente():
        usuario = usuario_autenticado()
        if usuario is None:
            session.clear()
            return jsonify({'erro': 'Entre na sua conta para acessar a agenda.'}), 401
        if not eh_gerente(usuario):
            return jsonify({'erro': 'Acesso exclusivo para gerentes autorizados.'}), 403
        return None

    with app.app_context():
        try:
            from seed import inicializar_banco
            if app.config.get('AUTO_INIT_DB', os.getenv('SB_AUTO_INIT_DB', '0') == '1'):
                inicializar_banco(app)
        except Exception as e:
            app.logger.warning('Falha ao inicializar tabelas (%s).', type(e).__name__)

    @app.errorhandler(SQLAlchemyError)
    def falha_banco(erro):
        db.session.rollback()
        app.logger.error('Falha de banco em %s (%s).', request.path, type(erro).__name__)
        return jsonify({'erro': 'Serviço temporariamente indisponível. Tente novamente.'}), 503

    @app.errorhandler(HTTPException)
    def erro_http_api(erro):
        if not request.path.startswith('/api/'):
            return erro
        mensagens = {
            404: 'Recurso não encontrado.',
            405: 'Operação não permitida para este endereço.',
            413: 'O conteúdo enviado excede o limite permitido.',
        }
        return jsonify({'erro': mensagens.get(erro.code, 'Não foi possível concluir a solicitação.')}), erro.code

    @app.errorhandler(Exception)
    def erro_inesperado(erro):
        if isinstance(erro, HTTPException):
            return erro_http_api(erro)
        db.session.rollback()
        app.logger.error('Erro inesperado em %s (%s).', request.path, type(erro).__name__)
        return jsonify({'erro': 'Erro interno no servidor. Tente novamente em instantes.'}), 500

    @app.errorhandler(413)
    def corpo_excessivo(erro):
        return jsonify({'erro': 'O conteúdo enviado excede o limite permitido.'}), 413

    def excesso_tentativas():
        return jsonify({'erro': 'Muitas tentativas. Aguarde 15 minutos e tente novamente.'}), 429, {'Retry-After': '900'}

    @app.after_request
    def adicionar_cabecalhos_cors(resposta):
        resposta.headers['Access-Control-Allow-Origin'] = '*'
        resposta.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
        resposta.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
        if request.path.startswith('/api/'):
            resposta.headers['Cache-Control'] = 'no-store'
        for nome, valor in CABECALHOS_SEGURANCA.items():
            resposta.headers.setdefault(nome, valor)
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

    @app.before_request
    def exigir_troca_senha_temporaria():
        if request.method != 'OPTIONS' and request.path.startswith(('/api/gerencia/', '/api/agendamentos')):
            usuario = usuario_autenticado()
            if usuario and usuario.senha_temporaria:
                return jsonify({'erro': 'Troque sua senha temporária antes de continuar.', 'codigo': 'TROCAR_SENHA'}), 403
    
    @app.route('/')
    def home():
        return send_from_directory(ROOT, 'index.html')

    @app.route('/privacidade')
    def politica_privacidade():
        return send_from_directory(ROOT, 'privacidade.html')

    @app.get('/pages/como-funciona.html')
    def caminho_antigo():
        pet_id = request.args.get('pet_id')
        destino = '/pages/agendar-visita.html?' + urlencode({'pet_id': pet_id}) if pet_id else '/pages/catalogo.html'
        return redirect(destino, code=302)

    @app.route('/<path:filename>')
    def arquivo_publico(filename):
        if filename in {'config.js', 'privacidade.html', 'index.html'}:
            return send_from_directory(ROOT, filename)
        pasta, separador, relativo = filename.partition('/')
        if pasta in {'assets', 'pages'} and separador and '\\' not in relativo:
            return send_from_directory(ROOT / pasta, relativo)
        abort(404)

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

    @app.route('/api/privacidade', methods=['GET'])
    def obter_politica_privacidade():
        from politica import politica_atual
        return jsonify(politica_atual())

    @app.route('/api/pets', methods=['GET'])
    def listar_pets():
        especie = request.args.get('especie')
        porte = request.args.get('porte')
        
        query = Pet.query.options(joinedload(Pet.midia)).filter(or_(Pet.status != 'arquivado', Pet.status.is_(None)))
        busca = request.args.get('q', '').strip()
        if len(busca) > 120:
            return jsonify({'erro': 'Use até 120 caracteres na busca.'}), 400
        if busca:
            query = query.filter(or_(Pet.nome.ilike(f'%{escapar_like(busca)}%', escape='\\'), Pet.raca.ilike(f'%{escapar_like(busca)}%', escape='\\')))
        if request.args.get('status'):
            query = query.filter_by(status=request.args['status'])
        if especie:
            query = query.filter(Pet.especie.ilike(f"%{escapar_like(especie)}%", escape="\\"))
        if porte:
            query = query.filter(Pet.porte.ilike(f"%{escapar_like(porte)}%", escape="\\"))
            
        pets = query.order_by(Pet.nome, Pet.id).all()
        return jsonify([pet.to_dict() for pet in pets])

    @app.route('/api/pets/<pet_id>', methods=['GET'])
    def obter_pet(pet_id):
        pet = db.session.get(Pet, pet_id)
        if not pet:
            return jsonify({'erro': 'Pet não encontrado'}), 404
        if pet.status == 'arquivado':
            return jsonify({'erro': 'Este pet foi arquivado e não está mais na consulta pública.'}), 410
        return jsonify(pet.to_dict())

    @app.get('/api/gerencia/pets')
    def pets_gerencia():
        erro = autorizar_gerente()
        if erro is not None:
            return erro
        try:
            pagina = int(request.args.get('pagina', '1'))
            if not 1 <= pagina <= 1000000:
                raise ValueError()
        except ValueError:
            return jsonify({'erro': 'Página inválida.'}), 400
        busca, status = request.args.get('q', '').strip(), request.args.get('status', 'todos')
        if len(busca) > 120 or status not in STATUS_PET | {'todos'}:
            return jsonify({'erro': 'Confira os filtros informados.'}), 400
        query = Pet.query
        if busca:
            query = query.filter(or_(Pet.nome.ilike(f'%{escapar_like(busca)}%', escape='\\'), Pet.raca.ilike(f'%{escapar_like(busca)}%', escape='\\')))
        if status != 'todos':
            query = query.filter_by(status=status)
        total = query.count()
        registros = query.options(joinedload(Pet.midia)).order_by(Pet.nome, Pet.id).limit(12).offset((pagina-1)*12).all()
        return jsonify({'pets': [p.to_dict() for p in registros], 'total': total, 'pagina': pagina, 'por_pagina': 12})

    @app.get('/api/gerencia/pets/<pet_id>')
    def pet_gerencia(pet_id):
        erro = autorizar_gerente()
        if erro is not None:
            return erro
        pet = db.session.get(Pet, pet_id)
        if not pet:
            return jsonify({'erro': 'Pet não encontrado.'}), 404
        return jsonify({'pet': pet.to_dict(), 'possui_agendamentos': Agendamento.query.filter_by(pet_id=pet.id).first() is not None})

    def aplicar_campos_pet(pet, campos):
        fotos = campos.pop('fotos', None)
        for nome, valor in campos.items():
            setattr(pet, nome, null() if nome in {'castrado', 'microchip'} and valor is None else valor)
        if fotos is not None:
            if pet.midia:
                pet.midia.fotos = fotos
            else:
                pet.midia = PetMidia(fotos=fotos)

    @app.post('/api/gerencia/pets')
    def cadastrar_pet():
        erro = autorizar_gerente()
        if erro is not None:
            return erro
        campos, erros = validar_pet(request.get_json(silent=True), novo=True)
        if erros:
            return jsonify({'erro': 'Revise os campos indicados.', 'campos': erros}), 400
        base = unicodedata.normalize('NFKD', campos['nome']).encode('ascii', 'ignore').decode().lower()
        slug = re.sub('[^a-z0-9]+', '-', base).strip('-')[:35] or 'pet'
        pet = Pet(id=slug+'-'+secrets.token_hex(5))
        aplicar_campos_pet(pet, campos)
        db.session.add(pet)
        db.session.commit()
        return jsonify({'mensagem': 'Pet cadastrado com sucesso.', 'pet': pet.to_dict()}), 201

    @app.put('/api/gerencia/pets/<pet_id>')
    def editar_pet(pet_id):
        erro = autorizar_gerente()
        if erro is not None:
            return erro
        campos, erros = validar_pet(request.get_json(silent=True))
        if erros:
            return jsonify({'erro': 'Revise os campos indicados.', 'campos': erros}), 400
        pet = Pet.query.filter_by(id=pet_id).with_for_update().first()
        if not pet:
            return jsonify({'erro': 'Pet não encontrado.'}), 404
        if campos.get('status', pet.status) != 'disponivel':
            hoje = datetime.now(BRASILIA).date()
            futuras = Agendamento.query.filter_by(pet_id=pet.id).filter(
                Agendamento.status.in_(['pendente', 'confirmado']), Agendamento.data_visita >= hoje).count()
            if futuras:
                return jsonify({'erro': 'Cancele ou resolva as visitas pendentes e confirmadas a partir de hoje antes de retirar este pet da disponibilidade.', 'campos': {'status': 'Há visitas ativas para este pet.'}}), 409
        aplicar_campos_pet(pet, campos)
        db.session.commit()
        return jsonify({'mensagem': 'Alterações do pet salvas.', 'pet': pet.to_dict()})

    @app.delete('/api/gerencia/pets/<pet_id>')
    def excluir_pet(pet_id):
        erro = autorizar_gerente()
        if erro is not None:
            return erro
        pet = Pet.query.filter_by(id=pet_id).with_for_update().first()
        if not pet:
            return jsonify({'erro': 'Pet não encontrado.'}), 404
        if Agendamento.query.filter_by(pet_id=pet_id).first():
            return jsonify({'erro': 'Este pet possui histórico de visitas e não pode ser excluído. Use Arquivar para preservar o histórico.', 'possui_agendamentos': True}), 409
        db.session.delete(pet)
        db.session.commit()
        return jsonify({'mensagem': 'Pet excluído definitivamente.'})

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
            
        if len(nome) > 120:
            return jsonify({'erro': 'Use até 120 caracteres no nome.', 'campos': {'nome': 'Use até 120 caracteres.'}}), 400
        erro_senha = problema_senha(senha)
        if erro_senha:
            return jsonify({'erro': erro_senha, 'campos': {'senha': erro_senha}}), 400
        if not email_valido(email) or not telefone_valido(telefone):
            return jsonify({'erro': 'Informe e-mail válido e telefone com DDD.'}), 400
        if limitar_acao('cadastro', email):
            return excesso_tentativas()

        if Usuario.query.filter_by(email=email).first():
            return jsonify({'erro': 'Este e-mail já está cadastrado no sistema.',
                            'campos': {'email': 'Este e-mail já está cadastrado. Entre ou recupere a senha.'}}), 409

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
            db.session.flush()
            iniciar_sessao(novo_usuario)
            return jsonify({
                'mensagem': 'Usuário cadastrado com sucesso!',
                'usuario': dados_usuario(novo_usuario)
            }), 201
        except Exception as e:
            db.session.rollback()
            app.logger.error('Falha ao cadastrar usuário (%s).', type(e).__name__)
            return jsonify({'erro': 'Não foi possível registrar a conta. Tente novamente.'}), 500

    @app.route('/api/auth/login', methods=['POST'])
    def login_usuario():
        revogar_sessao()
        db.session.commit()
        dados = request.get_json(silent=True)
        if not isinstance(dados, dict) or any(not isinstance(dados.get(campo, ''), str)
                                             for campo in ('email', 'senha')):
            return jsonify({'erro': 'Informe e-mail e senha válidos.'}), 400
        email = (dados.get('email') or '').strip().lower()
        senha = dados.get('senha') or ''
        
        if not email or not senha:
            return jsonify({'erro': 'E-mail e senha são obrigatórios.'}), 400
        if len(email) > 120 or len(senha) > 128:
            return jsonify({'erro': 'Confira o e-mail e a senha informados.'}), 400
        if limitar_acao('login', f'{email}|{ip_cliente()}'):
            return excesso_tentativas()

        usuario = Usuario.query.filter_by(email=email).with_for_update().first()
        if not usuario or not usuario.check_senha(senha):
            return jsonify({'erro': 'Credenciais inválidas. Verifique seu e-mail e senha.'}), 401
            
        iniciar_sessao(usuario)
        return jsonify({
            'mensagem': 'Login realizado com sucesso!',
            'usuario': dados_usuario(usuario)
        })

    @app.route('/api/auth/me', methods=['GET'])
    def usuario_atual():
        usuario = usuario_autenticado()
        if not usuario:
            session.clear()
            return jsonify({'autenticado': False}), 200
        return jsonify({
            'autenticado': True,
            'usuario': dados_usuario(usuario)
        })

    @app.route('/api/auth/logout', methods=['POST'])
    def logout_usuario():
        revogar_sessao()
        db.session.commit()
        return jsonify({'mensagem': 'Logout efetuado com sucesso.'})

    @app.post('/api/auth/recuperar-senha')
    def recuperar_senha():
        dados = request.get_json(silent=True)
        email = dados.get('email') if isinstance(dados, dict) else None
        if not isinstance(email, str) or not email_valido(email.strip().lower()):
            return jsonify({'erro': 'Informe um e-mail válido.'}), 400
        if not email_configurado():
            return jsonify({'erro': 'A recuperação por e-mail está temporariamente indisponível.'}), 503
        email = email.strip().lower()
        if limitar_acao('recuperar-senha', email, limite=3):
            return excesso_tentativas()
        usuario = Usuario.query.filter_by(email=email).first()
        if usuario:
            try:
                enviar_recuperacao(usuario)
            except (OSError, smtplib.SMTPException, ValueError) as erro:
                app.logger.warning('Falha de envio do e-mail de recuperação (%s).', type(erro).__name__)
                return jsonify({'erro': 'Não foi possível enviar o e-mail de recuperação agora. '
                                        'Tente novamente em alguns minutos.'}), 503
        return jsonify({'mensagem': 'Se o e-mail estiver cadastrado, você receberá um link de recuperação.'}), 202

    @app.post('/api/auth/redefinir-senha')
    def redefinir_senha():
        dados = request.get_json(silent=True)
        if not isinstance(dados, dict) or any(not isinstance(dados.get(campo), str)
                for campo in ('token', 'nova_senha', 'confirmacao')):
            return jsonify({'erro': 'Confira os campos de senha.'}), 400
        nova = dados['nova_senha']
        if nova != dados['confirmacao']:
            return jsonify({'erro': 'A nova senha e a confirmação precisam ser iguais.'}), 400
        if problema_senha(nova):
            return jsonify({'erro': problema_senha(nova)}), 400
        if limitar_acao('redefinir-senha'):
            return excesso_tentativas()
        invalido = jsonify({'erro': 'Este link é inválido, foi usado ou expirou. Solicite outro link.'}), 400
        if not 1 <= len(dados['token']) <= 512:
            return invalido
        try:
            usuario_id, versao = serializador().loads(dados['token'], max_age=1800)
        except (BadData, TypeError, ValueError):
            return invalido
        usuario = Usuario.query.filter_by(id=usuario_id).with_for_update().first()
        if not usuario or not hmac.compare_digest(versao, versao_senha(usuario)):
            return invalido
        hash_anterior = usuario.senha_hash
        usuario.set_senha(nova)
        novo_hash = usuario.senha_hash
        db.session.expire(usuario, ['senha_hash'])
        alterados = Usuario.query.filter_by(id=usuario_id, senha_hash=hash_anterior).update(
            {Usuario.senha_hash: novo_hash}, synchronize_session=False
        )
        if not alterados:
            return invalido
        SessaoUsuario.query.filter_by(usuario_id=usuario_id).delete()
        db.session.commit()
        session.clear()
        return jsonify({'mensagem': 'Senha redefinida. Entre com sua nova senha.'})

    @app.post('/api/auth/senha')
    def alterar_senha():
        usuario = usuario_autenticado()
        if not usuario:
            return jsonify({'erro': 'Entre na sua conta para alterar a senha.'}), 401
        dados = request.get_json(silent=True)
        if not isinstance(dados, dict) or any(not isinstance(dados.get(c), str)
                for c in ('senha_atual', 'nova_senha', 'confirmacao')):
            return jsonify({'erro': 'Confira os campos de senha.'}), 400
        nova = dados['nova_senha']
        if nova != dados['confirmacao']:
            return jsonify({'erro': 'A nova senha e a confirmação precisam ser iguais.'}), 400
        if problema_senha(nova):
            return jsonify({'erro': problema_senha(nova)}), 400
        if len(dados['senha_atual']) > 128:
            return jsonify({'erro': 'Confira sua senha atual.'}), 400
        if limitar_acao('trocar-senha', str(usuario.id)):
            return excesso_tentativas()
        usuario = Usuario.query.filter_by(id=usuario.id).populate_existing().with_for_update().one()
        if not usuario.check_senha(dados['senha_atual']):
            return jsonify({'erro': 'A senha atual está incorreta ou expirou.'}), 400
        if usuario.check_senha(nova):
            return jsonify({'erro': 'Escolha uma senha diferente da atual.'}), 400
        usuario.set_senha(nova)
        SessaoUsuario.query.filter_by(usuario_id=usuario.id).delete()
        iniciar_sessao(usuario)
        return jsonify({'mensagem': 'Senha alterada. As sessões anteriores foram encerradas.',
                        'usuario': dados_usuario(usuario)})

    @app.route('/api/agendamentos', methods=['POST'])
    def criar_agendamento():
        usuario = usuario_autenticado()
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
        usuario_id = usuario.id
        Usuario.query.filter_by(id=usuario.id).with_for_update().one()

        if not isinstance(data_visita_str, str) or not isinstance(horario, str):
            return jsonify({'erro': 'Data e horário devem ser textos válidos.'}), 400
        if mensagem is not None and (not isinstance(mensagem, str) or len(mensagem) > 1000):
            return jsonify({'erro': 'A mensagem deve conter até 1.000 caracteres.'}), 400
        if pet_id is not None:
            if not isinstance(pet_id, str) or len(pet_id) > 50:
                return jsonify({'erro': 'Identificador do pet inválido.'}), 400
            pet = Pet.query.filter_by(id=pet_id).with_for_update().first()
            if pet is None:
                return jsonify({'erro': 'Pet não encontrado.'}), 404
            if pet.status != 'disponivel':
                return jsonify({'erro': 'Este pet não está disponível para visitas.'}), 409

        if not data_visita_str or not horario:
            return jsonify({'erro': 'Data e horário são obrigatórios para agendar a visita.'}), 400

        try:
            data_visita = validar_visita(data_visita_str, horario, datetime.now(BRASILIA))
        except ValueError as erro:
            return jsonify({'erro': str(erro)}), 400

        existente = Agendamento.query.filter_by(usuario_id=usuario.id, pet_id=pet_id,
            data_visita=data_visita, horario=horario).filter(Agendamento.status.in_(['pendente', 'confirmado'])).first()
        if existente:
            return jsonify({'mensagem': 'Você já tem uma solicitação para este pet e horário.',
                            'agendamento': existente.to_dict()}), 200

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
                'mensagem': f'Solicitação de visita para conhecer {agendamento.pet.nome} registrada com sucesso!' if agendamento.pet else 'Solicitação de visita registrada com sucesso!',
                'agendamento': agendamento.to_dict()
            }), 201
        except Exception as e:
            db.session.rollback()
            app.logger.error('Falha ao registrar visita (%s).', type(e).__name__)
            return jsonify({'erro': 'Não foi possível registrar a visita. Tente novamente.'}), 500

    @app.get('/api/gerencia/agendamentos')
    def listar_agendamentos_gerencia():
        erro = autorizar_gerente()
        if erro is not None:
            return erro
        status = request.args.get('status', 'pendente')
        if status not in {'todos', 'pendente', 'confirmado', 'cancelado'}:
            return jsonify({'erro': 'Filtro de status inválido.'}), 400
        try:
            pagina = int(request.args.get('pagina', '1'))
            if not 1 <= pagina <= 1000000:
                raise ValueError()
            data = request.args.get('data')
            data = datetime.strptime(data, '%Y-%m-%d').date() if data else None
        except ValueError:
            return jsonify({'erro': 'Confira a data e a página informadas.'}), 400
        query = Agendamento.query
        if status != 'todos':
            query = query.filter_by(status=status)
        if data:
            query = query.filter_by(data_visita=data)
        total = query.count()
        registros = query.options(joinedload(Agendamento.usuario), joinedload(Agendamento.pet)).order_by(
            Agendamento.data_visita, Agendamento.horario, Agendamento.id
        ).limit(25).offset((pagina - 1) * 25).all()
        itens = []
        for visita in registros:
            itens.append({**visita.to_dict(),
                'solicitante': {'nome': visita.usuario.nome, 'email': visita.usuario.email,
                                'telefone': visita.usuario.telefone} if visita.usuario else None,
                'pet_nome': visita.pet.nome if visita.pet else None})
        return jsonify({'agendamentos': itens, 'total': total, 'pagina': pagina,
                        'por_pagina': 25})

    @app.post('/api/gerencia/agendamentos/<int:visita_id>/confirmar')
    def confirmar_agendamento(visita_id):
        erro = autorizar_gerente()
        if erro is not None:
            return erro
        visita = db.session.get(Agendamento, visita_id)
        if visita is None:
            return jsonify({'erro': 'Agendamento não encontrado.'}), 404
        if visita.usuario_id:
            Usuario.query.filter_by(id=visita.usuario_id).with_for_update().first()
        visita = Agendamento.query.filter_by(id=visita_id).populate_existing().with_for_update().one()
        if visita.status == 'confirmado':
            return jsonify({'mensagem': 'Este agendamento já está confirmado.',
                            'agendamento': visita.to_dict()})
        if visita.status != 'pendente':
            return jsonify({'erro': 'Somente solicitações pendentes podem ser confirmadas.'}), 409
        if visita.pet_id:
            pet = Pet.query.filter_by(id=visita.pet_id).with_for_update().first()
            if not pet or pet.status != 'disponivel':
                return jsonify({'erro': 'Este pet não está disponível para visitas.'}), 409
        try:
            validar_visita(visita.data_visita.isoformat(), visita.horario, datetime.now(BRASILIA))
        except (ValueError, TypeError):
            return jsonify({'erro': 'A visita precisa de data e horário futuros dentro do atendimento.'}), 409
        alterados = Agendamento.query.filter_by(id=visita_id, status='pendente').update(
            {'status': 'confirmado'}, synchronize_session=False)
        if not alterados:
            db.session.rollback()
            return jsonify({'erro': 'O agendamento mudou. Atualize a lista.'}), 409
        db.session.commit()
        db.session.refresh(visita)
        nome_pet = f' para conhecer {visita.pet.nome}' if visita.pet else ''
        return jsonify({'mensagem': f'Agendamento confirmado{nome_pet} e disponível em Minhas visitas para o solicitante.',
                        'agendamento': visita.to_dict()})

    @app.get('/api/agendamentos')
    def minhas_visitas():
        usuario = usuario_autenticado()
        if not usuario:
            return jsonify({'erro': 'Entre na sua conta para acompanhar suas visitas.'}), 401
        try:
            pagina = int(request.args.get('pagina', '1'))
            if not 1 <= pagina <= 1000000:
                raise ValueError()
        except ValueError:
            return jsonify({'erro': 'Página inválida.'}), 400
        query = Agendamento.query.filter_by(usuario_id=usuario.id)
        total = query.count()
        visitas = query.options(joinedload(Agendamento.pet)).order_by(
            Agendamento.data_visita.desc(), Agendamento.horario.desc(), Agendamento.id.desc()
        ).limit(25).offset((pagina - 1) * 25).all()
        return jsonify({'agendamentos': [{**v.to_dict(), 'pet_nome': v.pet.nome if v.pet else None}
            for v in visitas], 'total': total, 'pagina': pagina, 'por_pagina': 25})

    def visita_autorizada(visita_id):
        usuario = usuario_autenticado()
        if not usuario:
            return None, (jsonify({'erro': 'Entre na sua conta para alterar a visita.'}), 401)
        visita = db.session.get(Agendamento, visita_id)
        if not visita or (visita.usuario_id != usuario.id and not eh_gerente(usuario)):
            return None, (jsonify({'erro': 'Agendamento não encontrado.'}), 404)
        if visita.usuario_id:
            Usuario.query.filter_by(id=visita.usuario_id).with_for_update().first()
        visita = Agendamento.query.filter_by(id=visita_id).populate_existing().with_for_update().one()
        return visita, None

    @app.post('/api/agendamentos/<int:visita_id>/cancelar')
    def cancelar_visita(visita_id):
        visita, erro = visita_autorizada(visita_id)
        if erro is not None:
            return erro
        if visita.status == 'cancelado':
            return jsonify({'mensagem': 'Esta visita já está cancelada.', 'agendamento': visita.to_dict()})
        if visita.status not in {'pendente', 'confirmado'}:
            return jsonify({'erro': 'Esta visita não pode ser cancelada.'}), 409
        visita.status = 'cancelado'
        db.session.commit()
        return jsonify({'mensagem': 'Visita cancelada. O status foi atualizado para o solicitante e a gerência.',
                        'agendamento': visita.to_dict()})

    @app.post('/api/agendamentos/<int:visita_id>/remarcar')
    def remarcar_visita(visita_id):
        visita, erro = visita_autorizada(visita_id)
        if erro is not None:
            return erro
        if visita.status not in {'pendente', 'confirmado'}:
            return jsonify({'erro': 'Visitas canceladas não podem ser remarcadas.'}), 409
        dados = request.get_json(silent=True)
        if not isinstance(dados, dict):
            return jsonify({'erro': 'Envie data e horário para remarcar.'}), 400
        try:
            data = validar_visita(dados.get('data'), dados.get('horario'), datetime.now(BRASILIA))
        except ValueError as erro:
            return jsonify({'erro': str(erro)}), 400
        if visita.pet_id:
            pet = Pet.query.filter_by(id=visita.pet_id).with_for_update().first()
            if not pet or pet.status != 'disponivel':
                return jsonify({'erro': 'Este pet não está disponível para visitas.'}), 409
        horario = dados['horario']
        duplicada = Agendamento.query.filter_by(usuario_id=visita.usuario_id, pet_id=visita.pet_id,
            data_visita=data, horario=horario).filter(Agendamento.id != visita.id,
                Agendamento.status.in_(['pendente', 'confirmado'])).first()
        if duplicada:
            return jsonify({'erro': 'Já existe uma solicitação sua para este pet e horário.'}), 409
        if visita.data_visita == data and visita.horario == horario:
            return jsonify({'mensagem': 'A visita já está neste horário.', 'agendamento': visita.to_dict()})
        visita.data_visita, visita.horario, visita.status = data, horario, 'pendente'
        db.session.commit()
        return jsonify({'mensagem': 'Visita remarcada. Aguarde uma nova confirmação da gerência.',
                        'agendamento': visita.to_dict()})

    @app.post('/api/contato')
    def enviar_contato():
        dados = request.get_json(silent=True)
        if not isinstance(dados, dict) or any(not isinstance(dados.get(c), str)
                for c in ('nome', 'email', 'assunto', 'mensagem')):
            return jsonify({'erro': 'Confira os campos da mensagem.'}), 400
        nome, email, assunto, mensagem = [dados[c].strip() for c in ('nome', 'email', 'assunto', 'mensagem')]
        email = email.lower()
        if (not 1 <= len(nome) <= 100 or not email_valido(email, 254)
                or not 10 <= len(texto_significativo(mensagem)) or len(mensagem) > 2000):
            return jsonify({'erro': 'Informe nome, e-mail válido e mensagem entre 10 e 2.000 caracteres.'}), 400
        if assunto not in {'adocao', 'parceria', 'acessibilidade', 'sugestao', 'outro'}:
            return jsonify({'erro': 'Escolha um assunto válido.'}), 400
        if limitar_acao('contato', email):
            return excesso_tentativas()
        registro = MensagemContato(id=secrets.token_hex(16), nome=nome, email=email,
            assunto=assunto, mensagem=mensagem)
        db.session.add(registro)
        db.session.commit()
        return jsonify({'mensagem': 'Mensagem registrada. Guarde seu protocolo.', 'protocolo': registro.id}), 201

    @app.get('/api/gerencia/contatos')
    def listar_contatos():
        erro = autorizar_gerente()
        if erro is not None:
            return erro
        try:
            pagina = int(request.args.get('pagina', '1'))
            if not 1 <= pagina <= 1000000:
                raise ValueError()
        except ValueError:
            return jsonify({'erro': 'Página inválida.'}), 400
        query = MensagemContato.query
        registros = query.order_by(MensagemContato.criado_em.desc(), MensagemContato.id).limit(25).offset((pagina-1)*25).all()
        return jsonify({'contatos': [r.to_dict() for r in registros], 'total': query.count(),
                        'pagina': pagina, 'por_pagina': 25})

    @app.cli.command('init-db')
    def init_db_command():
        """Cria as tabelas do banco de dados configurado no .env"""
        from seed import inicializar_banco
        inicializar_banco(app)

    @app.cli.command('prepare-db')
    def preparar_banco():
        """Adiciona tabelas de suporte sem alterar as colunas ou dados existentes."""
        from preparacao import preparar_tabelas
        preparar_tabelas()
        from politica import publicar_politica
        publicar_politica()
        print('Tabelas de suporte e política atual preparadas; contas e visitas preservadas.')

    @app.cli.command('importar-fotos-exemplo')
    def importar_fotos():
        """Associa fotos fictícias aos exemplos existentes, sem sobrescrever mídia."""
        from seed import importar_fotos_exemplo
        importar_fotos_exemplo()
        print('Fotos dos exemplos associadas; mídias existentes preservadas.')

    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5000)

"""Sessões revogáveis e limites persistentes, compartilhados entre instâncias."""
import hashlib
import hmac
import os
import secrets
from sqlalchemy import text
from datetime import datetime, timedelta, timezone
from flask import current_app, session, request
from database import db
from models import SessaoUsuario, TentativaAcesso, Usuario


def agora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def revogar_sessao():
    token = session.get('sid')
    if isinstance(token, str):
        SessaoUsuario.query.filter_by(token_hash=hash_token(token)).delete()
    session.clear()


def iniciar_sessao(usuario):
    revogar_sessao()
    SessaoUsuario.query.filter(SessaoUsuario.expira_em <= agora()).delete()
    token = secrets.token_urlsafe(32)
    db.session.add(SessaoUsuario(token_hash=hash_token(token), usuario_id=usuario.id,
        expira_em=agora() + timedelta(hours=8)))
    # O cookie só é emitido depois da confirmação da sessão persistente.
    db.session.commit()
    session['sid'] = token
    session['usuario_id'] = usuario.id


def usuario_autenticado():
    token = session.get('sid')
    usuario_id = session.get('usuario_id')
    if not isinstance(token, str) or len(token) > 100 or type(usuario_id) is not int:
        session.clear()
        return None
    registro = db.session.get(SessaoUsuario, hash_token(token))
    if not registro or registro.expira_em <= agora() or registro.usuario_id != usuario_id:
        session.clear()
        return None
    usuario = db.session.get(Usuario, usuario_id)
    if not usuario:
        session.clear()
    return usuario


def chave_limite(valor):
    return hmac.new(current_app.secret_key.encode(), valor.encode(), hashlib.sha256).hexdigest()


def ip_cliente():
    """IP real do visitante. Na Vercel, o proxy sobrescreve X-Real-IP/X-Forwarded-For,
    então o valor não pode ser forjado pelo cliente; fora dela usa a conexão direta."""
    if os.getenv('VERCEL') == '1':
        real = (request.headers.get('X-Real-IP') or '').strip()
        encaminhado = (request.headers.get('X-Forwarded-For') or '').split(',')[0].strip()
        if real or encaminhado:
            return (real or encaminhado)[:64]
    return request.remote_addr or 'desconhecido'


def limitar_acao(acao, identificador='', limite=10):
    """Reserva uma tentativa antes de processar; guarda somente HMACs, por 15 min."""
    desde = agora() - timedelta(minutes=15)
    # Não confia em X-Forwarded-For fornecido pelo cliente.
    valores = [(f'{acao}:ip:{ip_cliente()}', 60)]
    if identificador:
        valores.append((f'{acao}:conta:{identificador}', limite))
    if db.engine.dialect.name == 'postgresql':
        for chave in sorted(chave_limite(valor) for valor, _ in valores):
            db.session.execute(text('SELECT pg_advisory_xact_lock(:chave)'), {'chave': int(chave[:15], 16)})
    for valor, maximo in valores:
        if TentativaAcesso.query.filter(TentativaAcesso.chave == chave_limite(valor),
                TentativaAcesso.criado_em > desde).count() >= maximo:
            return True
    TentativaAcesso.query.filter(TentativaAcesso.criado_em <= desde).delete()
    for valor, _ in valores:
        db.session.add(TentativaAcesso(chave=chave_limite(valor)))
    db.session.commit()
    return False

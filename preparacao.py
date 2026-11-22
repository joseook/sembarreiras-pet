"""Cria suporte novo e restringe acesso direto às tabelas privadas no PostgreSQL."""
from sqlalchemy import text
from database import db

TABELAS_SUPORTE = ('sessoes_usuarios', 'tentativas_acesso', 'pet_midias', 'mensagens_contato')


def preparar_tabelas():
    if db.engine.dialect.name != 'postgresql':
        db.create_all()
        return
    # DDL e restrições são atômicas: não há janela de tabelas novas desprotegidas.
    with db.engine.begin() as conexao:
        db.metadata.create_all(bind=conexao)
        papeis = set(conexao.execute(text("SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')")).scalars())
        for tabela in TABELAS_SUPORTE:
            conexao.execute(text(f'ALTER TABLE {tabela} ENABLE ROW LEVEL SECURITY'))
            for papel in sorted(papeis):
                conexao.execute(text(f'REVOKE ALL ON TABLE {tabela} FROM {papel}'))

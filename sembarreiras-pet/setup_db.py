import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

SENHA = 'postgres'

print("A conectar ao PostgreSQL...")
conexao_padrao = psycopg2.connect(user="postgres", password=SENHA, host="localhost", port="5432")
conexao_padrao.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cursor_padrao = conexao_padrao.cursor()

try:
    cursor_padrao.execute("CREATE DATABASE sembarreiras_db;")
    print("Banco de dados 'sembarreiras_db' criado com sucesso!")
except psycopg2.errors.DuplicateDatabase:
    print("O banco de dados já existia, a continuar...")
cursor_padrao.close()
conexao_padrao.close()

conexao_projeto = psycopg2.connect(dbname="sembarreiras_db", user="postgres", password=SENHA, host="localhost", port="5432")
cursor_projeto = conexao_projeto.cursor()

cursor_projeto.execute("""
CREATE TABLE IF NOT EXISTS politica_privacidade (
    id SERIAL PRIMARY KEY,
    versao VARCHAR(20) NOT NULL,
    ultima_atualizacao DATE NOT NULL DEFAULT CURRENT_DATE,
    ativo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS secoes_privacidade (
    id SERIAL PRIMARY KEY,
    politica_id INT REFERENCES politica_privacidade(id) ON DELETE CASCADE,
    ordem INT NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    conteudo TEXT NOT NULL
);
""")

cursor_projeto.execute("TRUNCATE TABLE politica_privacidade CASCADE;")
cursor_projeto.execute("INSERT INTO politica_privacidade (versao, ultima_atualizacao) VALUES ('1.0', '2026-10-13') RETURNING id;")
id_politica = cursor_projeto.fetchone()[0]

cursor_projeto.execute("""
INSERT INTO secoes_privacidade (politica_id, ordem, titulo, conteudo) VALUES 
(%s, 1, 'Informações que Coletamos', 'A Sem Barreiras Pet coleta informações pessoais que você nos fornece voluntariamente ao se cadastrar em nossos serviços, como nome e e-mail.'),
(%s, 2, 'Como Usamos Suas Informações', 'Utilizamos os dados coletados para melhorar sua experiência, garantir a segurança do sistema e personalizar as sugestões de adoção.')
""", (id_politica, id_politica))

conexao_projeto.commit()
cursor_projeto.close()
conexao_projeto.close()

print("Tabelas prontas e dados inseridos com sucesso!")
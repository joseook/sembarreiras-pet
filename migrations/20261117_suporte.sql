-- Support tables only. Run flask prepare-db to also register the current policy.

BEGIN;


CREATE TABLE IF NOT EXISTS sessoes_usuarios (
	token_hash VARCHAR(64) NOT NULL,
	usuario_id INTEGER NOT NULL,
	expira_em TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	PRIMARY KEY (token_hash),
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
)

;

CREATE INDEX IF NOT EXISTS ix_sessoes_usuarios_expira_em ON sessoes_usuarios (expira_em);

CREATE INDEX IF NOT EXISTS ix_sessoes_usuarios_usuario_id ON sessoes_usuarios (usuario_id);

ALTER TABLE sessoes_usuarios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE sessoes_usuarios FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE sessoes_usuarios FROM authenticated; END IF; END $$;


CREATE TABLE IF NOT EXISTS tentativas_acesso (
	id SERIAL NOT NULL,
	chave VARCHAR(64) NOT NULL,
	criado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	PRIMARY KEY (id)
)

;

CREATE INDEX IF NOT EXISTS ix_tentativas_acesso_chave ON tentativas_acesso (chave);

CREATE INDEX IF NOT EXISTS ix_tentativas_acesso_criado_em ON tentativas_acesso (criado_em);

ALTER TABLE tentativas_acesso ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE tentativas_acesso FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE tentativas_acesso FROM authenticated; END IF; END $$;


CREATE TABLE IF NOT EXISTS pet_midias (
	pet_id VARCHAR(50) NOT NULL,
	fotos JSON NOT NULL,
	PRIMARY KEY (pet_id),
	FOREIGN KEY(pet_id) REFERENCES pets (id) ON DELETE CASCADE
)

;

ALTER TABLE pet_midias ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE pet_midias FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE pet_midias FROM authenticated; END IF; END $$;


CREATE TABLE IF NOT EXISTS mensagens_contato (
	id VARCHAR(32) NOT NULL,
	nome VARCHAR(100) NOT NULL,
	email VARCHAR(254) NOT NULL,
	assunto VARCHAR(30) NOT NULL,
	mensagem TEXT NOT NULL,
	criado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	PRIMARY KEY (id)
)

;

ALTER TABLE mensagens_contato ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE mensagens_contato FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE mensagens_contato FROM authenticated; END IF; END $$;

COMMIT;

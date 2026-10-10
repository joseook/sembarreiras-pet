"""Application Factory da API do Sem Barreiras Pet."""

import logging
import secrets

from flask import Flask
from sqlalchemy import event

from .config import get_config
from .extensions import cors, db, migrate
from .utils.errors import register_error_handlers

logger = logging.getLogger(__name__)


def create_app(config_name: str | None = None, overrides: dict | None = None) -> Flask:
    """Cria e configura a aplicação.

    :param config_name: "development", "testing" ou "production".
        Se omitido, usa a variável FLASK_ENV (padrão: development).
    :param overrides: valores que sobrescrevem a configuração (útil em testes).
    """
    app = Flask(__name__)
    app.config.from_object(get_config(config_name))
    if overrides:
        app.config.update(overrides)

    _ensure_required_settings(app)

    # JSON em UTF-8 legível ("Maceió", não "Maceió") e na ordem dos campos.
    app.json.ensure_ascii = False
    app.json.sort_keys = False

    db.init_app(app)
    migrate.init_app(app, db)
    if app.config["CORS_ORIGINS"]:
        # Somente as origens listadas; nunca "*".
        cors.init_app(app, resources={r"/api/*": {
            "origins": app.config["CORS_ORIGINS"],
            "methods": ["GET", "POST", "OPTIONS"],
        }})

    with app.app_context():
        if db.engine.dialect.name == "sqlite":
            _enable_sqlite_foreign_keys()

    # Importa os modelos para que o Alembic os enxergue (autogenerate).
    from . import models  # noqa: F401
    from .api import api_bp

    app.register_blueprint(api_bp)
    register_error_handlers(app)
    return app


def _ensure_required_settings(app: Flask) -> None:
    missing = [key for key in app.config["REQUIRED_SETTINGS"] if not app.config.get(key)]
    if missing:
        names = {"SQLALCHEMY_DATABASE_URI": "DATABASE_URL"}
        readable = ", ".join(names.get(key, key) for key in missing)
        raise RuntimeError(
            f"Configuração obrigatória ausente: {readable}. "
            "Crie o arquivo .env a partir de .env.example (veja docs/setup.md)."
        )

    if not app.config.get("SECRET_KEY"):
        # Apenas em desenvolvimento (produção exige SECRET_KEY acima).
        app.config["SECRET_KEY"] = secrets.token_hex(32)
        logger.warning("SECRET_KEY não definida: usando chave temporária de desenvolvimento.")


def _enable_sqlite_foreign_keys() -> None:
    """SQLite (usado nos testes) não verifica chaves estrangeiras por padrão."""

    @event.listens_for(db.engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

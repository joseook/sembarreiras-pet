"""Configurações por ambiente.

As variáveis vêm do arquivo ``.env`` na RAIZ do repositório (um único
arquivo para back-end e Docker Compose; modelo em ``.env.example``).
Variáveis já definidas no ambiente têm prioridade sobre o ``.env``.

O ambiente é escolhido por ``FLASK_ENV`` (development, testing, production).
Observação: o Flask 2.3+ não usa mais ``FLASK_ENV`` internamente; aqui ela é
lida apenas pelo projeto para selecionar a classe de configuração.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")

DEV_CORS_ORIGINS = ["http://localhost:8000", "http://127.0.0.1:8000"]


def _split_csv(value: str | None) -> list[str]:
    return [item.strip() for item in (value or "").split(",") if item.strip()]


class BaseConfig:
    SECRET_KEY = os.getenv("SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Origens autorizadas a chamar /api/* pelo navegador (separadas por vírgula).
    CORS_ORIGINS = _split_csv(os.getenv("CORS_ORIGINS"))

    # Fuso usado quando o cliente envia data/hora sem offset.
    APP_TIMEZONE = os.getenv("APP_TIMEZONE", "America/Maceio")

    # Antecedência máxima para solicitar visita (evita datas absurdas).
    VISIT_MAX_DAYS_AHEAD = 180

    # Enquanto não existe autenticação, POST/GET /api/visits aceitam o user_id
    # no corpo da requisição. Isso só é aceitável em desenvolvimento e testes.
    ALLOW_DEMO_USER_ID = False

    GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

    REQUIRED_SETTINGS = ("SECRET_KEY", "SQLALCHEMY_DATABASE_URI")


class DevelopmentConfig(BaseConfig):
    ENV_NAME = "development"
    DEBUG = True
    CORS_ORIGINS = BaseConfig.CORS_ORIGINS or DEV_CORS_ORIGINS
    ALLOW_DEMO_USER_ID = True
    # Em desenvolvimento, sem SECRET_KEY a factory gera uma chave temporária.
    REQUIRED_SETTINGS = ("SQLALCHEMY_DATABASE_URI",)


class TestingConfig(BaseConfig):
    """Testes usam SQLite em memória por padrão (isolado e sem dependências).

    Para rodar contra PostgreSQL, defina TEST_DATABASE_URL.
    """

    ENV_NAME = "testing"
    TESTING = True
    SECRET_KEY = "chave-apenas-para-testes"
    SQLALCHEMY_DATABASE_URI = os.getenv("TEST_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    CORS_ORIGINS = DEV_CORS_ORIGINS
    ALLOW_DEMO_USER_ID = True


class ProductionConfig(BaseConfig):
    ENV_NAME = "production"
    DEBUG = False


CONFIGS = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(name: str | None):
    name = (name or os.getenv("FLASK_ENV") or "development").lower()
    try:
        return CONFIGS[name]
    except KeyError:
        valid = ", ".join(CONFIGS)
        raise RuntimeError(f"FLASK_ENV inválido: {name!r}. Use um de: {valid}.") from None

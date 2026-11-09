import os
import socket
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Carrega variáveis do arquivo .env se existir
load_dotenv(BASE_DIR / '.env')

def _is_local_postgres_available(host="localhost", port=5432, timeout=0.3):
    """Verifica rapidamente se a porta local do PostgreSQL está aberta."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'sembarreiras-pet-chave-secreta-dev')
    
    raw_url = os.getenv(
        'DATABASE_URL',
        'postgresql+psycopg2://postgres:postgres@localhost:5432/sembarreiras_db'
    )
    
    # Compatibilidade com prefixo legado do Heroku/Render
    if raw_url and raw_url.startswith('postgres://'):
        raw_url = raw_url.replace('postgres://', 'postgresql+psycopg2://', 1)
    elif raw_url and raw_url.startswith('postgresql://'):
        raw_url = raw_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
        
    # Se a URL aponta para localhost mas o serviço PostgreSQL não está rodando localmente,
    # usa SQLite local (sembarreiras.db) como fallback seguro para desenvolvimento/testes.
    is_local_pg = bool(raw_url and ('localhost:5432' in raw_url or '127.0.0.1:5432' in raw_url))
    if is_local_pg and not _is_local_postgres_available():
        sqlite_db = (BASE_DIR / 'sembarreiras.db').as_posix()
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{sqlite_db}"
    else:
        SQLALCHEMY_DATABASE_URI = raw_url

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    if 'postgresql' in (SQLALCHEMY_DATABASE_URI or ''):
        SQLALCHEMY_ENGINE_OPTIONS = {
            'pool_pre_ping': True,
            'pool_recycle': 300,
        }
    else:
        SQLALCHEMY_ENGINE_OPTIONS = {}

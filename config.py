"""Configuração explícita de desenvolvimento e produção."""
import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / '.env')

class Config:
    PRODUCTION = os.getenv('VERCEL') == '1' or os.getenv('APP_ENV') == 'production'
    SECRET_KEY = os.getenv('SECRET_KEY') or (None if PRODUCTION else secrets.token_hex(32))
    raw_url = os.getenv('DATABASE_URL')
    if raw_url and raw_url.startswith(('postgres://', 'postgresql://')):
        raw_url = 'postgresql+psycopg2://' + raw_url.split('://', 1)[1]
    SQLALCHEMY_DATABASE_URI = raw_url or (None if PRODUCTION else f"sqlite:///{(BASE_DIR / 'sembarreiras.db').as_posix()}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True, 'pool_recycle': 300} if raw_url and 'postgresql' in raw_url else {}
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = PRODUCTION
    MAX_CONTENT_LENGTH = 16 * 1024
    FRONTEND_ORIGIN = os.getenv('FRONTEND_ORIGIN', '').rstrip('/')

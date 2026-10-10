"""Ponto de entrada WSGI (ex.: `flask --app wsgi run` ou um servidor como gunicorn)."""

from app import create_app

app = create_app()

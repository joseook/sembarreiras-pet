"""CLI do projeto. Execute a partir da pasta backend/:

    python manage.py run                 # servidor de desenvolvimento
    python manage.py db upgrade          # aplica migrations (Flask-Migrate)
    python manage.py seed                # dados fictícios de desenvolvimento
    python manage.py frontend-config     # gera frontend/config.js a partir do .env

Todos os comandos do Flask (routes, shell, db ...) também ficam disponíveis.
"""

import json
import os
from pathlib import Path

import click
from flask import current_app
from flask.cli import FlaskGroup

from app import create_app
from app.seed import get_demo_user, seed_development_data

FRONTEND_CONFIG_PATH = Path(__file__).resolve().parent.parent / "frontend" / "config.js"


@click.group(cls=FlaskGroup, create_app=create_app)
def cli():
    """Comandos de gerenciamento do Sem Barreiras Pet."""


@cli.command("seed")
def seed():
    """Cria usuário, abrigo e pets FICTÍCIOS (somente desenvolvimento)."""
    if current_app.config["ENV_NAME"] == "production":
        raise click.ClickException("O seed de demonstração não pode ser executado em produção.")
    ids = seed_development_data()
    click.echo("Dados de demonstração prontos (fictícios):")
    click.echo(f"  usuário demo  -> id {ids['user_id']}")
    click.echo(f"  abrigo demo   -> id {ids['shelter_id']}")
    click.echo("Gere o config do front-end com: python manage.py frontend-config")


@cli.command("frontend-config")
@click.option("--api-base-url", default=lambda: os.getenv("FRONTEND_API_BASE_URL") or "http://localhost:5000/api",
              show_default="FRONTEND_API_BASE_URL ou http://localhost:5000/api")
def frontend_config(api_base_url: str):
    """Gera frontend/config.js (ignorado pelo Git) com valores do .env."""
    demo_user_id = None
    if current_app.config["ALLOW_DEMO_USER_ID"]:
        try:
            user = get_demo_user()
            demo_user_id = user.id if user else None
        except Exception as exc:  # banco fora do ar não impede gerar o arquivo
            click.echo(f"Aviso: não foi possível consultar o usuário demo ({exc.__class__.__name__}).")

    config = {
        "apiBaseUrl": api_base_url,
        "googleMapsApiKey": current_app.config["GOOGLE_MAPS_API_KEY"],
        "googleMapsMapId": os.getenv("GOOGLE_MAPS_MAP_ID") or "DEMO_MAP_ID",
        "demoUserId": demo_user_id,
    }
    content = (
        "// ARQUIVO GERADO por `python manage.py frontend-config`. Não versionar.\n"
        "// Modelo comentado: frontend/config.example.js\n"
        f"export default {json.dumps(config, indent=2, ensure_ascii=False)};\n"
    )
    FRONTEND_CONFIG_PATH.write_text(content, encoding="utf-8")
    click.echo(f"Gerado: {FRONTEND_CONFIG_PATH}")
    if demo_user_id is None:
        click.echo("demoUserId vazio: o formulário de visita ficará em modo prévia (rode `python manage.py seed`).")
    if not config["googleMapsApiKey"]:
        click.echo("GOOGLE_MAPS_API_KEY vazio: o mapa mostrará o fallback textual.")


if __name__ == "__main__":
    cli()

"""Fixtures compartilhadas.

Os testes usam SQLite em memória (TestingConfig): rápidos e sem precisar de
PostgreSQL. Os modelos evitam recursos exclusivos do PostgreSQL (enums são
VARCHAR + CHECK), então o comportamento é equivalente para estes cenários.
Para rodar contra PostgreSQL, defina TEST_DATABASE_URL (banco descartável!).
"""

from datetime import datetime, timedelta, timezone

import pytest

from app import create_app
from app.extensions import db
from app.models import Pet, Shelter, User


@pytest.fixture()
def app():
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def user(app):
    user = User(name="Camila Teste", email="camila@exemplo.invalid", phone="(82) 90000-0000")
    user.set_password("senha-de-teste-123")
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture()
def shelter(app):
    shelter = Shelter(
        name="Abrigo Teste",
        address_line="Rua de Teste, 0",
        neighborhood="Centro",
        city="Maceió",
        state="AL",
        postal_code="00000-000",
        latitude=-9.6658,
        longitude=-35.7353,
    )
    db.session.add(shelter)
    db.session.commit()
    return shelter


@pytest.fixture()
def pet(shelter):
    pet = Pet(shelter_id=shelter.id, name="Café", species="cao")
    db.session.add(pet)
    db.session.commit()
    return pet


@pytest.fixture()
def future_iso():
    """Data/hora ISO 8601 com offset de Maceió, 3 dias no futuro."""
    moment = datetime.now(timezone(timedelta(hours=-3))) + timedelta(days=3)
    return moment.replace(hour=14, minute=0, second=0, microsecond=0).isoformat()

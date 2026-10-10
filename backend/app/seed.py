"""Dados de DESENVOLVIMENTO (fictícios).

Tudo aqui é demonstrativo: o abrigo, o endereço e as pessoas NÃO existem.
- E-mails usam o domínio reservado ".invalid" (RFC 2606), que nunca entrega mensagens.
- As coordenadas são um ponto aproximado do centro de Maceió/AL, sem
  correspondência com um endereço real. São as mesmas usadas em
  frontend/pages/como-funciona.html (data-lat / data-lng).

O seed é idempotente: rodar várias vezes não duplica registros.
"""

import secrets

from .extensions import db
from .models import AdoptionStatus, Pet, Shelter, User

DEMO_USER_EMAIL = "adotante.demo@sembarreiras.invalid"
DEMO_SHELTER_NAME = "Abrigo Patas Livres"

# MOCK: centro aproximado de Maceió/AL. Não representa um endereço real.
DEMO_LATITUDE = -9.6658
DEMO_LONGITUDE = -35.7353

DEMO_PETS = [
    {
        "name": "Café", "species": "cao", "size": "medio", "age_group": "idoso",
        "temperament": "Calmo, gosta de cochilar ao sol",
        "special_needs": "Medicação diária para as articulações (exemplo).",
        "description": "Pet fictício usado para demonstração.",
    },
    {
        "name": "Pipoca", "species": "gato", "size": "pequeno", "age_group": "filhote",
        "temperament": "Curiosa e brincalhona, convive bem com outros gatos",
        "special_needs": None,
        "description": "Pet fictício usado para demonstração.",
    },
    {
        "name": "Tom", "species": "cao", "size": "grande", "age_group": "adulto",
        "temperament": "Tranquilo, adora passeios curtos",
        "special_needs": "Displasia leve no quadril; prefere casa sem escadas (exemplo).",
        "description": "Pet fictício usado para demonstração.",
    },
]


def get_demo_user() -> User | None:
    return db.session.scalar(db.select(User).where(User.email == DEMO_USER_EMAIL))


def seed_development_data() -> dict:
    """Cria (se ainda não existirem) usuário, abrigo e pets de demonstração."""
    user = get_demo_user()
    if user is None:
        user = User(name="Pessoa Adotante (demonstração)", email=DEMO_USER_EMAIL, phone="(00) 00000-0000")
        # Senha aleatória e descartada: a conta demo não serve para login.
        user.set_password(secrets.token_urlsafe(32))
        db.session.add(user)

    shelter = db.session.scalar(db.select(Shelter).where(Shelter.name == DEMO_SHELTER_NAME))
    if shelter is None:
        shelter = Shelter(
            name=DEMO_SHELTER_NAME,
            description="Abrigo FICTÍCIO criado pelo seed de desenvolvimento. Não é uma entidade real.",
            contact_email="contato@abrigo-patas-livres.invalid",
            contact_phone=None,
            address_line="Rua Demonstrativa, nº 000 (endereço fictício)",
            neighborhood="Bairro Exemplo",
            city="Maceió",
            state="AL",
            postal_code="00000-000",
            latitude=DEMO_LATITUDE,
            longitude=DEMO_LONGITUDE,
            is_active=True,
        )
        db.session.add(shelter)
        db.session.flush()

    existing = set(db.session.scalars(db.select(Pet.name).where(Pet.shelter_id == shelter.id)))
    for data in DEMO_PETS:
        if data["name"] not in existing:
            db.session.add(Pet(shelter_id=shelter.id, adoption_status=AdoptionStatus.DISPONIVEL, **data))

    db.session.commit()
    return {"user_id": user.id, "shelter_id": shelter.id}

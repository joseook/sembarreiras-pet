from datetime import datetime, timedelta, timezone

from app import create_app
from app.extensions import db
from app.models import AdoptionStatus


def _payload(user, shelter, scheduled_at, **extra):
    return {"user_id": user.id, "shelter_id": shelter.id, "scheduled_at": scheduled_at, **extra}


def test_create_visit_returns_201_with_initial_status(client, user, shelter, future_iso):
    response = client.post("/api/visits", json=_payload(user, shelter, future_iso, adopter_notes="  Quero conhecer o Café.  "))

    assert response.status_code == 201
    data = response.get_json()["data"]
    assert data["status"] == "solicitado"
    assert data["user_id"] == user.id
    assert data["shelter_id"] == shelter.id
    assert data["pet_id"] is None
    assert data["adopter_notes"] == "Quero conhecer o Café."
    assert response.headers["Location"].endswith(f"/api/visits/{data['id']}")

    # Gravado em UTC: 14:00 em Maceió (-03:00) = 17:00Z
    assert data["scheduled_at"].endswith("T17:00:00Z")


def test_create_visit_with_pet(client, user, shelter, pet, future_iso):
    response = client.post("/api/visits", json=_payload(user, shelter, future_iso, pet_id=pet.id))

    assert response.status_code == 201
    assert response.get_json()["data"]["pet_id"] == pet.id


def test_get_visit_details(client, user, shelter, future_iso):
    created = client.post("/api/visits", json=_payload(user, shelter, future_iso)).get_json()["data"]

    response = client.get(f"/api/visits/{created['id']}")

    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["id"] == created["id"]
    assert data["shelter"] == {"id": shelter.id, "name": "Abrigo Teste"}


def test_get_missing_visit_returns_404(client):
    assert client.get("/api/visits/12345").status_code == 404


def test_past_date_is_rejected(client, user, shelter):
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()

    response = client.post("/api/visits", json=_payload(user, shelter, yesterday))

    assert response.status_code == 422
    error = response.get_json()["error"]
    assert error["code"] == "validation_error"
    assert "scheduled_at" in error["details"]


def test_missing_required_fields_returns_validation_errors(client):
    response = client.post("/api/visits", json={})

    assert response.status_code == 422
    details = response.get_json()["error"]["details"]
    assert set(details) == {"user_id", "shelter_id", "scheduled_at"}


def test_invalid_types_are_rejected(client, future_iso):
    response = client.post("/api/visits", json={
        "user_id": True, "shelter_id": "abc", "scheduled_at": "amanhã", "adopter_notes": 42,
    })

    assert response.status_code == 422
    assert set(response.get_json()["error"]["details"]) == {"user_id", "shelter_id", "scheduled_at", "adopter_notes"}


def test_non_json_body_returns_400(client):
    response = client.post("/api/visits", data="nao-e-json", content_type="text/plain")

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "invalid_json"


def test_unknown_user_and_shelter_are_rejected(client, future_iso):
    response = client.post("/api/visits", json={"user_id": 99, "shelter_id": 98, "scheduled_at": future_iso})

    assert response.status_code == 422
    assert set(response.get_json()["error"]["details"]) == {"user_id", "shelter_id"}


def test_adopted_pet_cannot_be_visited(client, user, shelter, pet, future_iso):
    pet.adoption_status = AdoptionStatus.ADOTADO
    db.session.commit()

    response = client.post("/api/visits", json=_payload(user, shelter, future_iso, pet_id=pet.id))

    assert response.status_code == 422
    assert "pet_id" in response.get_json()["error"]["details"]


def test_visits_are_disabled_without_demo_mode():
    """Em produção (sem autenticação ainda), o user_id do corpo não é aceito."""
    app = create_app("testing", overrides={"ALLOW_DEMO_USER_ID": False})

    response = app.test_client().post("/api/visits", json={})

    assert response.status_code == 501
    assert response.get_json()["error"]["code"] == "auth_not_implemented"

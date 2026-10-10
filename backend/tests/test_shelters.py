from app.extensions import db
from app.models import Shelter


def test_list_shelters_returns_expected_format(client, shelter):
    inactive = Shelter(name="Abrigo Inativo", address_line="Rua X", city="Maceió", state="AL", is_active=False)
    db.session.add(inactive)
    db.session.commit()

    response = client.get("/api/shelters")

    assert response.status_code == 200
    body = response.get_json()
    assert body["meta"] == {"total": 1}
    assert [item["name"] for item in body["data"]] == ["Abrigo Teste"]

    item = body["data"][0]
    assert set(item) >= {"id", "name", "address", "latitude", "longitude", "is_active"}
    assert set(item["address"]) == {"line", "neighborhood", "city", "state", "postal_code", "full"}
    assert item["address"]["city"] == "Maceió"
    assert item["latitude"] == -9.6658
    assert item["longitude"] == -35.7353


def test_get_shelter_detail(client, shelter):
    response = client.get(f"/api/shelters/{shelter.id}")

    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["id"] == shelter.id
    assert data["address"]["full"] == "Rua de Teste, 0, Centro, Maceió - AL, 00000-000"


def test_get_missing_shelter_returns_404(client):
    response = client.get("/api/shelters/999")

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "not_found"

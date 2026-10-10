def test_health_returns_ok(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert body["service"] == "sembarreiras-pet-api"


def test_unknown_route_returns_json_error(client):
    response = client.get("/api/nao-existe")

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "not_found"


def test_cors_allows_only_configured_origin(client):
    allowed = client.get("/api/health", headers={"Origin": "http://localhost:8000"})
    blocked = client.get("/api/health", headers={"Origin": "https://site-malicioso.example"})

    assert allowed.headers.get("Access-Control-Allow-Origin") == "http://localhost:8000"
    assert "Access-Control-Allow-Origin" not in blocked.headers

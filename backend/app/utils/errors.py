"""Erros da API e respostas JSON padronizadas.

Formato de todo erro:

    {"error": {"code": "validation_error", "message": "...", "details": {...}}}
"""

import logging

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


class APIError(Exception):
    """Erro conhecido da API, convertido em resposta JSON."""

    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, status_code: int | None = None,
                 code: str | None = None, details: dict | None = None):
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code
        self.details = details or {}


class ValidationError(APIError):
    """Dados recebidos são inválidos (HTTP 422). ``details`` mapeia campo -> mensagem."""

    status_code = 422
    code = "validation_error"

    def __init__(self, details: dict, message: str = "Alguns dados precisam ser corrigidos."):
        super().__init__(message, details=details)


class NotFoundError(APIError):
    status_code = 404
    code = "not_found"


def error_response(status_code: int, code: str, message: str, details: dict | None = None):
    body = {"error": {"code": code, "message": message, "details": details or {}}}
    return jsonify(body), status_code


# Mensagens em português para os erros HTTP genéricos do Werkzeug.
HTTP_MESSAGES = {
    400: "Requisição inválida.",
    404: "Recurso não encontrado.",
    405: "Método não permitido para este endereço.",
    415: "Envie os dados no formato JSON.",
}


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(APIError)
    def handle_api_error(error: APIError):
        return error_response(error.status_code, error.code, error.message, error.details)

    @app.errorhandler(HTTPException)
    def handle_http_exception(error: HTTPException):
        code = (error.name or "http_error").lower().replace(" ", "_")
        message = HTTP_MESSAGES.get(error.code, error.description or "Erro na requisição.")
        return error_response(error.code or 500, code, message)

    @app.errorhandler(Exception)
    def handle_unexpected(error: Exception):
        logger.exception("Erro inesperado na API", exc_info=error)
        return error_response(500, "internal_error", "Erro interno do servidor. Tente novamente mais tarde.")

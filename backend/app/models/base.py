"""Utilitários compartilhados pelos modelos."""

import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, func
from sqlalchemy.orm import Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime | None) -> datetime | None:
    """Garante datetime com fuso UTC.

    O PostgreSQL devolve ``timestamptz`` com fuso; o SQLite (testes) devolve
    datetime sem fuso, que aqui é tratado como UTC (é assim que gravamos).
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def isoformat_utc(value: datetime | None) -> str | None:
    value = as_utc(value)
    return value.isoformat().replace("+00:00", "Z") if value else None


class TimestampMixin:
    """Adiciona created_at e updated_at (sempre em UTC)."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow,
        server_default=func.now(), nullable=False,
    )


def enum_type(enum_cls: type[enum.Enum], name: str) -> Enum:
    """Enum armazenado como VARCHAR + CHECK (mais simples de migrar que o ENUM nativo)."""
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=20,
        validate_strings=True,
        values_callable=lambda members: [member.value for member in members],
    )

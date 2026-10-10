"""Modelos do banco. Importar daqui garante que todos sejam registrados no metadata."""

from .pet import AdoptionStatus, Pet
from .shelter import Shelter
from .user import User
from .visit import Visit, VisitStatus

__all__ = ["AdoptionStatus", "Pet", "Shelter", "User", "Visit", "VisitStatus"]

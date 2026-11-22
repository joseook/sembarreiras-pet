"""Preparação explícita das tabelas e dados demonstrativos; preserva registros."""
import json
from pathlib import Path
from database import db
from models import Pet, PetMidia
from politica import publicar_politica
from preparacao import preparar_tabelas


def exemplos():
    return json.loads((Path(__file__).parent / 'assets/js/data/pets.json').read_text(encoding='utf-8'))


def importar_fotos_exemplo():
    """Operação explícita: associa fotos fictícias a exemplos já cadastrados."""
    for dados in exemplos():
        pet = db.session.get(Pet, dados['id'])
        if (pet and all(getattr(pet, campo) == dados[campo] for campo in ('nome', 'especie', 'raca', 'historia'))
                and not db.session.get(PetMidia, pet.id)):
            db.session.add(PetMidia(pet_id=pet.id, fotos=dados['fotos']))
    db.session.commit()


def inicializar_banco(app):
    with app.app_context():
        try:
            preparar_tabelas()
        except Exception:
            db.session.rollback()
            print('Não foi possível preparar as tabelas. Confira a configuração do servidor.')
            return False
        publicar_politica()
        if not db.session.get(Pet, 'nina'):
            dados = next(p for p in exemplos() if p['id'] == 'nina')
            campos = {c.name for c in Pet.__table__.columns} - {'criado_em'}
            pet = Pet(**{k: v for k, v in dados.items() if k in campos})
            pet.doencas_passadas = dados['doencasPassadas']
            pet.doencas_atuais = dados['doencasAtuais']
            db.session.add(pet)
            db.session.flush()
            db.session.add(PetMidia(pet_id=pet.id, fotos=dados['fotos']))
        db.session.commit()
        return True


if __name__ == '__main__':
    from app import create_app
    inicializar_banco(create_app())

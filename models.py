from datetime import date, datetime, timezone
import json
from database import db
from werkzeug.security import generate_password_hash, check_password_hash

def agora_utc():
    return datetime.now(timezone.utc)



class PoliticaPrivacidade(db.Model):
    __tablename__ = 'politica_privacidade'
    
    id = db.Column(db.Integer, primary_key=True)
    versao = db.Column(db.String(20), nullable=False, default='1.0')
    ultima_atualizacao = db.Column(db.Date, nullable=False, default=date.today)
    ativo = db.Column(db.Boolean, default=True)
    
    # Relacionamento com as seções ordenadas
    secoes = db.relationship(
        'SecaoPrivacidade',
        backref='politica',
        lazy='joined',
        cascade='all, delete-orphan',
        order_by='SecaoPrivacidade.ordem'
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'versao': self.versao,
            'ultima_atualizacao': self.ultima_atualizacao.isoformat() if self.ultima_atualizacao else None,
            'ativo': self.ativo,
            'secoes': [s.to_dict() for s in self.secoes]
        }


class SecaoPrivacidade(db.Model):
    __tablename__ = 'secoes_privacidade'
    
    id = db.Column(db.Integer, primary_key=True)
    politica_id = db.Column(db.Integer, db.ForeignKey('politica_privacidade.id', ondelete='CASCADE'), nullable=False)
    ordem = db.Column(db.Integer, nullable=False, default=1)
    titulo = db.Column(db.String(255), nullable=False)
    conteudo = db.Column(db.Text, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'ordem': self.ordem,
            'titulo': self.titulo,
            'conteudo': self.conteudo
        }


class Usuario(db.Model):
    __tablename__ = 'usuarios'
    
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    telefone = db.Column(db.String(30), nullable=False)
    senha_hash = db.Column(db.String(255), nullable=False)
    tipo_moradia = db.Column(db.String(30), nullable=False)  # 'casa' ou 'apartamento'
    consentimento = db.Column(db.Boolean, default=True, nullable=False)
    criado_em = db.Column(db.DateTime, default=agora_utc)
    
    agendamentos = db.relationship('Agendamento', backref='usuario', lazy=True)
    
    def set_senha(self, senha: str):
        self.senha_hash = generate_password_hash(senha)
        
    def check_senha(self, senha: str) -> bool:
        return check_password_hash(self.senha_hash, senha)
        
    def to_dict(self):
        return {
            'id': self.id,
            'nome': self.nome,
            'email': self.email,
            'telefone': self.telefone,
            'tipo_moradia': self.tipo_moradia,
            'criado_em': self.criado_em.isoformat() if self.criado_em else None
        }


class Pet(db.Model):
    __tablename__ = 'pets'
    
    id = db.Column(db.String(50), primary_key=True)  # ex: 'nina'
    nome = db.Column(db.String(100), nullable=False)
    especie = db.Column(db.String(50), nullable=False)  # 'Cachorro', 'Gato', etc.
    sexo = db.Column(db.String(20), nullable=False)     # 'Fêmea', 'Macho'
    raca = db.Column(db.String(100), nullable=True)
    idade = db.Column(db.String(50), nullable=True)     # '2 anos'
    porte = db.Column(db.String(50), nullable=True)     # 'Pequeno', 'Médio', 'Grande'
    peso = db.Column(db.String(20), nullable=True)      # '11 kg'
    cor = db.Column(db.String(50), nullable=True)
    castrado = db.Column(db.Boolean, default=False)
    microchip = db.Column(db.Boolean, default=False)
    resumo = db.Column(db.String(255), nullable=True)
    historia = db.Column(db.Text, nullable=True)
    rotina = db.Column(db.Text, nullable=True)
    apartamento = db.Column(db.String(100), nullable=True)
    
    # Campos estruturados armazenados como JSON para flexibilidade
    temperamento = db.Column(db.JSON, nullable=True)
    vacinas = db.Column(db.JSON, nullable=True)
    doencas_passadas = db.Column(db.JSON, nullable=True)
    doencas_atuais = db.Column(db.JSON, nullable=True)
    exames = db.Column(db.JSON, nullable=True)
    
    vermifugo = db.Column(db.String(255), nullable=True)
    antiparasitario = db.Column(db.String(255), nullable=True)
    alergias = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(30), default='disponivel')  # 'disponivel', 'em-adocao', 'adotado'
    criado_em = db.Column(db.DateTime, default=agora_utc)
    
    agendamentos = db.relationship('Agendamento', backref='pet', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'nome': self.nome,
            'especie': self.especie,
            'sexo': self.sexo,
            'raca': self.raca,
            'idade': self.idade,
            'porte': self.porte,
            'peso': self.peso,
            'cor': self.cor,
            'castrado': self.castrado,
            'microchip': self.microchip,
            'resumo': self.resumo,
            'historia': self.historia,
            'rotina': self.rotina,
            'apartamento': self.apartamento,
            'temperamento': self.temperamento or [],
            # Ausência de registro não significa vacinação em dia ou ausência de doença.
            'vacinas': self.vacinas,
            'doencasPassadas': self.doencas_passadas,
            'doencasAtuais': self.doencas_atuais,
            'exames': self.exames,
            'vermifugo': self.vermifugo,
            'antiparasitario': self.antiparasitario,
            'alergias': self.alergias,
            'status': self.status
        }


class Agendamento(db.Model):
    __tablename__ = 'agendamentos'
    
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)
    pet_id = db.Column(db.String(50), db.ForeignKey('pets.id'), nullable=True)
    data_visita = db.Column(db.Date, nullable=False)
    horario = db.Column(db.String(10), nullable=False)
    mensagem = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(30), default='pendente')  # 'pendente', 'confirmado', 'cancelado'
    criado_em = db.Column(db.DateTime, default=agora_utc)
    
    def to_dict(self):
        return {
            'id': self.id,
            'usuario_id': self.usuario_id,
            'pet_id': self.pet_id,
            'data_visita': self.data_visita.isoformat() if self.data_visita else None,
            'horario': self.horario,
            'mensagem': self.mensagem,
            'status': self.status,
            'criado_em': self.criado_em.isoformat() if self.criado_em else None
        }

"""Campos editáveis do cadastro de pets e mensagens para o formulário."""
from urllib.parse import urlsplit

TEXTOS = {'nome': 100, 'especie': 50, 'sexo': 20, 'raca': 100, 'idade': 50,
          'porte': 50, 'peso': 20, 'cor': 50, 'resumo': 255, 'historia': 6000,
          'rotina': 6000, 'apartamento': 100, 'vermifugo': 255,
          'antiparasitario': 255, 'alergias': 255, 'status': 30}
STATUS = {'disponivel', 'em-adocao', 'adotado', 'arquivado'}


def validar_pet(dados, novo=False):
    if not isinstance(dados, dict) or not dados:
        return {}, {'formulario': 'Preencha os dados do pet.'}
    campos, erros = {}, {}
    if set(dados) - (set(TEXTOS) | {'castrado', 'microchip', 'temperamento', 'fotos'}):
        erros['formulario'] = 'Foram enviados campos que não podem ser editados.'
    for nome, limite in TEXTOS.items():
        if nome not in dados:
            if novo and nome in {'nome', 'especie', 'sexo'}:
                erros[nome] = 'Preencha este campo.'
            continue
        valor = dados[nome]
        if valor is None and nome not in {'nome', 'especie', 'sexo', 'status'}:
            campos[nome] = None
        elif not isinstance(valor, str) or len(valor.strip()) > limite:
            erros[nome] = f'Use um texto de até {limite} caracteres.'
        elif nome in {'nome', 'especie', 'sexo', 'status'} and not valor.strip():
            erros[nome] = 'Preencha este campo.'
        else:
            campos[nome] = valor.strip() or None
    for nome, opcoes in [('especie', {'Cachorro', 'Gato', 'Outro'}),
                          ('sexo', {'Fêmea', 'Macho', 'Não informado'}),
                          ('porte', {'Pequeno', 'Médio', 'Grande'}), ('status', STATUS)]:
        if campos.get(nome) is not None and campos[nome] not in opcoes:
            erros[nome] = 'Escolha uma opção da lista.'
    for nome in ('castrado', 'microchip'):
        if nome in dados:
            if dados[nome] is not None and type(dados[nome]) is not bool:
                erros[nome] = 'Escolha Sim, Não ou Não informado.'
            else:
                campos[nome] = dados[nome]
    if 'temperamento' in dados:
        valores = dados['temperamento']
        if not isinstance(valores, list) or len(valores) > 12 or any(
                not isinstance(v, str) or not 1 <= len(v.strip()) <= 50 for v in valores):
            erros['temperamento'] = 'Informe até 12 características, com até 50 caracteres cada.'
        else:
            campos['temperamento'] = list(dict.fromkeys(v.strip() for v in valores))
    if 'fotos' in dados:
        fotos = dados['fotos']
        if not isinstance(fotos, list) or len(fotos) > 6:
            erros['fotos'] = 'Adicione no máximo seis fotos.'
        else:
            for foto in fotos:
                if not isinstance(foto, dict) or not isinstance(foto.get('src'), str) or not isinstance(foto.get('alt'), str):
                    erros['fotos'] = 'Preencha o endereço e a descrição de cada foto.'; break
                src, alt = foto['src'].strip(), foto['alt'].strip()
                try:
                    url = urlsplit(src)
                    externa = url.scheme in {'http', 'https'} and bool(url.netloc)
                    local = any(src.startswith(p) for p in ('/assets/img/', '../assets/img/', 'assets/img/')) and '..' not in src.removeprefix('../')
                except ValueError:
                    externa = local = False
                if not (externa or local) or len(src) > 1500 or not 1 <= len(alt) <= 200:
                    erros['fotos'] = 'Use endereço HTTP/HTTPS ou imagem do projeto e uma descrição de até 200 caracteres.'; break
            if 'fotos' not in erros:
                campos['fotos'] = [{'src': f['src'].strip(), 'alt': f['alt'].strip()} for f in fotos]
    return campos, erros

#!/usr/bin/env python3
"""Troca declarações de nível superior de um arquivo JS pelas versões de outro arquivo.
uso: trocar.py alvo.js novas.js
Cada function/const/let/class de nível superior de novas.js (com os comentários logo acima) substitui a de mesmo
nome no alvo. Se o bloco começa com a linha "// @depois NOME", é uma declaração nova, posta logo depois de NOME."""
import re, sys
alvo, novas = sys.argv[1], sys.argv[2]
s = open(alvo).read()
n = open(novas).read()

def blocos(texto):
    linhas = texto.split('\n')
    pos = [0]
    for l in linhas:
        pos.append(pos[-1] + len(l) + 1)
    r = []
    i = 0
    while i < len(linhas):
        m = re.match(r'^(export\s+)?(function|const|let|class)\s+([A-Za-z_$][\w$]*)', linhas[i])
        if not m:
            i += 1
            continue
        nome = m.group(3)
        ini = i
        while ini > 0 and linhas[ini - 1].startswith('//'):
            ini -= 1
        l = re.sub(r'\s*//.*$', '', linhas[i])
        equilibrada = l.count('(') == l.count(')') and l.count('{') == l.count('}') and l.count('[') == l.count(']') and l.count('`') % 2 == 0
        if equilibrada and l.rstrip().endswith(';'):
            fim = i
        else:
            j = i + 1
            while j < len(linhas) and not re.match(r'^[\}\]\)`][\)\]\};,`(]*;?\s*(//.*)?$', linhas[j]):
                j += 1
            fim = j
        r.append((nome, pos[ini], min(pos[fim + 1], len(texto))))
        i = fim + 1
    return r

alvos = {nome: (a, b) for nome, a, b in blocos(s)}
trocas = []
for nome, a, b in blocos(n):
    trecho = n[a:b]
    m = re.match(r'// @depois (\w+)\n', trecho)
    if m:
        dep = m.group(1)
        trecho = trecho[m.end():]
        if nome in alvos:
            sys.exit(f'{nome}: já existe no alvo (tire o @depois)')
        if dep not in alvos:
            sys.exit(f'{nome}: @depois {dep} não existe no alvo')
        trocas.append((alvos[dep][1], alvos[dep][1], '\n' + trecho, f'{nome} (novo, depois de {dep})'))
    elif nome in alvos:
        trocas.append((alvos[nome][0], alvos[nome][1], trecho, nome))
    else:
        sys.exit(f'{nome}: não existe no alvo (use "// @depois NOME" para criar)')
for a, b, trecho, nome in sorted(trocas, key=lambda t: (t[0], t[1]), reverse=True):
    s = s[:a] + trecho + s[b:]
    print('trocado:', nome)
open(alvo, 'w').write(s)

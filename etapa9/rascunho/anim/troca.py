# Trocas seguras num arquivo: cada trecho antigo tem de aparecer exatamente uma vez
import sys, shutil, time
def trocar(caminho, pares):
    s = open(caminho).read()
    shutil.copy(caminho, '/tmp/claude-0/-home-user/92f63482-318d-57a2-ba81-43ab7e6086d3/scratchpad/anim/bak/ultimo-%d.js' % int(time.time()))
    for i, (velho, novo) in enumerate(pares):
        n = s.count(velho)
        if n != 1:
            raise SystemExit('troca %d: o trecho aparece %d vezes:\n%s' % (i, n, velho[:200]))
        s = s.replace(velho, novo)
    open(caminho, 'w').write(s)
    print('ok:', len(pares), 'trocas em', caminho)
def entre(caminho, inicio, fim):
    s = open(caminho).read()
    assert s.count(inicio) == 1, ('inicio', s.count(inicio))
    a = s.index(inicio)
    b = s.index(fim, a)
    return s[a:b]

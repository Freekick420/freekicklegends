#!/usr/bin/env python3
# Junta fotos lado a lado (antes | depois | ...) para comparar. Uso: lado.py saida.png [--corte x,y,w,h] [--escala k] a.png b.png ...
import sys
from PIL import Image
args = sys.argv[1:]
saida = args.pop(0)
corte = None
escala = 1.0
imgs = []
while args:
    a = args.pop(0)
    if a == '--corte':
        corte = tuple(int(v) for v in args.pop(0).split(','))
    elif a == '--escala':
        escala = float(args.pop(0))
    else:
        im = Image.open(a).convert('RGB')
        if corte:
            x, y, w, h = corte
            im = im.crop((x, y, x + w, y + h))
        if escala != 1.0:
            im = im.resize((int(im.width * escala), int(im.height * escala)), Image.LANCZOS)
        imgs.append(im)
w = sum(i.width for i in imgs) + 6 * (len(imgs) - 1)
h = max(i.height for i in imgs)
out = Image.new('RGB', (w, h), (255, 0, 255))
x = 0
for i in imgs:
    out.paste(i, (x, 0))
    x += i.width + 6
out.save(saida)
print(saida, out.size)

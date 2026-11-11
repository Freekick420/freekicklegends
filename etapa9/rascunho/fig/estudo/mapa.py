# Desenha o mapa (de cima) e a tela do celular (câmera de trás nominal) de cada caso do mapa.json
import json
import math
import sys
from PIL import Image, ImageDraw, ImageFont

entrada = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/-home-user/92f63482-318d-57a2-ba81-43ab7e6086d3/scratchpad/fig/estudo/mapa.json'
saida = sys.argv[2] if len(sys.argv) > 2 else '/tmp/claude-0/-home-user/92f63482-318d-57a2-ba81-43ab7e6086d3/scratchpad/fig/estudo/mapa.png'
casos = json.load(open(entrada))

E = float(sys.argv[3]) if len(sys.argv) > 3 else 11  # pixels por metro
X0, X1 = -24, 24
Z0, Z1 = -3, 40
W = int((X1 - X0) * E)
H = int((Z1 - Z0) * E)
TW, TH = (390, 844) if E > 12 else (234, 506)  # tela do celular
try:
    fonte = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 11)
    fonteG = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 13)
except Exception:
    fonte = ImageFont.load_default()
    fonteG = fonte

cols = min(int(sys.argv[4]) if len(sys.argv) > 4 else 3, len(casos))
linhas = math.ceil(len(casos) / cols)
PW = W + TW + 30
PH = max(H, TH) + 30
img = Image.new('RGB', (cols * PW, linhas * PH), (20, 60, 30))
d = ImageDraw.Draw(img)


def px(x, z, ox, oy):
    # x cresce para a direita; z (longe do gol) para baixo: o gol fica em cima
    return (ox + (x - X0) * E, oy + (z - Z0) * E)


for n, c in enumerate(casos):
    ox = (n % cols) * PW + 5
    oy = (n // cols) * PH + 22
    d.text((ox, oy - 18), c['titulo'] + f"  ({len(c['jogadores'])} figurantes)", fill=(255, 255, 255), font=fonteG)
    # campo
    d.rectangle([px(X0, Z0, ox, oy), px(X1, Z1, ox, oy)], fill=(34, 110, 50))
    branco = (230, 240, 230)
    d.line([px(-34, 0, ox, oy), px(34, 0, ox, oy)], fill=branco)
    d.rectangle([px(-20.16, 0, ox, oy), px(20.16, 16.5, ox, oy)], outline=branco)
    d.rectangle([px(-9.16, 0, ox, oy), px(9.16, 5.5, ox, oy)], outline=branco)
    d.rectangle([px(-3.66, -2, ox, oy), px(3.66, 0, ox, oy)], outline=(255, 255, 255), width=2)
    pm = px(0, 11, ox, oy)
    d.ellipse([pm[0] - 2, pm[1] - 2, pm[0] + 2, pm[1] + 2], fill=branco)
    ab = math.acos(5.5 / 9.15)
    pts = [px(9.15 * math.sin(a), 11 + 9.15 * math.cos(a), ox, oy) for a in [(-ab + i * (2 * ab) / 30) for i in range(31)]]
    d.line(pts, fill=branco)
    B = c['B']
    # corredor
    for bx, bz in c['borda']:
        p = px(bx, bz, ox, oy)
        d.point(p, fill=(255, 230, 80))
        d.point((p[0] + 1, p[1]), fill=(255, 230, 80))
    # zona da câmera (5 m para cada lado, 16 m atrás)
    dist = math.hypot(B['x'], B['z'])
    ax, az = B['x'] / dist, B['z'] / dist
    lx, lz = az, -ax
    quad = [(B['x'] + lx * 5, B['z'] + lz * 5), (B['x'] - lx * 5, B['z'] - lz * 5),
            (B['x'] - lx * 5 + ax * 16, B['z'] - lz * 5 + az * 16), (B['x'] + lx * 5 + ax * 16, B['z'] + lz * 5 + az * 16)]
    d.line([px(x, z, ox, oy) for x, z in quad + [quad[0]]], fill=(120, 160, 255))
    # 9,15 m
    pts = [px(B['x'] + 9.15 * math.sin(a), B['z'] + 9.15 * math.cos(a), ox, oy) for a in [i * 2 * math.pi / 60 for i in range(61)]]
    d.line(pts, fill=(90, 150, 100))
    # câmera e cobrador
    cam = c['camera']
    pc = px(cam['x'], cam['z'], ox, oy)
    d.rectangle([pc[0] - 3, pc[1] - 3, pc[0] + 3, pc[1] + 3], fill=(120, 160, 255))
    pi_ = px(c['inicio']['x'], c['inicio']['z'], ox, oy)
    pb = px(B['x'], B['z'], ox, oy)
    d.line([pi_, pb], fill=(255, 255, 255))
    d.ellipse([pi_[0] - 4, pi_[1] - 4, pi_[0] + 4, pi_[1] + 4], fill=(255, 140, 0))
    d.ellipse([pb[0] - 2, pb[1] - 2, pb[0] + 2, pb[1] + 2], fill=(255, 255, 255))
    for j in c['barreira']:
        p = px(j['x'], j['z'], ox, oy)
        d.rectangle([p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3], fill=(40, 40, 200))
    g = px(c['goleiro']['x'], c['goleiro']['z'], ox, oy)
    d.rectangle([g[0] - 3, g[1] - 3, g[0] + 3, g[1] + 3], fill=(200, 240, 40))
    for i, j in enumerate(c['jogadores']):
        p = px(j['x'], j['z'], ox, oy)
        cor = (230, 40, 40) if j['time'] == 'ataque' else (60, 90, 255)
        if j['plano']:
            q = px(j['plano']['x'], j['plano']['z'], ox, oy)
            d.line([p, q], fill=(255, 255, 255))
        r = 4
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=cor, outline=(255, 255, 0) if j['visto'] > 0.5 else (0, 0, 0))
        # para onde olha
        d.line([p, (p[0] + math.sin(j['rot']) * 9, p[1] + math.cos(j['rot']) * 9)], fill=(0, 0, 0))
        d.text((p[0] + 5, p[1] - 12), f"{i}{j['papel'][:2]}", fill=(255, 255, 255), font=fonte)
    # tela do celular
    tx = ox + W + 12
    ty = oy
    d.rectangle([tx, ty, tx + TW, ty + TH], fill=(40, 120, 60), outline=(255, 255, 255))
    # faixas da interface
    d.rectangle([tx, ty, tx + TW, ty + TH * 0.2], fill=(30, 40, 60))
    d.rectangle([tx, ty + TH * 0.77, tx + TW, ty + TH], fill=(30, 40, 60))

    def tela(xn, yn):
        return (tx + (xn * 0.5 + 0.5) * TW, ty + (0.5 - yn * 0.5) * TH)
    gol = c['gol']
    if all(g_['p'] > 0 for g_ in gol):
        d.line([tela(g_['x'], g_['y']) for g_ in [gol[0], gol[3], gol[2], gol[1]]], fill=(255, 255, 255), width=2)
    bt = c['bolaTela']
    if bt['p'] > 0:
        p = tela(bt['x'], bt['y'])
        d.ellipse([p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3], fill=(255, 255, 255))
    ordem = sorted([t for t in c['tela'] if t.get('p')], key=lambda t: -t['p'])
    for t in ordem:
        a = tela(t['x0'], t['y1'])
        b = tela(t['x1'], t['y0'])
        cor = {'cobrador': (255, 140, 0), 'barreira': (40, 40, 200), 'goleiro': (200, 240, 40), 'ataque': (230, 40, 40), 'defesa': (60, 90, 255)}[t['tipo']]
        if b[0] < tx or a[0] > tx + TW:
            continue
        d.rectangle([max(tx, a[0]), a[1], min(tx + TW, b[0]), b[1]], fill=cor, outline=(0, 0, 0))
        if 'i' in t:
            d.text((a[0], a[1] - 11), str(t['i']), fill=(255, 255, 255), font=fonte)

img.save(saida)
print('gravado', saida, img.size)

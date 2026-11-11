// Estudo: réplica da câmera de trás (posicionarCamera do main.js) para saber o que aparece no celular em pé.
import { CONFIG } from '/home/user/fkl-fig/js/config.js';
import { ELENCO } from '/home/user/fkl-fig/js/elenco.js';

const GRAUS = Math.PI / 180;

export function fovVertical(aspect, cfg = CONFIG) {
  const fov = 2 * Math.atan(Math.tan((cfg.camera.larguraVisivel * GRAUS) / 2) / aspect) / GRAUS;
  return Math.max(cfg.camera.fovMin, fov);
}

// Onde o cobrador espera (aproximação de criarCobranca: o pé de apoio fica ~0,25 m ao lado da bola;
// aqui uso a bola como referência do fim da corrida, com o erro de ~0,4 m que isso dá)
export function inicioDoCobrador(bola, jogador) {
  const c = jogador.cobranca || {};
  const dist = c.distancia ?? 2.0;
  const ang = (c.angulo ?? 30) * GRAUS;
  const lado = jogador.pe === 'D' ? 1 : -1;
  const yawChute = Math.atan2(0 - bola.x, 0 - bola.z);
  const yawCorrida = yawChute - lado * ang;
  const dir = { x: Math.sin(yawCorrida), z: Math.cos(yawCorrida) };
  // o grupo no apoio fica uns 0,35 m atrás e 0,2 m ao lado da bola
  return { x: bola.x - dir.x * (dist + 0.45), z: bola.z - dir.z * (dist + 0.45) };
}

export function cameraDeTras(bola, inicio, aspect, cfg = CONFIG) {
  const c = cfg.camera;
  const fov = fovVertical(aspect, cfg);
  const dist = Math.hypot(bola.x, bola.z);
  const ax = bola.x / dist;
  const az = bola.z / dist;
  const lx = az;
  const lz = -ax;
  const kx = inicio.x - bola.x;
  const kz = inicio.z - bola.z;
  const lateral = kx * lx + kz * lz;
  const fundo = kx * ax + kz * az;
  const hfov = 2 * Math.atan(Math.tan((fov * GRAUS) / 2) * aspect);
  const vfov = fov * GRAUS;
  const meia = cfg.golLargura / 2 + 1.0;
  let atras = Math.max(c.atras, fundo + c.atrasCobrador);
  let cx = 0;
  let cz = 0;
  let yaw = 0;
  let inclinacao = -c.inclinacao * GRAUS;
  for (let i = 0; i < 16; i++) {
    cx = bola.x + ax * atras + lx * lateral * c.pesoCobrador;
    cz = bola.z + az * atras + lz * lateral * c.pesoCobrador;
    const ang = (px, pz) => {
      const dx = px - cx;
      const dz = pz - cz;
      return Math.atan2(dx * lx + dz * lz, -(dx * ax + dz * az));
    };
    const dCobrador = Math.hypot(inicio.x - cx, inicio.z - cz);
    const aCobrador = ang(inicio.x, inicio.z);
    const folga = Math.atan2(0.7, dCobrador);
    const h = [ang(-meia, 0), ang(meia, 0), ang(bola.x, bola.z), aCobrador - folga, aCobrador + folga];
    const v = [Math.atan2(-c.altura, dCobrador), Math.atan2(cfg.golAltura + 0.4 - c.altura, Math.hypot(cx, cz))];
    const hMin = Math.min(...h);
    const hMax = Math.max(...h);
    yaw = (hMin + hMax) / 2;
    inclinacao = (v[0] + v[1]) / 2;
    if (hMax - hMin <= hfov * 0.86 && v[1] - v[0] <= vfov * 0.9) break;
    atras += 0.75;
  }
  const distanciaGol = Math.hypot(cx, cz);
  const dirx = -ax * Math.cos(yaw) + lx * Math.sin(yaw);
  const dirz = -az * Math.cos(yaw) + lz * Math.sin(yaw);
  const olhar = { x: cx + dirx * distanciaGol, y: c.altura + distanciaGol * Math.tan(inclinacao), z: cz + dirz * distanciaGol };
  return { pos: { x: cx, y: c.altura, z: cz }, olhar, fov, aspect, atras, yaw, inclinacao, eixo: { ax, az, lx, lz } };
}

// Projeta um ponto do mundo na tela (NDC: x e y de −1 a 1; z = profundidade em m)
export function projetar(cam, p) {
  const f = { x: cam.olhar.x - cam.pos.x, y: cam.olhar.y - cam.pos.y, z: cam.olhar.z - cam.pos.z };
  const fl = Math.hypot(f.x, f.y, f.z);
  f.x /= fl; f.y /= fl; f.z /= fl;
  // direita = f × cima
  let r = { x: f.y * 0 - f.z * 1, y: f.z * 0 - f.x * 0, z: f.x * 1 - f.y * 0 };
  r = { x: -f.z, y: 0, z: f.x };
  const rl = Math.hypot(r.x, r.z);
  r.x /= rl; r.z /= rl;
  const u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x };
  const d = { x: p.x - cam.pos.x, y: (p.y || 0) - cam.pos.y, z: p.z - cam.pos.z };
  const zc = d.x * f.x + d.y * f.y + d.z * f.z;
  const xc = d.x * r.x + d.y * r.y + d.z * r.z;
  const yc = d.x * u.x + d.y * u.y + d.z * u.z;
  const t = Math.tan((cam.fov * GRAUS) / 2);
  return { x: xc / (zc * t * cam.aspect), y: yc / (zc * t), z: zc };
}

if (process.argv[1] && process.argv[1].endsWith('camera.mjs')) {
  const aspect = 390 / 844;
  console.log('fov vertical celular', fovVertical(aspect).toFixed(1), 'computador', fovVertical(16 / 9).toFixed(1));
  for (const [d, a] of [[22, 0], [22, 12], [22, -12], [18, 0], [30, 0], [33, 0], [20, 30], [20, -30], [28, 25], [28, -25]]) {
    const bola = { x: d * Math.sin(a * GRAUS), z: d * Math.cos(a * GRAUS) };
    for (const num of [8, 5, 10, 7]) {
      const jog = ELENCO.find((j) => j.numero === num) || ELENCO[0];
      const ini = inicioDoCobrador(bola, jog);
      const cam = cameraDeTras(bola, ini, aspect);
      // faixa lateral visível (em relação ao eixo bola → gol) a várias distâncias da bola, no chão
      const { ax, az, lx, lz } = cam.eixo;
      const linhas = [];
      for (const frente of [0, 5, 9.15, 14, Math.hypot(bola.x, bola.z) - 3, Math.hypot(bola.x, bola.z)]) {
        let min = null;
        let max = null;
        for (let lat = -20; lat <= 20; lat += 0.1) {
          const p = { x: bola.x - ax * frente + lx * lat, y: 0.9, z: bola.z - az * frente + lz * lat };
          const s = projetar(cam, p);
          if (s.z > 0 && Math.abs(s.x) < 0.94) {
            if (min === null) min = lat;
            max = lat;
          }
        }
        linhas.push(`${frente.toFixed(1)}m:[${min === null ? '-' : min.toFixed(1)},${max === null ? '-' : max.toFixed(1)}]`);
      }
      console.log(`falta ${d}m ${a}° · ${jog.nomeCamisa || jog.apelido}(${jog.pe}) atras=${cam.atras.toFixed(1)} yaw=${(cam.yaw / GRAUS).toFixed(1)}° incl=${(cam.inclinacao / GRAUS).toFixed(1)}° | ${linhas.join(' ')}`);
    }
  }
}

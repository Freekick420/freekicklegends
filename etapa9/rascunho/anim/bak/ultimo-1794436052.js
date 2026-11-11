// Cobrança de falta: o cobrador esperando atrás da bola (uma postura por lenda), a corrida, o chute, a
// terminação e as reações depois do lance (acompanhar a bola, comemorar, lamentar).
// Usa o boneco de js/jogadores.js (personagem.aplicarPose e personagem.juntas). Aqui não se cria malha
// nenhuma: só movimento.
//
// Como o movimento é feito (resumo; os detalhes estão em cada parte):
//   - A corrida é PLANEJADA: do lugar da espera até o pé de apoio ao lado da bola há uma lista de pisadas
//     (esquerda, direita...), com o número de passos e o ritmo da lenda, passadas que crescem e o instante de
//     cada uma. O quadril segue uma curva suave por cima das pisadas; cada pé fica PRESO no gramado enquanto
//     pisa (a perna é resolvida por cinemática inversa: quadril → tornozelo) e balança por cima no passo.
//   - O chute é montado de trás para a frente: primeiro o instante do contato (o pé encosta no ponto da bola
//     que o jogador escolheu, com a parte do pé da batida; o pé de apoio ao lado da bola; o quadril atrás
//     dele), depois a armada (perna para trás, bacia girada, braço aberto), a descida em chicote (coxa
//     primeiro, canela depois) e a terminação de cada batida (chapa, peito do pé, pancada, sem giro, trivela,
//     cavadinha, rasteiro, folha seca).
//   - Tudo é calculado para um DESTRO; o canhoto é o espelho exato (o mundo é espelhado na entrada e na saída).
//   - Nada de Math.random: a mesma cobrança dá sempre a mesma animação (o replay repete).
//
// Eixos do jogo: x = direita de quem cobra, y = para cima, z = do gol para quem cobra (chute para −z).
// Eixos do boneco: pés em y = 0, de frente para +z local; a direita do jogador fica em −x local.

import * as THREE from 'three';
import { misturarPoses, espelhar, porChaves, posePadrao, PEITO_DO_PE, SOLA } from './jogadores.js?v=9';

const GRAUS = Math.PI / 180;
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
const suave = (t) => {
  const u = limitar(t, 0, 1);
  return u * u * (3 - 2 * u);
};
const misturar = (a, b, k) => a + (b - a) * k;
// 0 antes de a, 1 depois de b, suave no meio
const rampa = (t, a, b) => (b > a ? suave((t - a) / (b - a)) : t >= b ? 1 : 0);
const sino = (u) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u));
// O ângulo a, escrito perto de ref (sem o pulo de 2π): as curvas de giro não podem dar a volta pelo outro lado
const perto = (a, ref) => ref + Math.atan2(Math.sin(a - ref), Math.cos(a - ref));

// ---------- Poses avulsas (página de inspeção testes/jogadores.html e reserva do main.js) ----------

// Jeitos de esperar atrás da bola (js/elenco.js, cobranca.postura): ajustes por cima da pose normal
const POSTURAS = {
  normal: {},
  calmo: { tronco: { frente: 0.04 }, bracoE: { lado: 0.12, cotovelo: 0.2 }, bracoD: { lado: 0.12, cotovelo: 0.2 }, agachar: 0.03 },
  concentrado: { tronco: { frente: 0.16 }, cabeca: { frente: 0.05 }, agachar: 0.08 },
  ereto: { tronco: { frente: -0.02 }, cabeca: { frente: -0.16 }, pernaE: { frente: 0.04 }, pernaD: { frente: -0.06 }, agachar: 0.01 },
  curvado: { tronco: { frente: 0.32 }, cabeca: { frente: 0.1 }, bracoE: { frente: 0.25, cotovelo: 0.6 }, bracoD: { frente: 0.2, cotovelo: 0.55 }, agachar: 0.1 },
  agachado: {
    tronco: { frente: 0.28 }, cabeca: { frente: 0 }, pernaE: { frente: 0.3, joelho: 0.6 }, pernaD: { frente: -0.1, joelho: 0.55 },
    bracoE: { frente: 0.3, lado: 0.3, cotovelo: 0.9 }, bracoD: { frente: 0.3, lado: 0.3, cotovelo: 0.9 }, agachar: 0.22,
  },
  // Pernas bem abertas, peito estufado (o agachar extra compensa as pernas abertas, para os pés ficarem no chão)
  pernasAbertas: {
    tronco: { frente: -0.02 }, cabeca: { frente: -0.1 }, pernaE: { frente: 0, lado: 0.4, joelho: 0.06 }, pernaD: { frente: 0, lado: 0.4, joelho: 0.06 },
    bracoE: { frente: 0.02, lado: 0.3, cotovelo: 0.25 }, bracoD: { frente: 0.02, lado: 0.3, cotovelo: 0.25 }, agachar: 0.3,
  },
  bracosAbertos: { tronco: { frente: 0.08 }, bracoE: { frente: -0.1, lado: 0.55, cotovelo: 0.3 }, bracoD: { frente: -0.1, lado: 0.55, cotovelo: 0.3 } },
  // De lado para o gol: o corpo e a cabeça giram para olhar o gol por cima do ombro
  lateral: { tronco: { frente: 0.06, giro: 0.3 }, cabeca: { giro: 0.4 }, bracoE: { lado: 0.15, cotovelo: 0.3 }, bracoD: { lado: 0.15, cotovelo: 0.3 }, pernaE: { frente: 0.05 }, pernaD: { frente: -0.05 }, agachar: 0.03 },
};

// Cobrador parado atrás da bola, concentrado, esperando para correr. pe: 'D' ou 'E' (perna do chute);
// postura: um dos nomes de POSTURAS (o jeito de cada lenda). É a pose de onde a espera animada parte.
export function poseCobradorPronto(t = 0, pe = 'D', postura = 'normal') {
  const respira = Math.sin(t * 1.9);
  const p = {
    tronco: { frente: 0.1 + 0.012 * respira, lado: 0.02, giro: 0 },
    cabeca: { frente: -0.06, giro: 0.05 * Math.sin(t * 0.4) },
    bracoE: { frente: 0.1, lado: 0.2, cotovelo: 0.35 },
    bracoD: { frente: 0.0, lado: 0.2, cotovelo: 0.3 },
    pernaE: { frente: 0.12, lado: 0.07, joelho: 0.1 },
    pernaD: { frente: -0.18, lado: 0.06, joelho: 0.12, tornozelo: 0.15 },
    agachar: 0.06 + 0.01 * respira,
  };
  const extra = POSTURAS[postura] || POSTURAS.normal;
  for (const [parte, valor] of Object.entries(extra)) {
    if (typeof valor === 'number') p[parte] = valor + (parte === 'agachar' ? 0.01 * respira : 0);
    else p[parte] = { ...p[parte], ...valor };
  }
  return pe === 'E' ? espelhar(p) : p;
}

// Corrida parada no tempo (para a página de inspeção). fase de 0 a 1 = um ciclo (dois passos). Em fase 0,25 a
// perna direita está toda à frente; em 0,75, toda atrás. No jogo a corrida é a planejada, em criarCobranca.
export function poseCorrida(fase = 0) {
  const a = 2 * Math.PI * fase;
  const perna = (f) => ({
    frente: 0.62 * Math.sin(f) + 0.08,
    lado: 0.035,
    joelho: 0.25 + 1.25 * Math.max(0, Math.cos(f + 0.35)) ** 1.5,
    tornozelo: 0.4 * Math.max(0, -Math.sin(f)),
  });
  return {
    tronco: { frente: 0.2, lado: 0, giro: -0.2 * Math.sin(a) },
    cabeca: { frente: -0.1, giro: 0.08 * Math.sin(a) },
    bracoE: { frente: 0.6 * Math.sin(a) + 0.05, lado: 0.16, cotovelo: 1.4 + 0.25 * Math.sin(a) },
    bracoD: { frente: -0.6 * Math.sin(a) + 0.05, lado: 0.16, cotovelo: 1.4 - 0.25 * Math.sin(a) },
    pernaD: perna(a),
    pernaE: perna(a + Math.PI),
    quadril: { giro: 0.1 * Math.sin(a) },
    pulo: 0.04 * Math.max(0, Math.sin(2 * a - 0.5)),
  };
}

// Chute parado no tempo (de destro; o de canhoto é o espelho), para a página de inspeção e como reserva.
// progresso de 0 a 1: 0,3 = o pé de apoio pisa (TEMPO_APOIO); 0,55 = contato (TEMPO_CONTATO); 1 = fim.
// A animação do jogo (criarCobranca) devolve o mesmo "progresso" em atualizar().
export const TEMPO_CONTATO = 0.55;
export const TEMPO_APOIO = 0.3; // o pé de apoio pisa no chão
const CHAVES_CHUTE = [
  [0, poseCorrida(0.75)],
  [TEMPO_APOIO, {
    tronco: { frente: 0.06, lado: -0.1, giro: 0.4 },
    cabeca: { frente: 0.3, giro: -0.2 },
    bracoE: { frente: -0.45, lado: 1.0, cotovelo: 0.4 },
    bracoD: { frente: 0.4, lado: 0.25, cotovelo: 0.9 },
    pernaE: { frente: 0.4, lado: 0.04, joelho: 0.25, tornozelo: -0.1 },
    pernaD: { frente: -0.5, lado: 0.12, joelho: 1.6, tornozelo: 0.6, giro: 0.15 },
    quadril: { giro: -0.4 },
    agachar: 0.08,
  }],
  [0.45, {
    tronco: { frente: 0.04, lado: -0.16, giro: 0.45 },
    cabeca: { frente: 0.42, giro: -0.2 },
    bracoE: { frente: -0.4, lado: 1.2, cotovelo: 0.35 },
    bracoD: { frente: 0.35, lado: 0.28, cotovelo: 0.9 },
    pernaE: { frente: 0.25, lado: 0.05, joelho: 0.4 },
    pernaD: { frente: -0.2, lado: 0.1, joelho: 1.85, tornozelo: 0.8, giro: 0.2 },
    quadril: { giro: -0.3, lado: -0.06 },
    agachar: 0.06,
  }],
  [TEMPO_CONTATO, {
    tronco: { frente: 0.1, lado: -0.2, giro: 0.16 },
    cabeca: { frente: 0.5 },
    bracoE: { frente: 0.05, lado: 1.15, cotovelo: 0.3 },
    bracoD: { frente: -0.05, lado: 0.3, cotovelo: 0.75 },
    pernaE: { frente: 0.12, lado: 0.05, joelho: 0.45 },
    pernaD: { frente: 0.45, lado: 0.04, joelho: 1.0, tornozelo: 0.95, giro: 0.2 },
    quadril: { giro: -0.06, lado: -0.13 },
    agachar: 0.04,
  }],
  [0.72, {
    tronco: { frente: 0.24, lado: -0.08, giro: -0.3 },
    cabeca: { frente: 0.1 },
    bracoE: { frente: 0.8, lado: 0.5, cotovelo: 0.9 },
    bracoD: { frente: -0.6, lado: 0.5, cotovelo: 0.4 },
    pernaE: { frente: -0.25, lado: 0.04, joelho: 0.3, tornozelo: 0.5 },
    pernaD: { frente: 1.25, lado: -0.05, joelho: 0.3, tornozelo: 0.7 },
    quadril: { giro: 0.26 },
    agachar: 0.02,
  }],
  [1, {
    tronco: { frente: 0.08, lado: -0.02, giro: -0.05 },
    cabeca: { frente: -0.12 },
    bracoE: { frente: 0.1, lado: 0.3, cotovelo: 0.5 },
    bracoD: { frente: 0.05, lado: 0.3, cotovelo: 0.5 },
    pernaE: { frente: -0.3, lado: 0.04, joelho: 0.5, tornozelo: 0.4 },
    pernaD: { frente: 0.32, lado: 0.0, joelho: 0.3 },
    quadril: { giro: 0.1 },
    agachar: 0.05,
  }],
];
// braco: 'aberto' abre o braço de equilíbrio (o contrário da perna do chute) durante o chute
export function poseChute(progresso = 0, pe = 'D', braco = 'normal') {
  let p = porChaves(CHAVES_CHUTE, limitar(progresso, 0, 1));
  if (braco === 'aberto' && progresso > 0.2) {
    const k = limitar((progresso - 0.2) / 0.2, 0, 1);
    const b = p.bracoE;
    p = { ...p, bracoE: { frente: b.frente - 0.15 * k, lado: Math.min(1.5, b.lado + 0.35 * k), cotovelo: b.cotovelo * (1 - 0.6 * k) } };
  }
  return pe === 'E' ? espelhar(p) : p;
}

// Comemoração de gol parada no tempo: pula com os braços para cima. t em segundos desde o gol.
export function poseComemoracao(t = 0) {
  const pulo = Math.abs(Math.sin(t * 4.2));
  const vibra = Math.sin(t * 8.4);
  const entra = suave(t * 3);
  return misturarPoses(posePadrao(t), {
    tronco: { frente: -0.18 - 0.05 * pulo, lado: 0.04 * vibra },
    cabeca: { frente: -0.4 },
    bracoE: { frente: 0.5, lado: 2.55 + 0.1 * vibra, cotovelo: 0.5 + 0.25 * pulo },
    bracoD: { frente: 0.5, lado: 2.55 - 0.1 * vibra, cotovelo: 0.5 + 0.25 * pulo },
    pernaE: { frente: 0.15 * pulo, lado: 0.08, joelho: 0.2 + 0.5 * pulo, tornozelo: 0.4 * pulo },
    pernaD: { frente: 0.05 * pulo, lado: 0.08, joelho: 0.15 + 0.3 * pulo, tornozelo: 0.4 * pulo },
    pulo: 0.22 * pulo,
    agachar: 0.1 * (1 - pulo),
  }, entra);
}

// Lamento parado no tempo (bola fora ou defendida): mãos na cabeça, olhando para baixo
export function poseLamento(t = 0) {
  const entra = suave(t * 3);
  const balanca = Math.sin(t * 2.4);
  return misturarPoses(posePadrao(t), {
    tronco: { frente: 0.1, lado: 0.02 * Math.sin(t * 0.9) },
    cabeca: { frente: 0.18, giro: 0.2 * balanca },
    bracoE: { frente: 1.2, lado: 1.0, cotovelo: 2.2 },
    bracoD: { frente: 1.2, lado: 1.0, cotovelo: 2.2 },
    maoE: { x: 0.07, y: 0.8, z: 0.02 + 0.01 * balanca, peso: 1 },
    maoD: { x: -0.07, y: 0.8, z: 0.02 - 0.01 * balanca, peso: 1 },
    pernaE: { lado: 0.07, frente: 0.04 },
    pernaD: { lado: 0.07, frente: -0.06 },
    agachar: 0.04,
  }, entra);
}

// Onde fica o centro da bola (no espaço do grupo, de frente para +z) na pose avulsa do contato (poseChute)
export function bolaNoContato(personagem, pe = 'D', raioBola = 0.11) {
  personagem.aplicarPose(poseChute(TEMPO_CONTATO, pe));
  const chute = personagem.pontoNoGrupo(personagem.juntas[`tornozelo${pe}`], ...PEITO_DO_PE);
  return new THREE.Vector3(chute.x, raioBola, chute.z + raioBola + 0.02);
}

// ---------- Curvas ----------

// Curva suave que passa por pontos (tempo, valor): Hermite monótona (não passa dos valores das chaves nem
// cria vaivém entre elas, então junta nenhuma estoura o limite por causa da interpolação). Fora do intervalo
// vale o primeiro ou o último valor. m0 e m1: inclinações nas pontas (0 = sai e chega parado; 'livre' = a
// da reta; { m } = exatamente essa, mesmo que a curva passe um pouco do valor).
class Curva {
  constructor(ts, vs, m0 = 0, m1 = 0) {
    const n = ts.length;
    this.ts = ts;
    this.vs = vs;
    this.n = n;
    this.i = 0;
    const ms = new Array(n).fill(0);
    if (n >= 2) {
      const h = [];
      const d = [];
      for (let i = 0; i < n - 1; i++) {
        h.push(Math.max(1e-6, ts[i + 1] - ts[i]));
        d.push((vs[i + 1] - vs[i]) / h[i]);
      }
      for (let i = 1; i < n - 1; i++) {
        if (d[i - 1] * d[i] > 0) {
          const w1 = 2 * h[i] + h[i - 1];
          const w2 = h[i] + 2 * h[i - 1];
          ms[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
        }
      }
      const borda = (m, dd) => {
        if (m === 'livre') return dd;
        if (m && typeof m === 'object') return m.m;
        return dd === 0 || m * dd <= 0 ? 0 : Math.sign(dd) * Math.min(Math.abs(m), 3 * Math.abs(dd));
      };
      ms[0] = borda(m0, d[0]);
      ms[n - 1] = borda(m1, d[n - 2]);
    }
    this.ms = ms;
  }

  trecho(t) {
    const { ts, n } = this;
    let i = this.i;
    if (i > n - 2 || t < ts[i] || t > ts[i + 1]) {
      i = 0;
      while (i < n - 2 && t > ts[i + 1]) i++;
      this.i = i;
    }
    return i;
  }

  em(t) {
    const { ts, vs, ms, n } = this;
    if (n === 0) return 0;
    if (n === 1 || t <= ts[0]) return vs[0];
    if (t >= ts[n - 1]) return vs[n - 1];
    const i = this.trecho(t);
    const h = ts[i + 1] - ts[i];
    const u = (t - ts[i]) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * vs[i] + (u3 - 2 * u2 + u) * h * ms[i] + (-2 * u3 + 3 * u2) * vs[i + 1] + (u3 - u2) * h * ms[i + 1];
  }

  vel(t) {
    const { ts, vs, ms, n } = this;
    if (n < 2 || t <= ts[0] || t >= ts[n - 1]) return 0;
    const i = this.trecho(t);
    const h = ts[i + 1] - ts[i];
    const u = (t - ts[i]) / h;
    const u2 = u * u;
    return ((6 * u2 - 6 * u) * (vs[i] - vs[i + 1])) / h + (3 * u2 - 4 * u + 1) * ms[i] + (3 * u2 - 2 * u) * ms[i + 1];
  }
}

// Uma curva por canal a partir de uma lista de chaves [{ t, canal: valor, ... }] em ordem de tempo
// (uma chave pode não ter todos os canais). inicio: { canal: inclinação } para a primeira chave.
function curvasDasChaves(chaves, inicio = null) {
  const nomes = new Set();
  for (const k of chaves) for (const c of Object.keys(k)) if (c !== 't') nomes.add(c);
  const curvas = {};
  for (const c of nomes) {
    const ts = [];
    const vs = [];
    for (const k of chaves) {
      if (typeof k[c] !== 'number') continue;
      if (ts.length && k.t <= ts[ts.length - 1] + 1e-4) continue;
      ts.push(k.t);
      vs.push(k[c]);
    }
    curvas[c] = new Curva(ts, vs, inicio && c in inicio ? { m: inicio[c] } : 0, 0);
  }
  return curvas;
}

// ---------- O pé ----------

// Pontos da superfície do pé DIREITO (o lado de dentro fica em +x), no espaço do tornozelo, medidos a partir
// de SOLA e PEITO_DO_PE (js/jogadores.js). bate: onde o pé pode pegar na bola; sola: para o pé não entrar no chão.
const PONTOS_PE = (() => {
  const [, hy, hz] = SOLA[0];
  const [, my, mz] = SOLA[1];
  const [, ty, tz] = SOLA[2];
  const [, iy, iz] = PEITO_DO_PE;
  const W = 0.043; // meia largura do pé
  const m = misturar;
  return {
    bate: [
      [0, iy, iz],                                         // peito do pé (cadarço)
      [0, m(iy, ty, 0.5) + 0.016, m(iz, tz, 0.5)],         // perto dos dedos
      [0, ty + 0.014, tz - 0.012],                         // bico, por cima
      [W * 0.62, m(iy, my, 0.12), iz],                     // peito do pé, por dentro
      [W * 0.66, m(iy, ty, 0.5) + 0.004, m(iz, tz, 0.5)],
      [W, m(iy, my, 0.55), iz * 0.7],                      // parte de dentro (chapa)
      [W, m(iy, my, 0.6), m(iz, tz, 0.4)],
      [W * 0.8, ty + 0.012, tz - 0.035],                   // dedão
      [-W * 0.62, m(iy, my, 0.12), iz],                    // peito do pé, por fora
      [-W * 0.66, m(iy, ty, 0.5) + 0.004, m(iz, tz, 0.5)],
      [-W, m(iy, my, 0.55), m(iz, tz, 0.25)],              // parte de fora (trivela)
      [-W * 0.85, ty + 0.012, tz - 0.04],                  // três dedos
    ].map((p) => new THREE.Vector3(...p)),
    sola: [
      [0, hy, hz], [W * 0.7, hy, hz * 0.6], [-W * 0.7, hy, hz * 0.6], [W, my, mz], [-W, my, mz],
      [W * 0.6, ty, tz - 0.02], [-W * 0.6, ty, tz - 0.02], [0, ty, tz],
    ].map((p) => new THREE.Vector3(...p)),
  };
})();

// ---------- Batidas ----------

// O jeito de bater com o corpo. Ângulos em rad, distâncias em m (boneco de 1,80 m), tempos em s.
//   pé no contato: fora = bico virado para fora da direção do chute; bico = bico para baixo;
//     foraLado/bicoAlto = quanto mudam com o lado e a altura do ponto de contato; joelho = joelho para fora
//   pé de apoio: lat = m do centro da bola, para o lado; atras = m atrás do centro da bola
//   corpo no contato: b1 = m que o quadril fica atrás do pé de apoio; desce = m que o quadril abaixa;
//     pontos = as partes do pé que podem pegar na bola (índices de PONTOS_PE.bate), da preferida para a reserva
//   terminação: tPouso = s do contato até o pé do chute pisar; segue = quanto o corpo segue a direção do
//     chute (0 = continua na linha da corrida); salto = sai do chão e cai no pé que chutou; pousoLado = m que
//     o pé do chute pisa para o lado dele; vira = rad que o corpo passa da direção do chute (para o lado do
//     pé de apoio); pivo = rad que o pé de apoio gira no chão; anda = quanto o corpo ainda anda depois
const BATIDAS = {
  peito: {
    fora: 0.42, bico: 0.95, foraLado: -0.3, bicoAlto: 0.55, joelho: 0.22, lat: 0.235, atras: 0.07, b1: 0.1, desce: 0.03, pontos: [0, 1, 3, 4, 8, 7],
    tPouso: 0.36, segue: 0.7, salto: true, pousoLado: 0.1, vira: 0.0, pivo: 0.0, anda: 1,
  },
  pancada: {
    fora: 0.32, bico: 1.02, foraLado: -0.3, bicoAlto: 0.5, joelho: 0.18, lat: 0.24, atras: 0.09, b1: 0.13, desce: 0.035, pontos: [0, 1, 3, 4, 8, 7],
    tPouso: 0.4, segue: 0.8, salto: true, pousoLado: 0.1, vira: 0.0, pivo: 0.0, anda: 1.15,
  },
  semGiro: {
    fora: 0.28, bico: 1.02, foraLado: -0.25, bicoAlto: 0.5, joelho: 0.18, lat: 0.23, atras: 0.06, b1: 0.08, desce: 0.028, pontos: [0, 1, 3, 4, 8, 7],
    tPouso: 0.28, segue: 0.8, salto: true, pousoLado: 0.08, vira: 0.0, pivo: 0.0, anda: 0.6,
  },
  chapa: {
    fora: 0.85, bico: 0.45, foraLado: -0.75, bicoAlto: 0.45, joelho: 0.5, lat: 0.235, atras: 0.06, b1: 0.1, desce: 0.03, pontos: [5, 6, 3, 4, 7],
    tPouso: 0.38, segue: 0.45, salto: false, pousoLado: -0.06, vira: 0.3, pivo: 0.4, anda: 0.85,
  },
  trivela: {
    fora: -0.38, bico: 0.8, foraLado: -0.3, bicoAlto: 0.5, joelho: -0.05, lat: 0.26, atras: 0.08, b1: 0.1, desce: 0.03, pontos: [8, 9, 10, 11],
    tPouso: 0.36, segue: 0.75, salto: false, pousoLado: 0.26, vira: -0.2, pivo: -0.15, anda: 0.85,
  },
  cavadinha: {
    fora: 0.25, bico: 0.3, foraLado: -0.2, bicoAlto: 0.4, joelho: 0.25, lat: 0.22, atras: 0.12, b1: 0.15, desce: 0.04, pontos: [2, 1, 7, 11],
    tPouso: 0.27, segue: 0.7, salto: false, pousoLado: 0.08, vira: 0.0, pivo: 0.0, anda: 0.5,
  },
  rasteiro: {
    fora: 0.38, bico: 1.12, foraLado: -0.3, bicoAlto: 0.3, joelho: 0.22, lat: 0.23, atras: 0.02, b1: 0.03, desce: 0.045, pontos: [0, 1, 3, 4, 8, 7],
    tPouso: 0.3, segue: 0.75, salto: false, pousoLado: 0.1, vira: 0.0, pivo: 0.0, anda: 0.9,
  },
  folhaSeca: {
    fora: 0.35, bico: 0.92, foraLado: -0.3, bicoAlto: 0.5, joelho: 0.22, lat: 0.235, atras: 0.08, b1: 0.11, desce: 0.03, pontos: [0, 1, 3, 4, 8, 7],
    tPouso: 0.32, segue: 0.7, salto: false, pousoLado: 0.1, vira: 0.0, pivo: 0.0, anda: 0.7,
  },
};

// A batida do corpo sai do chute que o jogador escolheu (tecnica, de js/physics.js) combinado com a batida
// de costume da lenda (js/elenco.js: 'chapa' | 'peito' | 'pancada' | 'semGiro' | 'trivela')
function escolherBatida(tecnica, costume) {
  const c = costume in BATIDAS ? costume : 'chapa';
  switch (tecnica) {
    case 'trivela': return 'trivela';
    case 'cavadinha': return 'cavadinha';
    case 'rasteiro': return 'rasteiro';
    case 'semRotacao': return 'semGiro';
    case 'folhaSeca': return 'folhaSeca';
    case 'curva': return 'chapa';
    case 'pancada': return c === 'semGiro' ? 'semGiro' : c === 'chapa' ? 'peito' : 'pancada';
    case 'colocado': return c === 'pancada' || c === 'trivela' ? 'peito' : c;
    default: return c === 'trivela' ? 'peito' : c;
  }
}

// Canais do corpo (ângulos no formato da pose de js/jogadores.js, para um DESTRO):
//   q* = quadril (frente, giro, lado) · t* = tronco · e* = braço esquerdo, o do lado do pé de apoio
//   (frente, lado, cotovelo, giro) · d* = braço direito · c* = cabeça (só nas reações; no resto ela olha a bola)
const CANAIS_CORPO = ['qf', 'qg', 'ql', 'tf', 'tl', 'tg', 'ef', 'el', 'ec', 'eg', 'df', 'dl', 'dc', 'dg'];
// Canais da perna do chute: p* = frente, lado, giro, joelho (como na pose) e o tornozelo em relação à CANELA
// (pt: + = bico esticado para baixo; pp: bico para fora; pz: rolagem). O tornozelo fica travado no chicote.
const CANAIS_PERNA = ['pf', 'pl', 'pg', 'pj', 'pt', 'pp', 'pz'];

// As poses-chave do chute, por batida. pw: intensidade (0,3 = toque, 1 = barra cheia); aberto: braço de
// equilíbrio aberto (Beckham, Roberto Carlos); ik: os ângulos da perna do chute no contato (calculados para o
// pé encostar no ponto certo da bola). Devolve { armada, contato, estende, alto, queda, pouso, fim }.
function valoresDoChute(batida, pw, aberto, ik) {
  const k = ik || { pf: 0.45, pl: 0.05, pg: 0.2, pj: 1.0, pt: 0.4, pp: 0, pz: 0 };
  const ab = aberto ? 1 : 0;
  const v = {
    // Perna armada atrás: quadril estendido, joelho dobrado, bacia girada para trás do lado do chute, tronco
    // contra-girando e inclinado para o lado do apoio (o "arco"), braço do lado do apoio aberto, alto e para trás
    armada: {
      qf: 0.08, qg: -0.38 - 0.16 * pw, ql: -0.02,
      tf: -0.06 - 0.06 * pw, tl: -0.14 - 0.06 * pw, tg: 0.45 + 0.25 * pw,
      ef: -0.35 - 0.35 * pw, el: 1.05 + 0.3 * pw + 0.2 * ab, ec: 0.35 - 0.1 * ab, eg: 0,
      df: 0.45 + 0.1 * pw, dl: 0.2, dc: 1.0, dg: 0,
      pf: -0.4 - 0.22 * pw, pl: 0.16, pg: 0.2, pj: 1.5 + 0.45 * pw, pt: 0.55, pp: 0, pz: 0,
    },
    // Contato: bacia de frente, lado do chute mais alto, tronco inclinado para o lado do apoio e um pouco
    // para trás (ombros atrás do quadril), braço de equilíbrio ainda aberto
    contato: {
      qf: -0.02, qg: -0.04, ql: -0.15,
      tf: -0.04, tl: -0.26 - 0.06 * pw, tg: 0.2,
      ef: 0, el: 1.15 + 0.2 * pw + 0.25 * ab, ec: 0.3 - 0.1 * ab, eg: 0,
      df: -0.2, dl: 0.35, dc: 0.7, dg: 0,
    },
    // Logo depois da bola: o joelho acaba de estender
    estende: {
      qf: -0.02, qg: 0.12, ql: -0.14, tf: 0.02, tl: -0.26, tg: 0,
      ef: 0.3, el: 1.0 + 0.2 * ab, ec: 0.45, eg: 0, df: -0.4, dl: 0.45, dc: 0.55, dg: 0,
      pf: k.pf + 0.42, pl: k.pl * 0.5, pg: k.pg * 0.6, pj: Math.max(0.12, k.pj * 0.2), pt: k.pt, pp: k.pp * 0.7, pz: k.pz * 0.5,
    },
    // O alto da terminação: a perna sobe, o tronco fecha por cima dela, os braços trocam de lado
    alto: {
      qf: 0.02, qg: 0.3, ql: -0.08, tf: 0.26 + 0.1 * pw, tl: -0.12, tg: -0.4,
      ef: 0.9, el: 0.45, ec: 1.0, eg: 0, df: -0.7, dl: 0.6, dc: 0.4, dg: 0,
      pf: 0.95 + 0.55 * pw, pl: -0.05, pg: 0.05, pj: 0.25 + 0.2 * (1 - pw), pt: 0.4, pp: 0, pz: 0,
    },
    // A perna desce para pisar
    queda: {
      qf: 0.02, qg: 0.14, ql: 0, tf: 0.24, tl: -0.02, tg: -0.15,
      ef: 0.35, el: 0.4, ec: 0.8, eg: 0, df: -0.3, dl: 0.45, dc: 0.6, dg: 0,
      pf: 0.5, pl: 0.02, pg: 0, pj: 0.5, pt: 0.1, pp: 0, pz: 0,
    },
    pouso: {
      qf: 0.02, qg: 0.05, ql: 0, tf: 0.26, tl: 0, tg: 0,
      ef: 0.05, el: 0.35, ec: 0.6, eg: 0, df: 0.05, dl: 0.35, dc: 0.6, dg: 0,
    },
    fim: {
      qf: 0, qg: 0, ql: 0, tf: 0.05, tl: 0, tg: 0,
      ef: 0.04, el: 0.15, ec: 0.3, eg: 0, df: 0.04, dl: 0.15, dc: 0.3, dg: 0,
    },
  };
  const mudar = (chave, valores) => Object.assign(v[chave], valores);
  switch (batida) {
    case 'pancada':
      mudar('armada', { qg: -0.42 - 0.18 * pw, tg: 0.4 + 0.22 * pw, tf: -0.05 - 0.07 * pw, pf: -0.42 - 0.26 * pw, pj: 1.55 + 0.45 * pw, ef: -0.4 - 0.35 * pw });
      mudar('contato', { tf: 0.04, tl: -0.24 });
      mudar('alto', { pf: 0.95 + 0.55 * pw, tf: 0.3, tg: -0.38, pj: 0.25 });
      break;
    case 'semGiro':
      // Batida seca: armada curta, tornozelo travado e a perna trava logo depois da bola
      mudar('armada', { qg: -0.3 - 0.12 * pw, pf: -0.3 - 0.16 * pw, pj: 1.4 + 0.35 * pw, tg: 0.28 + 0.16 * pw, ef: -0.2 - 0.25 * pw, el: 0.85 + 0.2 * pw + 0.25 * ab });
      mudar('contato', { tf: 0.06, tl: -0.14, el: 1.0 + 0.15 * pw + 0.3 * ab });
      mudar('estende', { pf: k.pf + 0.2, pj: Math.max(0.3, k.pj * 0.5), qg: 0.04, tg: 0.04, ef: 0.1, el: 0.95, df: -0.15, dl: 0.6 });
      mudar('alto', { pf: k.pf + 0.3, pj: 0.42, pt: k.pt, qg: 0.1, tf: 0.1, tg: -0.06, ef: 0.15, el: 0.9, ec: 0.5, df: -0.2, dl: 0.75, dc: 0.45 });
      mudar('queda', { pf: 0.4, pj: 0.45, tf: 0.1, ef: 0.1, el: 0.6, df: -0.1, dl: 0.55 });
      break;
    case 'chapa':
      // Parte de dentro do pé: a perna inteira gira para fora e, depois da bola, cruza na frente do corpo
      mudar('armada', { qg: -0.42 - 0.14 * pw, pf: -0.34 - 0.2 * pw, pl: 0.26, pg: 0.42, pj: 1.35 + 0.4 * pw, tl: -0.2 - 0.08 * pw, ef: -0.4 - 0.3 * pw, el: 1.15 + 0.3 * pw + 0.25 * ab });
      mudar('contato', { qg: 0, ql: -0.17, tf: -0.02, tl: -0.32 - 0.06 * pw, tg: 0.12, el: 1.25 + 0.2 * pw + 0.2 * ab });
      mudar('estende', { pf: k.pf + 0.36, pl: k.pl - 0.16, pg: k.pg * 0.9, pj: Math.max(0.18, k.pj * 0.28), qg: 0.2, tl: -0.3, tg: -0.1 });
      mudar('alto', { pf: 0.9 + 0.5 * pw, pl: -0.4 - 0.15 * pw, pg: 0.3, pj: 0.4, pt: 0.25, pp: 0.2, qg: 0.5, ql: -0.1, tf: 0.24, tl: -0.3, tg: -0.35, ef: 0.6, el: 0.35, ec: 1.1, df: -0.35, dl: 0.9, dc: 0.3 });
      mudar('queda', { pf: 0.5, pl: -0.22, pg: 0.15, pj: 0.55, qg: 0.34, tl: -0.12, df: -0.1, dl: 0.6 });
      mudar('pouso', { qg: 0.14, tl: -0.04 });
      break;
    case 'trivela':
      // Parte de fora do pé: pé girado para dentro, a perna sai de dentro para fora
      mudar('armada', { pl: 0.06, pg: -0.1, qg: -0.3 - 0.14 * pw });
      mudar('contato', { ql: -0.16, tl: -0.26, tg: 0.2, tf: 0.06 });
      mudar('estende', { pf: k.pf + 0.34, pl: k.pl + 0.14, pg: k.pg - 0.1, pj: Math.max(0.15, k.pj * 0.25), pp: k.pp, tl: -0.28 });
      mudar('alto', { pf: 0.75 + 0.35 * pw, pl: 0.4 + 0.1 * pw, pg: -0.2, pj: 0.3, pp: -0.3, qg: 0.1, tl: -0.3, tg: -0.1, ef: 0.6, el: 0.7, ec: 0.6, df: -0.4, dl: 0.7 });
      mudar('queda', { pf: 0.45, pl: 0.3, pg: -0.05, pj: 0.5, tl: -0.1 });
      break;
    case 'cavadinha':
      // O pé entra por baixo da bola, o corpo vai para trás e a terminação é curta
      mudar('armada', { qg: -0.2, pf: -0.25 - 0.1 * pw, pj: 1.15 + 0.2 * pw, tg: 0.2, tf: 0.02, ef: -0.15, el: 0.6 + 0.25 * ab, df: 0.25 });
      mudar('contato', { tf: -0.08, tl: -0.12, el: 0.75 + 0.3 * ab });
      mudar('estende', { pf: k.pf + 0.2, pj: Math.max(0.35, k.pj * 0.55), tf: -0.1, qg: 0.04, tg: 0.04, ef: 0.15, el: 0.7, df: -0.1, dl: 0.4 });
      mudar('alto', { pf: k.pf + 0.34, pj: 0.5, pt: 0.1, tf: -0.06, qg: 0.08, tg: -0.05, ef: 0.25, el: 0.55, ec: 0.6, df: -0.15, dl: 0.45, dc: 0.5 });
      mudar('queda', { pf: 0.35, pj: 0.45, tf: 0.04, ef: 0.1, el: 0.35, df: 0, dl: 0.35 });
      break;
    case 'rasteiro':
      // Corpo por cima da bola e terminação baixa
      mudar('armada', { tf: 0.1, pf: -0.4 - 0.2 * pw });
      mudar('contato', { tf: 0.3, tl: -0.14, qf: 0.06 });
      mudar('estende', { pf: k.pf + 0.3, pj: Math.max(0.2, k.pj * 0.3), tf: 0.34 });
      mudar('alto', { pf: 0.62 + 0.2 * pw, pj: 0.45, tf: 0.36, tg: -0.25, ef: 0.6, el: 0.45 });
      mudar('queda', { pf: 0.42, pj: 0.5, tf: 0.28 });
      break;
    case 'folhaSeca':
      // Peito do pé de baixo para cima, joelho subindo dobrado, corpo um pouco para trás
      mudar('contato', { tf: 0.02, tl: -0.18 });
      mudar('estende', { pf: k.pf + 0.36, pj: Math.max(0.3, k.pj * 0.45), tf: 0.02 });
      mudar('alto', { pf: 0.9 + 0.3 * pw, pj: 0.75, pt: 0.35, tf: 0.06, tg: -0.2, ef: 0.6, el: 0.55 });
      mudar('queda', { pf: 0.45, pj: 0.55, tf: 0.1 });
      break;
    default:
      break;
  }
  return v;
}

// ---------- Reações (depois do lance) ----------

// Comemorações (canais do corpo + extras). tr: s desde que a reação começou. Preenche R:
//   canais do corpo; cf/cg = cabeça; olha = 0..1 (quanto a cabeça continua olhando a bola);
//   dh = m que o quadril sobe ou desce; pulo = m que os pés saem do chão; mE/mD = alvo das mãos (peso)
function reacaoGol(variacao, tr, R) {
  const entra = suave(tr / 0.3);
  R.olha = 1 - entra;
  if (variacao === 0) {
    // Agacha, pula e soca o ar; depois os dois braços para cima
    const prep = sino(tr / 0.5) * (tr < 0.25 ? 1 : 0.4);
    const salto = tr > 0.22 && tr < 0.8 ? Math.sin(((tr - 0.22) / 0.58) * Math.PI) : 0;
    const depois = rampa(tr, 0.8, 1.2);
    const bate = 0.5 + 0.5 * Math.sin((tr - 1.1) * 7);
    R.dh = -0.11 * prep * (1 - salto) - 0.03 * depois * bate;
    R.pulo = 0.26 * salto;
    R.tf = misturar(0.25 * prep, -0.12, rampa(tr, 0.2, 0.4));
    R.cf = -0.3 * entra;
    R.df = misturar(0.4, 0.35, depois);
    R.dl = misturar(0.3, 2.75, rampa(tr, 0.18, 0.42));
    R.dc = misturar(1.9, 0.25, rampa(tr, 0.2, 0.45)) + 0.25 * depois * bate;
    R.ef = misturar(0.3, 0.35, depois);
    R.el = misturar(0.35, 2.6, depois);
    R.ec = misturar(1.7, 0.35, depois) + 0.25 * depois * bate;
  } else if (variacao === 1) {
    // Braços bem abertos, peito estufado, queixo para cima
    const balanca = Math.sin(tr * 3.1);
    R.dh = -0.02 * entra * (0.5 + 0.5 * Math.sin(tr * 6.2));
    R.tf = -0.16 * entra;
    R.tl = 0.04 * balanca * entra;
    R.cf = -0.32 * entra;
    R.ef = -0.15 * entra;
    R.df = -0.15 * entra;
    R.el = misturar(0.15, 1.5 + 0.06 * balanca, entra);
    R.dl = misturar(0.15, 1.5 - 0.06 * balanca, entra);
    R.ec = misturar(0.3, 0.12, entra);
    R.dc = misturar(0.3, 0.12, entra);
    R.eg = 0.5 * entra;
    R.dg = 0.5 * entra;
  } else if (variacao === 2) {
    // Punhos cerrados na frente do corpo, grita e bate os braços
    const bate = Math.max(0, Math.sin(tr * 9));
    R.dh = -0.07 * entra + 0.02 * bate * entra;
    R.tf = 0.26 * entra - 0.06 * bate * entra;
    R.cf = -0.25 * entra;
    R.ef = misturar(0.05, 0.55 + 0.2 * bate, entra);
    R.df = misturar(0.05, 0.55 + 0.2 * bate, entra);
    R.el = misturar(0.15, 0.45, entra);
    R.dl = misturar(0.15, 0.45, entra);
    R.ec = misturar(0.3, 2.0 - 0.3 * bate, entra);
    R.dc = misturar(0.3, 2.0 - 0.3 * bate, entra);
  } else {
    // Pulinhos com os dois braços para o alto
    const salto = Math.abs(Math.sin(tr * 4.4)) * entra;
    R.pulo = 0.16 * salto;
    R.dh = -0.06 * entra * (1 - salto);
    R.tf = -0.14 * entra;
    R.cf = -0.4 * entra;
    R.ef = 0.4 * entra;
    R.df = 0.4 * entra;
    R.el = misturar(0.15, 2.65, entra);
    R.dl = misturar(0.15, 2.65, entra);
    R.ec = misturar(0.3, 0.35 + 0.3 * salto, entra);
    R.dc = misturar(0.3, 0.35 + 0.3 * salto, entra);
  }
}

// Lamentos. tipo: 'quase' (trave ou defesa: mãos na cabeça) | 'longe' (fora, por cima: mãos na cintura,
// olha para o chão) | 'travou' (barreira, jogador, bola curta: abre os braços e deixa cair)
function reacaoErro(tipo, tr, R) {
  const entra = suave(tr / 0.35);
  const balanca = Math.sin(tr * 2.6);
  if (tipo === 'quase') {
    // Mãos na cabeça: o corpo vai para trás e depois dobra para a frente
    const dobra = rampa(tr, 0.9, 1.6);
    R.olha = 1 - 0.7 * dobra;
    R.tf = misturar(-0.1, 0.22, dobra) * entra;
    R.cf = misturar(-0.2, 0.3, dobra) * entra;
    R.cg = 0.12 * balanca * dobra;
    R.dh = -0.03 * entra;
    R.ef = 1.2 * entra;
    R.df = 1.2 * entra;
    R.el = misturar(0.15, 1.0, entra);
    R.dl = misturar(0.15, 1.0, entra);
    R.ec = misturar(0.3, 2.2, entra);
    R.dc = misturar(0.3, 2.2, entra);
    R.mE = { x: 0.075, y: 0.8, z: 0.03, peso: entra };
    R.mD = { x: -0.075, y: 0.8, z: 0.03, peso: entra };
  } else if (tipo === 'longe') {
    // Mãos na cintura, olha para o chão e balança a cabeça
    R.olha = 1 - entra;
    R.tf = 0.14 * entra;
    R.cf = 0.42 * entra;
    R.cg = 0.22 * balanca * entra;
    R.dh = -0.015 * entra;
    R.ef = -0.12 * entra;
    R.df = -0.12 * entra;
    R.el = misturar(0.15, 0.62, entra);
    R.dl = misturar(0.15, 0.62, entra);
    R.ec = misturar(0.3, 1.75, entra);
    R.dc = misturar(0.3, 1.75, entra);
    R.eg = -0.85 * entra;
    R.dg = -0.85 * entra;
  } else {
    // Abre os braços ("como assim?") e deixa cair
    const abre = sino(tr / 1.1);
    const cai = rampa(tr, 0.9, 1.4);
    R.olha = 1 - 0.8 * cai;
    R.tf = misturar(-0.06 * abre, 0.16, cai) * entra;
    R.cf = misturar(-0.1 * abre, 0.34, cai);
    R.cg = 0.16 * balanca * cai;
    R.ef = 0.25 * abre;
    R.df = 0.25 * abre;
    R.el = 0.15 + 0.85 * abre;
    R.dl = 0.15 + 0.85 * abre;
    R.ec = 0.3 + 0.5 * abre;
    R.dc = 0.3 + 0.5 * abre;
    R.eg = 0.9 * abre;
    R.dg = 0.9 * abre;
  }
}

// ---------- Cobrança: espera, corrida, chute e reação ----------

export const PADRAO_COBRANCA = {
  distancia: 2.0,  // m da posição inicial até o pé de apoio (cada lenda tem a sua: js/elenco.js)
  angulo: 30,      // graus entre a corrida e a direção do chute (destro vem pela esquerda da bola)
  corrida: 0.4,    // (sem uso desde a etapa 9: o tempo da corrida sai do número de passos e da cadência)
  chute: 0.75,     // duração do gesto do chute: 0,75 = natural; mais = mais lento (armada, descida e terminação)
  cadencia: 1.6,   // ciclos de corrida por segundo (cada ciclo = dois passos); a lenda multiplica pelo ritmo dela
  postura: 'normal', // jeito de esperar atrás da bola (POSTURAS)
  braco: 'normal',   // 'aberto': braço de equilíbrio bem aberto no chute
  giroCorpo: 0.45,   // no contato, quanto do ângulo da corrida o corpo ainda guarda (0 = de frente para o gol; 1 = na linha da corrida)
};

const QUEDA_AGACHAR = 0.26; // m que o quadril desce com agachar = 1 (como em js/jogadores.js)
const TAU_MAX = 1.3;        // rad: o máximo que o calcanhar levanta com a ponta do pé no chão
const CHAO_MIN = 0.004;     // m: o pé no ar não passa mais rente à grama do que isso

// Vetores e rotações de trabalho (reaproveitados: nada de lixo a cada quadro)
const _a = new THREE.Vector3();
const _p = new THREE.Vector3();
const _k = new THREE.Vector3();
const _c = new THREE.Vector3();
const _ex = new THREE.Vector3();
const _ey = new THREE.Vector3();
const _ez = new THREE.Vector3();
const _h = new THREE.Vector3();
const _v = new THREE.Vector3();
const _A = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _polo2 = new THREE.Vector3();
const _qf = new THREE.Quaternion();
const EIXO_X = new THREE.Vector3(1, 0, 0);
const EIXO_Y = new THREE.Vector3(0, 1, 0);
const EIXO_Z = new THREE.Vector3(0, 0, 1);

const novosCanais = () => {
  const c = {};
  for (const n of CANAIS_CORPO) c[n] = 0;
  return c;
};

// Monta a animação da cobrança.
//   personagem: o boneco de js/jogadores.js; bola: {x, z}; alvo: {x, z} (padrão: meio do gol); pe: 'D' | 'E';
//   cfg: o CONFIG do jogo (lê cfg.cobrador e cfg.raioBola); estilo: o campo `cobranca` da lenda (js/elenco.js).
// Devolve:
//   inicio: { x, z, rotacaoY }   onde o cobrador espera (não muda depois de criado)
//   tempoContato, duracao        s do começo da corrida até o pé tocar a bola / até o corpo parar
//   direcao                      vetor para onde o chute vai
//   parado(t)                    pose de espera (t: relógio, em s)
//   preparar({ forca, contato, alvo, tecnica })   uma vez, quando a corrida começa: escolhe a batida do corpo
//   atualizar(t, { bola, resultado, tFim })       t = s desde o começo da corrida. Devolve { etapa, progresso, contato }
//   reage: true                  a comemoração e o lamento são feitos aqui (dentro de atualizar)
//   Para testes e inspeção: batida, passos, pisadas(), medir(), pontoDaBola, pontoDoPe.
export function criarCobranca(personagem, { bola, alvo = { x: 0, z: 0 }, pe = 'D', cfg = {}, estilo = null } = {}) {
  const cc = cfg.cobrador || {};
  const est = estilo || {};
  const esp = pe === 'E' ? -1 : 1; // o canhoto é calculado como destro num mundo espelhado em x
  const raio = cfg.raioBola ?? 0.11;
  const g = personagem.grupo;
  const J = personagem.juntas;

  // O jeito da lenda (o que vier em cfg.cobrador tem prioridade: é o que o main.js monta para cada uma)
  const distancia = Math.max(0.5, cc.distancia ?? est.distancia ?? PADRAO_COBRANCA.distancia);
  const angulo = limitar(cc.angulo ?? est.angulo ?? PADRAO_COBRANCA.angulo, 0, 80) * GRAUS;
  const cadencia = Math.max(0.6, cc.cadencia ?? PADRAO_COBRANCA.cadencia * (est.ritmo || 1));
  const postura = cc.postura ?? est.postura ?? 'normal';
  const aberto = (cc.braco ?? est.braco) === 'aberto';
  const giroCorpo = limitar(cc.giroCorpo ?? PADRAO_COBRANCA.giroCorpo, 0, 1);
  const ks = limitar((cc.chute ?? PADRAO_COBRANCA.chute) / 0.75, 0.6, 2); // escala de tempo do gesto do chute
  const costume = est.batida || 'chapa';
  const passos = Math.round(limitar(est.passos ?? Math.round(distancia / 0.65), 1, 12));
  const dtPasso = 1 / (2 * cadencia); // s de um passo no ritmo da lenda

  // ----- Medidas do boneco (lidas das juntas: as proporções podem mudar) -----
  const ESC = J.quadril.parent.scale; // escala do corpo: (√e, e, √e)
  const EX = ESC.x;
  const EY = ESC.y;
  const COXA = -J.joelhoE.position.y;
  const CANELA = -J.tornozeloE.position.y;
  const PERNA = COXA + CANELA;
  const QX = Math.abs(J.pernaE.position.x);
  const QJY = J.pernaE.position.y;
  const H_PE = -SOLA[0][1] + PERNA - QJY; // altura do pivô do quadril com as pernas esticadas (unidades do corpo)
  const ORDEM = J.pernaE.rotation.order;
  const ORDEM_Q = J.quadril.rotation.order;
  const ORDEM_T = J.tronco.rotation.order;
  const POS_TRONCO = J.tronco.position.clone();
  const POS_OLHOS = J.cabeca.position.clone().add(new THREE.Vector3(0, 0.17, 0.06));
  const DMIN = Math.abs(COXA - CANELA) + 0.06;
  const DMAX = PERNA * 0.9985;
  const ESTICA = PERNA * 0.985;
  const DLEAD = 0.27 * EX;  // m que o pé pisa à frente do quadril, no máximo
  const DTRAIL = 0.5 * EX;  // m que o pé fica para trás do quadril antes de sair do chão, no máximo
  // Juntas reais de cada perna virtual: 0 = a do apoio (esquerda do destro), 1 = a do chute
  const ladoReal = esp > 0 ? ['E', 'D'] : ['D', 'E'];
  const jPerna = ladoReal.map((l) => J[`perna${l}`]);
  const jJoelho = ladoReal.map((l) => J[`joelho${l}`]);
  const jTornozelo = ladoReal.map((l) => J[`tornozelo${l}`]);

  // ----- Mundo virtual (espelhado para o canhoto) -----
  const C = { x: esp * bola.x, z: bola.z }; // a bola

  // ---------- Quadro: tudo o que define o corpo num instante ----------

  const novaPerna = () => ({
    modo: 'ik',                 // 'ik' (o pé tem alvo no mundo) | 'fk' (ângulos) | 'mix'
    A: new THREE.Vector3(),     // tornozelo (mundo virtual)
    yaw: 0, tau: 0, rolo: 0,    // o pé: para onde aponta, bico para baixo (+) e rolagem
    plantado: false,
    ancora: null,               // ponto fixo no gramado (ponta ou calcanhar)
    qual: 2,
    peso: 1,                    // no modo 'mix': 0 = ângulos, 1 = alvo
    polo: new THREE.Vector3(0, 0, 1), // para onde o joelho aponta (referencial do corpo)
    q: new THREE.Quaternion(),  // coxa (no referencial do quadril)
    joelho: 0,
    qPe: new THREE.Quaternion(), // tornozelo (local)
    falta: 0,
    seg: null,
  });
  const novoQuadro = () => ({
    t: 0, gx: 0, gz: 0, yaw: 0, H: 0,
    qQ: new THREE.Quaternion(), qQi: new THREE.Quaternion(),
    c: novosCanais(),
    cf: 0, cg: 0, cl: 0,
    pernas: [novaPerna(), novaPerna()],
    pulo: 0,
    fase: 0,
    desce: 0,
  });

  const atualizarQuadril = (F) => {
    _e.set(F.c.qf, F.c.qg, F.c.ql, ORDEM_Q);
    F.qQ.setFromEuler(_e);
    F.qQi.copy(F.qQ).invert();
  };

  // Ponto do mundo (virtual) no referencial do corpo (origem no chão, embaixo do quadril; sem a escala)
  const paraCorpo = (F, x, y, z, destino) => {
    const dx = x - F.gx;
    const dz = z - F.gz;
    const c = Math.cos(F.yaw);
    const s = Math.sin(F.yaw);
    return destino.set((dx * c - dz * s) / EX, y / EY, (dx * s + dz * c) / EX);
  };
  const paraMundo = (F, v, destino) => {
    const c = Math.cos(F.yaw);
    const s = Math.sin(F.yaw);
    const x = v.x * EX;
    const z = v.z * EX;
    return destino.set(F.gx + x * c + z * s, v.y * EY, F.gz - x * s + z * c);
  };
  // Junta do quadril da perna i, no referencial do corpo
  const juntaDoQuadril = (i, F, destino) => {
    destino.set(i === 0 ? QX : -QX, QJY, 0).applyQuaternion(F.qQ);
    destino.y += F.H;
    return destino;
  };
  // Distância da junta do quadril até um tornozelo do mundo (unidades do corpo)
  const distQuadril = (i, F, A) => {
    juntaDoQuadril(i, F, _h);
    paraCorpo(F, A.x, A.y, A.z, _v);
    return _v.distanceTo(_h);
  };

  // Tornozelo de um pé apoiado no gramado. ancora: {x, z} (o ponto da sola que não sai do lugar: a ponta,
  // qual = 2, ou o calcanhar, qual = 0); yaw: para onde o pé aponta; tau: + = calcanhar levantado, − = bico levantado
  const tornozeloApoiado = (ancora, qual, yaw, tau, altura, destino) => {
    const c = Math.cos(tau);
    const s = Math.sin(tau);
    let menor = Infinity;
    for (let i = 0; i < SOLA.length; i++) menor = Math.min(menor, SOLA[i][1] * c - SOLA[i][2] * s);
    const q = SOLA[qual];
    const zq = (q[1] * s + q[2] * c) * EX; // quanto o ponto de apoio fica à frente do tornozelo
    return destino.set(ancora.x - Math.sin(yaw) * zq, -menor * EY + altura, ancora.z - Math.cos(yaw) * zq);
  };

  // Cinemática inversa da perna i: coxa e joelho para o tornozelo chegar em A (mundo), com o joelho apontando
  // para o polo, e o pé com a orientação pedida. Devolve quanto falta (unidades do corpo) se não alcança.
  const ik = (i, F, A, yawPe, tau, rolo, polo, L) => {
    paraCorpo(F, A.x, A.y, A.z, _a);
    _a.y -= F.H;
    _a.applyQuaternion(F.qQi);
    _a.x -= i === 0 ? QX : -QX;
    _a.y -= QJY;
    const dist = _a.length() || 1e-6;
    const d = limitar(dist, DMIN, DMAX);
    _a.multiplyScalar(1 / dist);
    _p.copy(polo).applyQuaternion(F.qQi);
    _p.addScaledVector(_a, -_p.dot(_a));
    if (_p.lengthSq() < 1e-6) _p.set(0, 0, 1).addScaledVector(_a, -_a.z);
    _p.normalize();
    const cosA = limitar((COXA * COXA + d * d - CANELA * CANELA) / (2 * COXA * d), -1, 1);
    _k.copy(_a).multiplyScalar(cosA).addScaledVector(_p, Math.sqrt(1 - cosA * cosA)); // do quadril ao joelho
    _c.copy(_a).multiplyScalar(d).addScaledVector(_k, -COXA).normalize();              // do joelho ao tornozelo
    // Base da coxa: −y local vai do quadril ao joelho; +z local é a frente do joelho
    _ez.copy(_c).addScaledVector(_k, -_c.dot(_k)).negate();
    if (_ez.lengthSq() < 1e-8) _ez.copy(_p);
    _ez.normalize();
    _ey.copy(_k).negate();
    _ex.crossVectors(_ey, _ez);
    _m.makeBasis(_ex, _ey, _ez);
    L.q.setFromRotationMatrix(_m);
    L.joelho = Math.acos(limitar((d * d - COXA * COXA - CANELA * CANELA) / (2 * COXA * CANELA), -1, 1));
    orientarPe(F, L, yawPe, tau, rolo);
    return dist - DMAX;
  };
  // Rotação do tornozelo para o pé ficar virado para yawPe (mundo), com o bico para baixo tau e a rolagem rolo
  const orientarPe = (F, L, yawPe, tau, rolo) => {
    _q.setFromAxisAngle(EIXO_Y, yawPe - F.yaw);
    _q2.setFromAxisAngle(EIXO_X, tau);
    _q.multiply(_q2);
    if (rolo) _q.multiply(_q2.setFromAxisAngle(EIXO_Z, rolo));
    _q2.setFromAxisAngle(EIXO_X, L.joelho);
    L.qPe.copy(F.qQ).multiply(L.q).multiply(_q2).invert().multiply(_q);
  };
  // Perna do chute pelos ângulos (formato da pose): k = { pf, pl, pg, pj, pt, pp, pz }
  const fkChute = (F, k, L) => {
    _e.set(-k.pf, -k.pg, -k.pl, ORDEM);
    L.q.setFromEuler(_e);
    L.joelho = Math.max(0.02, k.pj);
    _e.set(k.pt, -k.pp, k.pz, ORDEM);
    L.qPe.setFromEuler(_e);
  };
  // Os ângulos (formato da pose) de uma perna do chute resolvida
  const paraCanais = (F, L, k) => {
    _e.setFromQuaternion(L.q, ORDEM);
    k.pf = -_e.x;
    k.pg = -_e.y;
    k.pl = -_e.z;
    k.pj = L.joelho;
    _e.setFromQuaternion(L.qPe, ORDEM);
    k.pt = _e.x;
    k.pp = -_e.y;
    k.pz = _e.z;
    return k;
  };
  // Tornozelo (mundo) e pé (yaw e tau) de uma perna i já resolvida (L.q, L.joelho, L.qPe)
  const peDaPerna = (i, F, L, saida) => {
    _q.copy(F.qQ).multiply(L.q);
    _v.set(0, -COXA, 0).applyQuaternion(_q);
    juntaDoQuadril(i, F, _h).add(_v);
    _q.multiply(_q2.setFromAxisAngle(EIXO_X, L.joelho));
    _v.set(0, -CANELA, 0).applyQuaternion(_q);
    _h.add(_v);
    paraMundo(F, _h, saida.A);
    _q.multiply(L.qPe);
    _v.set(0, 0, 1).applyQuaternion(_q); // para onde o bico aponta (referencial do corpo)
    saida.yaw = F.yaw + Math.atan2(_v.x, _v.z);
    saida.tau = Math.asin(limitar(-_v.y, -1, 1));
    return saida;
  };

  // ---------- A postura da espera vira lugares fixos para os pés ----------

  // Pose de espera (destro) → altura do quadril, onde cada pé pisa (em relação ao quadril) e para onde o
  // joelho aponta. Os pés não saem mais desses lugares enquanto o jogador mira.
  const P0 = poseCobradorPronto(0, 'D', postura);
  const repouso = (() => {
    const F = novoQuadro();
    const qu = P0.quadril || {};
    F.c.qf = qu.frente || 0;
    F.c.qg = qu.giro || 0;
    F.c.ql = qu.lado || 0;
    atualizarQuadril(F);
    const queda = limitar(P0.agachar || 0, 0, 1.2) * QUEDA_AGACHAR;
    const D = PERNA - queda;
    const extraJ = Math.acos(limitar((D * D - COXA * COXA - CANELA * CANELA) / (2 * COXA * CANELA), -1, 1));
    const extraQ = Math.acos(limitar((COXA * COXA + D * D - CANELA * CANELA) / (2 * COXA * D), -1, 1));
    const pes = [];
    let menor = Infinity;
    for (let i = 0; i < 2; i++) {
      const pp = (i === 0 ? P0.pernaE : P0.pernaD) || {};
      const s = i === 0 ? 1 : -1;
      const frente = (pp.frente || 0) + extraQ;
      const joelho = (pp.joelho || 0) + extraJ;
      _e.set(-frente, s * (pp.giro || 0), s * (pp.lado || 0), ORDEM);
      const qCoxa = new THREE.Quaternion().setFromEuler(_e);
      _e.set(frente - joelho - F.c.qf + (pp.tornozelo || 0), s * (pp.pe || 0), 0, ORDEM);
      const qPe = new THREE.Quaternion().setFromEuler(_e);
      const quadril = new THREE.Vector3(s * QX, QJY, 0).applyQuaternion(F.qQ);
      const qc = F.qQ.clone().multiply(qCoxa);
      const joelhoPos = new THREE.Vector3(0, -COXA, 0).applyQuaternion(qc).add(quadril);
      const qj = qc.clone().multiply(new THREE.Quaternion().setFromAxisAngle(EIXO_X, joelho));
      const tornozelo = new THREE.Vector3(0, -CANELA, 0).applyQuaternion(qj).add(joelhoPos);
      const qp = qj.clone().multiply(qPe);
      for (const p of SOLA) menor = Math.min(menor, tornozelo.y + new THREE.Vector3(...p).applyQuaternion(qp).y);
      const bico = new THREE.Vector3(0, 0, 1).applyQuaternion(qp);
      // Polo: para onde o joelho sai da linha quadril → tornozelo
      const linha = tornozelo.clone().sub(quadril).normalize();
      const polo = joelhoPos.clone().sub(quadril);
      polo.addScaledVector(linha, -polo.dot(linha));
      if (polo.length() < 0.012) polo.set(Math.sin(Math.atan2(bico.x, bico.z)), 0, Math.cos(Math.atan2(bico.x, bico.z)));
      polo.normalize();
      pes.push({ x: tornozelo.x, z: tornozelo.z, yaw: Math.atan2(bico.x, bico.z), tau: Math.max(0, Math.asin(limitar(-bico.y, -1, 1))), polo });
    }
    const tr = P0.tronco || {};
    const canais = novosCanais();
    Object.assign(canais, {
      qf: F.c.qf, qg: F.c.qg, ql: F.c.ql, tf: tr.frente || 0, tl: tr.lado || 0, tg: tr.giro || 0,
      ef: P0.bracoE.frente || 0, el: P0.bracoE.lado ?? 0.1, ec: P0.bracoE.cotovelo || 0, eg: P0.bracoE.giro || 0,
      df: P0.bracoD.frente || 0, dl: P0.bracoD.lado ?? 0.1, dc: P0.bracoD.cotovelo || 0, dg: P0.bracoD.giro || 0,
    });
    const ca = P0.cabeca || {};
    return { H: -menor, pes, canais, cabeca: { frente: ca.frente || 0, giro: ca.giro || 0 } };
  })();

  // ---------- Pisadas ----------

  // Um lugar onde um pé pisa: x, z = o tornozelo (no chão), yaw = para onde o pé aponta
  const novaPisada = (i, x, z, yaw) => ({
    pe: i, x, z, yaw,
    ponta: { x: x + Math.sin(yaw) * SOLA[2][2] * EX, z: z + Math.cos(yaw) * SOLA[2][2] * EX },
    calc: { x: x + Math.sin(yaw) * SOLA[0][2] * EX, z: z + Math.cos(yaw) * SOLA[0][2] * EX },
    tBate: -Infinity, tSai: Infinity,
    modo: 'passada', dlead: 0, dtrail: DTRAIL, p0: 0, tauBate: 0, tauSai: 0.85, tau0: 0, rap: 0,
    ctau: null, cyaw: null,
  });

  // ---------- O pé na bola ----------

  // Como o pé do chute encosta na bola: orientação da batida e o ponto do pé que toca (o que fica mais para
  // o lado do centro da bola: assim o resto do pé fica do lado de fora dela). Pc: o ponto de contato na
  // superfície da bola (mundo). Devolve { yaw, tau, rolo, ponto (no tornozelo), A (tornozelo, mundo) }.
  function peNoContato(B, cx, cy, prof, psiK, Pc) {
    const teta = Math.atan2(cx, Math.max(0.2, prof)); // o lado do ponto de contato, visto de trás da bola
    const fora = limitar(B.fora + B.foraLado * teta, -0.7, 1.35);
    let tau = limitar(B.bico + B.bicoAlto * cy, -0.15, 1.2);
    const yaw = psiK - fora;
    const rolo = 0;
    const qYaw = new THREE.Quaternion().setFromAxisAngle(EIXO_Y, yaw);
    const qLocal = new THREE.Quaternion();
    const dW = new THREE.Vector3(C.x - Pc.x, raio - Pc.y, C.z - Pc.z).normalize(); // do ponto para o centro da bola
    const d = new THREE.Vector3();
    const v = new THREE.Vector3();
    const A = new THREE.Vector3();
    const melhorA = new THREE.Vector3();
    let ponto = null;
    const FOLGA = 0.006;
    const pontos = B.pontos.map((i) => PONTOS_PE.bate[i]);
    // Tornozelo e ponto mais baixo da sola com o ponto p do pé encostado em Pc
    const colocar = (p) => {
      v.copy(p).applyQuaternion(qLocal);
      v.set(v.x * EX, v.y * EY, v.z * EX).applyQuaternion(qYaw);
      A.copy(Pc).sub(v);
      let menor = Infinity;
      for (const q of PONTOS_PE.sola) menor = Math.min(menor, A.y + v.copy(q).applyQuaternion(qLocal).y * EY);
      return menor;
    };
    for (let n = 0; n < 40 && !ponto; n++) {
      qLocal.setFromAxisAngle(EIXO_X, tau);
      // Direção do centro da bola vista do pé → o ponto do pé mais avançado nessa direção, entre os que
      // deixam o pé inteiro acima da grama
      d.copy(dW).applyQuaternion(_q.copy(qYaw).invert()).applyQuaternion(_q.copy(qLocal).invert());
      let melhor = -Infinity;
      for (const p of pontos) {
        const s = p.dot(d);
        if (s > melhor && colocar(p) >= FOLGA) {
          melhor = s;
          ponto = p;
          melhorA.copy(A);
        }
      }
      if (!ponto) {
        if (tau <= -0.15) break;
        tau = Math.max(-0.15, tau - 0.05); // bico menos para baixo e tenta de novo
      }
    }
    if (!ponto) {
      // Ponto de contato rente ao chão: o pé chega o mais baixo que dá (fica a poucos centímetros do ponto)
      ponto = pontos[pontos.length - 1];
      const menor = colocar(ponto);
      melhorA.copy(A);
      melhorA.y += FOLGA - menor;
    }
    return { yaw, tau, rolo, ponto, A: melhorA };
  }

  // ---------- Plano da cobrança ----------

  let S0 = null;   // onde o quadril espera (mundo virtual); fixo depois da primeira vez
  let psi0 = 0;    // para onde o corpo fica virado na espera
  let psiRef = null; // a direção do chute nominal (os outros ângulos são escritos perto dela)

  function planejar(chute) {
    const p = { chute };
    const forca = limitar(chute.forca ?? 0.7, 0, 1);
    const pw = 0.3 + 0.7 * forca;
    const alvoV = { x: esp * chute.alvo.x, z: chute.alvo.z };
    let psiK = Math.atan2(alvoV.x - C.x, alvoV.z - C.z);
    if (psiRef === null) psiRef = psiK;
    psiK = perto(psiK, psiRef);
    const fx = Math.sin(psiK);
    const fz = Math.cos(psiK);
    const batida = escolherBatida(chute.tecnica, costume);
    const B = BATIDAS[batida];
    Object.assign(p, { forca, pw, psiK, batida, B, fx, fz });

    // --- O ponto da bola onde o pé pega: atrás dela, deslocado conforme o contato escolhido ---
    let cx = esp * (chute.contato ? chute.contato.x : 0);
    let cy = chute.contato ? chute.contato.y : 0;
    const rc = Math.hypot(cx, cy);
    if (rc > 1) {
      cx /= rc;
      cy /= rc;
    }
    const prof = Math.sqrt(Math.max(0, 1 - cx * cx - cy * cy));
    const rx = -fz; // direita de quem chuta
    const rz = fx;
    const Pc = new THREE.Vector3(C.x + raio * (cx * rx - prof * fx), raio * (1 + cy), C.z + raio * (cx * rz - prof * fz));
    const pePose = peNoContato(B, cx, cy, prof, psiK, Pc);
    p.Pc = Pc;
    p.pePose = pePose;

    // --- O corpo no contato: pé de apoio ao lado da bola, quadril atrás dele ---
    const yawN = psiK - Math.min(0.3 * angulo, 0.35);
    const PN = novaPisada(0, C.x - rx * B.lat - fx * B.atras, C.z - rz * B.lat - fz * B.atras, yawN);
    const psiC = psiK - Math.min(angulo * giroCorpo, 0.62);
    const fcx = Math.sin(psiC);
    const fcz = Math.cos(psiC);
    const vals = valoresDoChute(batida, pw, aberto, null);
    const Fc = novoQuadro();
    Object.assign(Fc.c, vals.contato);
    Fc.yaw = psiC;
    Fc.H = H_PE - B.desce;
    Fc.gx = PN.x - fcx * B.b1 * EX - fcz * (QX + 0.03) * EX;
    Fc.gz = PN.z - fcz * B.b1 * EX + fcx * (QX + 0.03) * EX;
    atualizarQuadril(Fc);
    // A perna do chute precisa alcançar o tornozelo com o joelho dobrado na medida: o quadril chega um pouco
    // mais perto ou mais longe do pé do chute (sem sair de perto do pé de apoio) e sobe ou desce um pouco
    {
      const g0 = { x: Fc.gx, z: Fc.gz };
      for (let n = 0; n < 10; n++) {
        const d = distQuadril(1, Fc, pePose.A);
        const alvoD = d > 0.955 * PERNA ? 0.94 * PERNA : d < 0.66 * PERNA ? 0.69 * PERNA : 0;
        if (!alvoD) break;
        paraMundo(Fc, juntaDoQuadril(1, Fc, _h), _v);
        const hx = pePose.A.x - _v.x;
        const hz = pePose.A.z - _v.z;
        const hh = Math.hypot(hx, hz);
        const longe = Math.hypot(Fc.gx - g0.x, Fc.gz - g0.z);
        if (hh < 0.03 || longe > 0.09) {
          Fc.H = limitar(Fc.H + (alvoD - d) * 0.9, H_PE - 0.09, H_PE - 0.012);
        } else {
          // A distância muda mais ou menos (hh/d) por metro andado na horizontal
          const passo = limitar(((d - alvoD) * d * EX) / hh, -0.05, 0.05);
          Fc.gx += (hx / hh) * passo;
          Fc.gz += (hz / hh) * passo;
        }
      }
      // E a perna de apoio também (pé inteiro no chão, joelho dobrado pelo menos um pouco)
      _A.set(PN.x, -SOLA[0][1] * EY, PN.z);
      for (let n = 0; n < 12 && distQuadril(0, Fc, _A) > 0.975 * PERNA; n++) Fc.H -= 0.006;
    }
    const Lc = novaPerna();
    const poloC = new THREE.Vector3(Math.sin(psiK - B.joelho - psiC), -0.3, Math.cos(psiK - B.joelho - psiC));
    ik(1, Fc, pePose.A, pePose.yaw, pePose.tau, pePose.rolo, poloC, Lc);
    const ikc = paraCanais(Fc, Lc, {});
    p.ikc = ikc;

    // --- A corrida: do lugar da espera até o pé de apoio ---
    const N = passos;
    const fr = (i) => (N <= 1 ? 1 : (i / N) ** 1.65); // passadas que crescem: arranca curto, chega comprido
    // Tempo do pé de apoio pisar até o contato, e quanto o quadril anda nesse tempo (iterado: um depende do outro)
    let a = { x: Math.sin(psiK - angulo), z: Math.cos(psiK - angulo) };
    if (S0) {
      const d = Math.hypot(Fc.gx - S0.x, Fc.gz - S0.z) || 1;
      a = { x: (Fc.gx - S0.x) / d, z: (Fc.gz - S0.z) / d };
    }
    let delta = 0.14 * ks;
    let dAnda = 0.25;
    let E = null;
    let sN = 0;
    let vN = 0;
    let dN = 0;
    let Lrun = distancia;
    for (let n = 0; n < 4; n++) {
      const b1a = (PN.x - Fc.gx) * a.x + (PN.z - Fc.gz) * a.z; // m que o quadril fica atrás do pé de apoio no contato
      sN = Lrun * (1 - fr(N - 1));
      vN = sN / (dtPasso * 1.05);
      const dMax = 0.385 * EX;
      dAnda = limitar(0.7 * vN * delta, 0.06, Math.max(0.07, dMax - b1a));
      dN = b1a + dAnda;
      if (N > 1 && sN - dN < 0.1) dN = Math.max(0.12, sN - 0.1);
      dAnda = Math.max(0.04, dN - b1a);
      const dtrailK = Math.min(DTRAIL, 0.62 * sN);
      const voo = N > 1 ? (sN - dtrailK - dN) / Math.max(0.5, vN) : -0.05;
      delta = Math.max(0.13 * ks, 0.235 * ks - Math.max(-0.06, voo));
      E = { x: Fc.gx - a.x * dAnda, z: Fc.gz - a.z * dAnda };
      if (S0) {
        const d = Math.hypot(E.x - S0.x, E.z - S0.z) || 1;
        a = { x: (E.x - S0.x) / d, z: (E.z - S0.z) / d };
        Lrun = (PN.x - S0.x) * a.x + (PN.z - S0.z) * a.z;
      }
    }
    if (!S0) {
      // Primeira vez (chute nominal, no meio do gol): o lugar da espera fica a `distancia` do pé de apoio
      S0 = { x: E.x - a.x * (distancia - dN), z: E.z - a.z * (distancia - dN) };
      psi0 = perto(Math.atan2(a.x, a.z), psiK - angulo);
      Lrun = distancia;
    }
    const psiA = perto(Math.atan2(a.x, a.z), psi0);
    const lax = Math.cos(psiA); // esquerda de quem corre
    const laz = -Math.sin(psiA);
    Object.assign(p, { a, psiA, psiC, PN, N, E, delta });
    p.ax = a.x;
    p.az = a.z;

    // Pés da espera (no mundo): o corpo fica em S0, virado para psi0
    const c0 = Math.cos(psi0);
    const s0 = Math.sin(psi0);
    const pesEspera = repouso.pes.map((pr, i) => {
      const pis = novaPisada(i, S0.x + EX * (pr.x * c0 + pr.z * s0), S0.z + EX * (-pr.x * s0 + pr.z * c0), psi0 + pr.yaw);
      pis.tau0 = pr.tau;
      pis.polo = pr.polo;
      pis.sigma = (pis.x - S0.x) * a.x + (pis.z - S0.z) * a.z;
      return pis;
    });
    p.espera = pesEspera;

    // Pisadas 1..N (a N é a do pé de apoio; as outras alternam para trás a partir dela)
    const largura = 0.065 * EX;
    const pis = [];
    for (let i = 1; i <= N; i++) {
      const peI = (N - i) % 2 === 0 ? 0 : 1;
      if (i === N) {
        PN.sigma = Lrun;
        pis.push(PN);
      } else {
        let sigma = Lrun * fr(i);
        if (i === 1) sigma = Math.max(sigma, Math.min(pesEspera[peI].sigma + 0.16, Lrun * fr(2) - 0.12));
        const lado = peI === 0 ? largura : -largura;
        const q = novaPisada(peI, S0.x + a.x * sigma + lax * lado, S0.z + a.z * sigma + laz * lado, psiA);
        q.sigma = sigma;
        pis.push(q);
      }
    }
    p.pis = pis;

    // Instantes: T[i] = o quadril passa ao lado da pisada i; tN = o pé de apoio pisa; tc = contato
    const T = [];
    for (let i = 1; i <= N - 1; i++) {
      T.push(i === 1 ? dtPasso * 1.25 : T[T.length - 1] + dtPasso * (1.04 - (0.08 * (i - 1)) / Math.max(1, N - 2)));
    }
    const tN = N > 1 ? T[N - 2] + Math.max(0.05, (Lrun - dN - pis[N - 2].sigma) / Math.max(0.5, vN)) : dtPasso * 1.35;
    const tc = tN + delta;
    Object.assign(p, { T, tN, tc });

    // --- Depois da bola: o corpo segue, o pé do chute pisa, o de apoio dá mais um passo e o corpo para ---
    const corre = limitar((vN - 1.2) / 2.4, 0, 1); // 0 = chega andando, 1 = chega correndo
    const vc = limitar((dAnda / delta) * 0.85, 0.5, 2.6); // m/s do quadril no contato
    const tPouso = tc + (B.tPouso + 0.05 * pw) * ks;
    let mx = misturar(a.x, fx, B.segue);
    let mz = misturar(a.z, fz, B.segue);
    const mm = Math.hypot(mx, mz) || 1;
    mx /= mm;
    mz /= mm;
    const dVoo = Math.max(0.16, vc * (tPouso - tc) * 0.72 * B.anda);
    const salto = B.salto && pw * (0.4 + 0.6 * corre) > 0.5;
    const F1 = { x: Fc.gx + mx * dVoo, z: Fc.gz + mz * dVoo };
    const psi1 = psiK + B.vira;
    const r1x = -Math.cos(psi1);
    const r1z = Math.sin(psi1);
    const L1 = novaPisada(1, F1.x + mx * 0.2 * EX + r1x * (QX * EX * 0.9 + B.pousoLado), F1.z + mz * 0.2 * EX + r1z * (QX * EX * 0.9 + B.pousoLado), psi1 - 0.08);
    const psi2 = psiK + 0.4 * B.vira;
    const passoFinal = (0.16 + 0.3 * corre * B.anda) * EX;
    const L2 = novaPisada(0, L1.x + mx * passoFinal + Math.cos(psi2) * 0.23 * EX, L1.z + mz * passoFinal - Math.sin(psi2) * 0.23 * EX, psi2 + 0.1);
    const F2 = { x: (L1.x + L2.x) / 2, z: (L1.z + L2.z) / 2 };
    const tSaiN = salto ? tc + 0.1 * ks : tPouso + 0.05;
    const tPasso2 = tPouso + 0.3 + 0.06 * corre;
    const tFim = tPasso2 + 0.36;
    Object.assign(p, { tPouso, tSaiN, tPasso2, tFim, L1, L2, salto, corre });

    // --- Curvas do quadril: lugar no campo, altura e para onde o corpo vira ---
    const kt = [0];
    const kx = [S0.x];
    const kz = [S0.z];
    const kh = [[0, repouso.H]];
    const krap = [[0, 0]];
    const balanco = 0.016 * EX;
    for (let i = 1; i <= N - 1; i++) {
      const q = pis[i - 1];
      const antes = i === 1 ? 0 : pis[i - 2].sigma;
      const depois = i === N - 1 ? Lrun - dN * 0.5 : pis[i].sigma;
      const tAntes = i === 1 ? 0 : T[i - 2];
      const tDepois = i === N - 1 ? tN : T[i];
      const vel = (depois - antes) / Math.max(0.1, tDepois - tAntes);
      const r = limitar((vel - 1.4) / 1.8, 0, 1);
      q.vel = vel;
      q.rap = r;
      const lado = (q.pe === 0 ? 1 : -1) * balanco * (1 - 0.6 * r); // o quadril vai um pouco para o lado do pé que pisa
      kt.push(T[i - 1]);
      kx.push(S0.x + a.x * q.sigma + lax * lado);
      kz.push(S0.z + a.z * q.sigma + laz * lado);
      const tMeio = i === 1 ? T[0] * 0.55 : (T[i - 2] + T[i - 1]) / 2;
      kh.push([tMeio, H_PE - misturar(0.05, 0.036, r)]);
      kh.push([T[i - 1], H_PE - misturar(0.022, 0.07, r)]);
      krap.push([T[i - 1], r]);
    }
    kt.push(tN, tc, tPouso, tPasso2, tFim);
    kx.push(E.x, Fc.gx, F1.x, misturar(F1.x, F2.x, 0.8), F2.x);
    kz.push(E.z, Fc.gz, F1.z, misturar(F1.z, F2.z, 0.8), F2.z);
    p.cx = new Curva(kt, kx);
    p.cz = new Curva(kt, kz);
    const rN = limitar((vN - 1.4) / 1.8, 0, 1);
    if (N > 1) kh.push([(T[N - 2] + tN) / 2, H_PE - misturar(0.05, 0.03, rN)]);
    kh.push([tN, H_PE - 0.065 - 0.03 * rN]);
    kh.push([tc, Fc.H]);
    if (salto) kh.push([misturar(tc, tPouso, 0.5), Fc.H + 0.015 + 0.05 * pw]);
    kh.push([tPouso + 0.07, H_PE - 0.05 - 0.035 * corre * pw]);
    kh.push([tPasso2 + 0.05, H_PE - 0.045]);
    kh.push([tFim, H_PE - 0.022]);
    kh.sort((u, v) => u[0] - v[0]);
    p.ch = new Curva(kh.map((k) => k[0]), kh.map((k) => k[1]));
    krap.push([tN, rN], [tc, rN]);
    p.crap = new Curva(krap.map((k) => k[0]), krap.map((k) => k[1]));
    // Arranque: o tronco inclina mais para a frente nos primeiros passos
    p.carr = new Curva([0, dtPasso * 0.7, dtPasso * 2.4, dtPasso * 4], [0, 1, 0.45, 0]);
    // Para onde o corpo vira: na linha da corrida até a última passada, abre para a bola, e depois segue
    const tAbre = N > 1 ? T[N - 2] : tN * 0.4;
    p.cyaw = new Curva(
      [0, Math.min(dtPasso, tAbre * 0.5), tAbre, tc, tPouso, tFim],
      [psi0, psiA, psiA, psiC, misturar(psiC, psi1, 0.8), psi2],
    );

    // --- Quando cada pé pisa e sai do chão (do movimento do quadril e do alcance da perna) ---
    const sigmaEm = (t) => (p.cx.em(t) - S0.x) * a.x + (p.cz.em(t) - S0.z) * a.z;
    const tempoEm = (sigma, t0, t1) => {
      let lo = t0;
      let hi = t1;
      if (sigmaEm(lo) >= sigma) return lo;
      if (sigmaEm(hi) <= sigma) return hi;
      for (let n = 0; n < 30; n++) {
        const m = 0.5 * (lo + hi);
        if (sigmaEm(m) < sigma) lo = m;
        else hi = m;
      }
      return 0.5 * (lo + hi);
    };
    const primeiro = pis[0].pe;      // o pé que dá o primeiro passo
    const outro = 1 - primeiro;
    for (let i = 1; i <= N; i++) {
      const q = pis[i - 1];
      const sIn = q.sigma - (i === 1 ? pesEspera[outro].sigma : pis[i - 2].sigma);
      const r = q.rap || 0;
      q.dlead = i === N ? dN : Math.min(DLEAD, 0.45 * sIn);
      q.tauBate = limitar(0.45 * sIn, 0.05, 0.3) * (1 - 0.45 * r);
      q.tBate = i === N ? tN : tempoEm(q.sigma - q.dlead, 0, tN);
      if (i < N) {
        const sOut = pis[i].sigma - q.sigma;
        q.dtrail = Math.min(DTRAIL, 0.62 * sOut);
        q.p0 = 0.12 * q.dtrail;
        q.tauSai = 0.8 + 0.25 * r;
        q.tSai = tempoEm(q.sigma + q.dtrail, q.tBate, tc);
      }
    }
    // Os pés da espera: o do primeiro passo sai logo; o outro empurra até a perna esticar
    for (const q of pesEspera) q.p0 = Math.max(0, -q.sigma) + 0.02; // o calcanhar só sobe quando o quadril anda
    pesEspera[primeiro].tSai = Math.max(0.03, 0.1 * (N > 1 ? T[0] : tN));
    pesEspera[primeiro].tauSai = 0.3;
    pesEspera[primeiro].dtrail = pesEspera[primeiro].p0 + 0.3;
    {
      const q = pesEspera[outro];
      const sOut = pis[0].sigma - q.sigma; // até a primeira pisada (do outro pé)
      q.dtrail = Math.max(q.p0 + 0.1, Math.min(DTRAIL, 0.62 * Math.max(0.2, sOut)));
      q.tauSai = 0.75;
      q.tSai = Math.max(tempoEm(q.sigma + q.dtrail, 0, tc), pis[0].tBate + 0.012);
    }
    // O pé de apoio do chute: fica até o corpo sair de cima dele (ou sai no salto); o calcanhar sobe sozinho
    PN.modo = 'curva';
    PN.tSai = tSaiN;
    {
      const bate = limitar(0.55 * dN, 0.08, 0.26);
      const tPlano = tN + Math.min(0.05, delta * 0.4);
      const ts = [tN, tPlano, tc];
      const vs = [-bate, 0, 0];
      if (salto) {
        ts.push(tSaiN);
        vs.push(0.75);
      } else {
        ts.push(tc + 0.09 * ks, tPouso, tSaiN);
        vs.push(B.pivo ? 0.24 : 0.1, 0.7, 0.95);
      }
      PN.ctau = new Curva(ts, vs, 'livre', 'livre');
      PN.cyaw = B.pivo && !salto ? new Curva([tc + 0.09 * ks, tPouso], [0, B.pivo]) : null;
    }
    L1.modo = 'curva';
    L1.tBate = tPouso;
    L1.ctau = new Curva([tPouso, tPouso + 0.06], [salto ? 0.12 : -0.14, 0], 'livre', 0);
    L2.modo = 'curva';
    L2.tBate = tPasso2;
    L2.ctau = new Curva([tPasso2, tPasso2 + 0.07], [-0.16, 0], 'livre', 0);

    // --- O corpo: chaves do chute (os canais das pernas entram depois, com a perna do chute medida) ---
    const cadeiaK = [pesEspera[1], ...pis.filter((q) => q.pe === 1)];
    const ultimaK = cadeiaK[cadeiaK.length - 1]; // de onde o pé do chute sai para bater
    const tSaiK = ultimaK.tSai;
    const tb = limitar(tc - 0.115 * ks, tSaiK + 0.07 * ks, tc - 0.085 * ks); // o alto da armada
    const td = tc - 0.045 * ks;
    const te = tc + 0.055 * ks;
    const ta = Math.min(tc + (batida === 'semGiro' || batida === 'cavadinha' ? 0.13 : 0.18) * ks, tPouso - 0.14);
    const tq = Math.max(ta + 0.05, tPouso - 0.08);
    Object.assign(p, { tSaiK, tb, td, te, ta, tq, vals });
    const corpo = (v, t) => {
      const k = { t };
      for (const n of CANAIS_CORPO) k[n] = v[n];
      return k;
    };
    const desc = {};
    for (const n of CANAIS_CORPO) desc[n] = misturar(vals.armada[n], vals.contato[n], n === 'qg' ? 0.55 : n[0] === 'e' || n[0] === 'd' ? 0.35 : 0.45);
    const passo2 = {};
    for (const n of CANAIS_CORPO) passo2[n] = misturar(vals.pouso[n], vals.fim[n], 0.6);
    p.cc = curvasDasChaves([
      corpo(vals.armada, tb), corpo(desc, td), corpo(vals.contato, tc), corpo(vals.estende, te), corpo(vals.alto, ta),
      corpo(vals.queda, tq), corpo(vals.pouso, tPouso + 0.04), corpo(passo2, tPasso2), corpo(vals.fim, tFim),
    ]);
    // De quando a corrida passa o comando para as chaves do chute
    p.tk0 = ultimaK.tBate > -1 ? misturar(ultimaK.tBate, tSaiK, 0.45) : tSaiK * 0.3;
    p.tk1 = tb - 0.015;

    // --- Trechos de cada perna: apoio, balanço, chute ---
    p.segs = [[], []];
    const cadeias = [[pesEspera[0], ...pis.filter((q) => q.pe === 0), L2], cadeiaK.concat([L1])];
    const tarefas = [];
    for (let i = 0; i < 2; i++) {
      const cad = cadeias[i];
      for (let n = 0; n < cad.length; n++) {
        const q = cad[n];
        p.segs[i].push({ tipo: 'apoio', t0: q.tBate, t1: q.tSai, pis: q });
        if (n === cad.length - 1) break;
        const prox = cad[n + 1];
        if (i === 1 && q === ultimaK) {
          tarefas.push({ t: q.tSai, fazer: () => montarChute(p) });
          break;
        }
        const seg = { tipo: 'balanco', t0: q.tSai, t1: prox.tBate, de: q, para: prox, A0: new THREE.Vector3(), A1: new THREE.Vector3(), tau0: 0, tau1: 0, tauMeio: 0, yaw0: 0, yaw1: 0, altura: 0.1, pico: 0.8 };
        p.segs[i].push(seg);
        tarefas.push({ t: q.tSai, fazer: () => montarBalanco(p, i, seg) });
      }
    }
    // Em ordem de tempo: cada trecho novo parte de como a perna estava no instante em que começa
    tarefas.sort((u, v) => u.t - v.t);
    for (const tarefa of tarefas) tarefa.fazer();
    for (let i = 0; i < 2; i++) p.segs[i].sort((u, v) => u.t0 - v.t0);

    p.tChute = Math.max(0, Math.min(p.tk0, tN - 0.05));
    return p;
  }

  // O pé sai da pisada `de` (como estava no instante da saída) e vai até a pisada `para`
  const Fm = novoQuadro(); // quadro de trabalho do planejamento
  function montarBalanco(p, i, seg) {
    quadro(p, seg.t0 - 1e-5, Fm);
    const L = Fm.pernas[i];
    seg.A0.copy(L.A);
    seg.tau0 = L.tau;
    seg.yaw0 = L.yaw;
    const q = seg.para;
    seg.tau1 = q.modo === 'curva' ? q.ctau.em(q.tBate) : -q.tauBate;
    seg.yaw1 = q.yaw;
    tornozeloApoiado(seg.tau1 >= 0 ? q.ponta : q.calc, seg.tau1 >= 0 ? 2 : 0, q.yaw, seg.tau1, 0, seg.A1);
    const dist = Math.hypot(seg.A1.x - seg.A0.x, seg.A1.z - seg.A0.z);
    const vel = dist / Math.max(0.08, seg.t1 - seg.t0);
    const r = limitar((vel - 2.2) / 3.5, 0, 1);
    seg.altura = limitar(0.07 * (vel - 1.6), 0.025, 0.3) * EY; // o calcanhar sobe mais quanto mais rápido o passo
    seg.pico = misturar(1, 0.72, r);                           // e sobe mais cedo
    seg.tauMeio = seg.tau0 * 0.7 + 0.45 * r;
  }

  // A perna do chute: sai do chão (como estava), arma atrás, desce em chicote, passa pelo contato (ângulos
  // calculados para o pé encostar no ponto certo da bola), termina conforme a batida e vai pisar.
  // Três trechos: 'decola' (do pé preso no chão para os ângulos, sem tranco), 'chute' (só ângulos) e
  // 'pouso' (dos ângulos para a pisada seguinte).
  function montarChute(p) {
    const { tSaiK, tb, td, tc, te, ta, tPouso, ikc } = p;
    // Como a perna estava ao sair do chão (ângulos e velocidade dos ângulos)
    const h = 1 / 120;
    quadro(p, tSaiK - 1e-5 - h, Fm);
    const k0 = paraCanais(Fm, Fm.pernas[1], {});
    quadro(p, tSaiK - 1e-5, Fm);
    const L0 = Fm.pernas[1];
    const k1 = paraCanais(Fm, L0, {});
    const decola = { tipo: 'decola', t0: tSaiK, t1: tb, A0: L0.A.clone(), A1: new THREE.Vector3(), tau: L0.tau, yaw: L0.yaw };
    const vel = {};
    for (const n of CANAIS_PERNA) vel[n] = limitar((k1[n] - k0[n]) / h, -8, 8);
    const v = valoresDoChute(p.batida, p.pw, aberto, ikc);
    const perna = (o, t) => {
      const k = { t };
      for (const n of CANAIS_PERNA) k[n] = o[n];
      return k;
    };
    // Descida: a coxa já veio (bacia girando na frente), a canela ainda está dobrada atrás
    const arm = v.armada;
    const desc = {
      pf: misturar(arm.pf, ikc.pf, 0.6), pl: misturar(arm.pl, ikc.pl, 0.6), pg: misturar(arm.pg, ikc.pg, 0.6),
      pj: Math.max(ikc.pj + 0.45, arm.pj - 0.14), pt: misturar(arm.pt, ikc.pt, 0.7), pp: misturar(arm.pp, ikc.pp, 0.7), pz: misturar(arm.pz, ikc.pz, 0.7),
    };
    p.cp = curvasDasChaves([
      perna(k1, tSaiK), perna(arm, tb), perna(desc, td), perna(ikc, tc), perna(v.estende, te), perna(v.alto, ta), perna(v.queda, p.tq),
    ], vel);
    const tDesce = Math.max(ta + 0.03, tPouso - 0.2); // daqui até pisar, os ângulos dão lugar à pisada
    const chute = { tipo: 'chute', t0: tSaiK, t1: tDesce };
    p.segs[1].push(chute);
    // Onde o pé está no alto da armada e no alto da terminação (pelos ângulos)
    const medida = { A: decola.A1, yaw: 0, tau: 0 };
    quadro(p, tb, Fm);
    peDaPerna(1, Fm, Fm.pernas[1], medida);
    const pouso = { tipo: 'pouso', t0: tDesce, t1: tPouso, A0: new THREE.Vector3(), A1: new THREE.Vector3(), tau: p.L1.ctau.em(tPouso), yaw: p.L1.yaw };
    medida.A = pouso.A0;
    quadro(p, tDesce, Fm);
    peDaPerna(1, Fm, Fm.pernas[1], medida);
    tornozeloApoiado(pouso.tau >= 0 ? p.L1.ponta : p.L1.calc, pouso.tau >= 0 ? 2 : 0, p.L1.yaw, pouso.tau, 0, pouso.A1);
    chute.t0 = tb;
    p.segs[1].splice(p.segs[1].indexOf(chute), 0, decola);
    p.segs[1].push(pouso);
    p.segs[1].push({ tipo: 'apoio', t0: tPouso, t1: Infinity, pis: p.L1 });
  }

  // ---------- Avaliar o plano num instante ----------

  const trechoDe = (lista, t) => {
    let s = lista[0];
    for (let n = 0; n < lista.length; n++) {
      if (lista[n].t0 <= t) s = lista[n];
      else break;
    }
    return s;
  };
  const kPerna = {};
  const poloFrente = (F, L, yawPe, lado) => {
    // Para a frente do pé e para baixo: com a perna embaixo do corpo o joelho aponta para a frente; com o pé
    // lá atrás (balanço, armada do chute) o joelho fica embaixo da linha quadril → tornozelo
    const rel = (yawPe - F.yaw) * 0.7 + lado;
    L.polo.set(Math.sin(rel), -0.45, Math.cos(rel));
  };

  // Alvo de cada perna (antes de resolver): onde o pé está ou vai
  function alvoDaPerna(p, i, t, F) {
    const L = F.pernas[i];
    const seg = trechoDe(p.segs[i], t);
    L.seg = seg;
    L.rolo = 0;
    L.peso = 1;
    const lado = i === 0 ? 0.07 : -0.07;
    if (seg.tipo === 'apoio') {
      const q = seg.pis;
      let tau;
      let yaw = q.yaw;
      if (q.modo === 'curva') {
        tau = q.ctau.em(t);
        if (q.cyaw) yaw += q.cyaw.em(t);
      } else {
        const prog = (F.gx - q.x) * p.ax + (F.gz - q.z) * p.az; // quadril em relação à pisada, na linha da corrida
        if (prog < 0 && q.dlead > 0) tau = -q.tauBate * (1 - suave((prog + q.dlead) / (0.55 * q.dlead)));
        else tau = misturar(q.tau0, q.tauSai, suave((prog - q.p0) / Math.max(0.05, q.dtrail - q.p0)));
      }
      L.modo = 'ik';
      L.plantado = true;
      L.tau = tau;
      L.yaw = yaw;
      L.qual = tau >= 0 ? 2 : 0;
      L.ancora = tau >= 0 ? q.ponta : q.calc;
      tornozeloApoiado(L.ancora, L.qual, yaw, tau, F.pulo, L.A);
      if (F.pulo > 0) L.tau = tau + 0.5 * Math.min(1, F.pulo / 0.08);
      poloFrente(F, L, yaw, lado);
      if (q.polo) {
        const k = rampa(t, 0, 0.3);
        L.polo.lerp(q.polo, 1 - k).normalize();
      }
      return;
    }
    if (seg.tipo === 'balanco') {
      const u = limitar((t - seg.t0) / Math.max(1e-4, seg.t1 - seg.t0), 0, 1);
      const e = suave(u);
      const eh = suave((u - 0.06) / 0.86); // na horizontal sai um pouco depois e chega um pouco antes: o começo do passo é só subir e o fim é só descer
      L.modo = 'ik';
      L.plantado = false;
      L.A.x = misturar(seg.A0.x, seg.A1.x, eh);
      L.A.z = misturar(seg.A0.z, seg.A1.z, eh);
      L.A.y = misturar(seg.A0.y, seg.A1.y, e) + seg.altura * Math.sin(Math.PI * u ** seg.pico) ** 1.2 + F.pulo;
      L.tau = u < 0.3 ? misturar(seg.tau0, seg.tauMeio, suave(u / 0.3)) : misturar(seg.tauMeio, seg.tau1, suave((u - 0.3) / 0.62));
      L.yaw = misturar(seg.yaw0, seg.yaw1, e);
      poloFrente(F, L, L.yaw, lado);
      return;
    }
    if (seg.tipo === 'decola' || seg.tipo === 'pouso') {
      // Entre o pé preso no chão e os ângulos do chute: o alvo segue um caminho no ar e o peso troca aos poucos
      const u = limitar((t - seg.t0) / Math.max(1e-4, seg.t1 - seg.t0), 0, 1);
      const e = suave(u);
      const sobe = seg.tipo === 'decola' ? 1 - (1 - u) * (1 - u) : e; // decola: sai do chão logo
      const eh = seg.tipo === 'decola' ? e : suave(u / 0.9);          // pouso: chega por cima e desce
      L.modo = 'mix';
      L.plantado = false;
      L.A.x = misturar(seg.A0.x, seg.A1.x, eh);
      L.A.z = misturar(seg.A0.z, seg.A1.z, eh);
      L.A.y = misturar(seg.A0.y, seg.A1.y, sobe) + F.pulo;
      L.tau = seg.tau;
      L.yaw = seg.yaw;
      L.peso = seg.tipo === 'decola' ? 1 - e : e;
      poloFrente(F, L, L.yaw, lado);
      return;
    }
    L.modo = 'fk'; // chute
    L.plantado = false;
  }

  // O corpo todo no instante t do plano p (sem a espera nem a reação por cima)
  function quadro(p, t, F) {
    F.t = t;
    F.pulo = 0;
    F.gx = p.cx.em(t);
    F.gz = p.cz.em(t);
    F.yaw = p.cyaw.em(t);
    F.H = p.ch.em(t);
    for (let i = 0; i < 2; i++) alvoDaPerna(p, i, t, F);

    // Corpo: a corrida (braços e tronco acompanham os pés) passa o comando para as chaves do chute
    const wk = rampa(t, p.tk0, p.tk1);
    const cK = F.c;
    if (wk < 1) {
      // Fase da passada: quanto o pé direito está à frente do esquerdo (−1 a 1)
      const c = Math.cos(F.yaw);
      const s = Math.sin(F.yaw);
      const zE = (F.pernas[0].A.x - F.gx) * s + (F.pernas[0].A.z - F.gz) * c;
      const zD = F.pernas[1].modo === 'fk' ? zE - 0.8 : (F.pernas[1].A.x - F.gx) * s + (F.pernas[1].A.z - F.gz) * c;
      const fase = limitar((zD - zE) / (0.95 * EX), -1, 1);
      const r = p.crap.em(t);
      const arr = p.carr.em(t);
      const amp = 0.34 + 0.5 * r;
      const cot = misturar(0.6, 1.5, r);
      const yE = F.pernas[0].A.y;
      const yD = F.pernas[1].modo === 'fk' ? yE : F.pernas[1].A.y;
      corrida.qf = 0.02 + 0.03 * r;
      corrida.qg = 0.1 * fase;
      corrida.ql = limitar((yE - yD) * 0.18, -0.05, 0.05); // o lado do pé que está no ar sobe um pouco
      corrida.tf = 0.07 + 0.12 * r + 0.15 * arr;
      corrida.tl = 0;
      corrida.tg = -0.27 * fase * (0.55 + 0.45 * r);
      corrida.ef = amp * fase + 0.06;
      corrida.el = 0.15 + 0.03 * r;
      corrida.ec = cot + 0.28 * Math.max(0, fase) - 0.1 * Math.max(0, -fase);
      corrida.eg = 0;
      corrida.df = -amp * fase + 0.06;
      corrida.dl = 0.15 + 0.03 * r;
      corrida.dc = cot + 0.28 * Math.max(0, -fase) - 0.1 * Math.max(0, fase);
      corrida.dg = 0;
      F.fase = fase;
    }
    for (const n of CANAIS_CORPO) {
      const chave = wk > 0 ? p.cc[n].em(t) : 0;
      cK[n] = wk >= 1 ? chave : wk <= 0 ? corrida[n] : misturar(corrida[n], chave, wk);
    }
    atualizarQuadril(F);
    fecharPernas(p, F);
    return F;
  }
  const corrida = novosCanais();

  // Resolve as duas pernas do quadro: pé no chão não escorrega (o calcanhar sobe o que for preciso para a
  // perna alcançar; se nem assim, o quadril desce), pé no ar segue o alvo, perna do chute segue os ângulos
  function fecharPernas(p, F) {
    let desce = 0;
    for (let i = 0; i < 2; i++) {
      const L = F.pernas[i];
      if (L.modo !== 'ik' || !L.plantado) continue;
      let d = distQuadril(i, F, L.A);
      if (d <= ESTICA) continue;
      // Só levanta o calcanhar se o quadril já passou do pé (perna ficando para trás)
      const adiante = (F.gx - L.ancora.x) * Math.sin(L.yaw) + (F.gz - L.ancora.z) * Math.cos(L.yaw);
      if (L.qual === 2 && adiante > -0.05 && L.tau < TAU_MAX) {
        let lo = L.tau;
        let hi = TAU_MAX;
        for (let n = 0; n < 9; n++) {
          const m = 0.5 * (lo + hi);
          tornozeloApoiado(L.ancora, 2, L.yaw, m, F.pulo, _A);
          if (distQuadril(i, F, _A) > ESTICA) lo = m;
          else hi = m;
        }
        L.tau = hi;
        tornozeloApoiado(L.ancora, 2, L.yaw, hi, F.pulo, L.A);
        d = distQuadril(i, F, L.A);
      }
      if (d > DMAX) {
        juntaDoQuadril(i, F, _h);
        paraCorpo(F, L.A.x, L.A.y, L.A.z, _v);
        const dh2 = (_v.x - _h.x) ** 2 + (_v.z - _h.z) ** 2;
        const dy = _h.y - _v.y;
        if (dh2 < DMAX * DMAX) desce = Math.max(desce, dy - Math.sqrt(DMAX * DMAX - dh2));
      }
    }
    F.desce = desce;
    if (desce > 0) F.H -= desce;
    for (let i = 0; i < 2; i++) {
      const L = F.pernas[i];
      if (L.modo === 'ik') {
        L.falta = ik(i, F, L.A, L.yaw, L.tau, L.rolo, L.polo, L);
        continue;
      }
      // Perna do chute pelos ângulos
      for (const n of CANAIS_PERNA) kPerna[n] = p.cp[n].em(F.t);
      if (L.modo === 'fk') {
        fkChute(F, kPerna, L);
      } else {
        // Decolagem e pouso: mistura dos ângulos com o alvo (na decolagem o tornozelo já é o dos ângulos)
        ik(i, F, L.A, L.yaw, L.tau, L.rolo, L.polo, mix);
        fkChute(F, kPerna, L);
        L.q.slerp(mix.q, L.peso);
        L.joelho = misturar(L.joelho, mix.joelho, L.peso);
        if (L.seg.tipo === 'pouso') L.qPe.slerp(mix.qPe, L.peso);
      }
      acimaDoChao(i, F, L);
    }
  }
  // Pé no ar que desceria abaixo da grama (a perna do chute passando rente ao chão): o tornozelo sobe o que
  // falta e a perna é resolvida de novo, com o joelho e o pé virados do mesmo jeito
  function acimaDoChao(i, Fq, L) {
    _q.copy(Fq.qQ).multiply(L.q);
    _v.set(0, -COXA, 0).applyQuaternion(_q);
    juntaDoQuadril(i, Fq, _h);
    _polo2.copy(_v);                 // do quadril ao joelho: para onde o joelho aponta
    _h.add(_v);
    _q.multiply(_q2.setFromAxisAngle(EIXO_X, L.joelho));
    _v.set(0, -CANELA, 0).applyQuaternion(_q);
    _h.add(_v);                      // tornozelo (corpo)
    _qf.copy(_q).multiply(L.qPe);    // pé (corpo)
    let menor = Infinity;
    for (const ponto of PONTOS_PE.sola) menor = Math.min(menor, _h.y + _v.copy(ponto).applyQuaternion(_qf).y);
    const falta = (CHAO_MIN + Fq.pulo) / EY - menor;
    if (falta <= 0) return;
    _h.y += falta;
    paraMundo(Fq, _h, _A);
    ik(i, Fq, _A, 0, 0, 0, _polo2, L);
    _q2.setFromAxisAngle(EIXO_X, L.joelho);
    L.qPe.copy(Fq.qQ).multiply(L.q).multiply(_q2).invert().multiply(_qf);
  }
  const mix = novaPerna();

  // ---------- Espera, reação e cabeça (por cima do quadro) ----------

  const F = novoQuadro();      // o quadro que vai para o boneco
  const esperaC = novosCanais();
  const R = { olha: 1, dh: 0, pulo: 0, cf: 0, cg: 0, mE: null, mD: null };
  const olho = { giro: 0, frente: 0, t: null, base: '' }; // a cabeça agora (com limite de velocidade)
  const alvoOlhar = new THREE.Vector3();
  let relogio = 0;             // o relógio da espera na última vez que ela foi desenhada
  let plano = null;
  let variacaoGol = 0;

  // A espera no relógio t: respira, troca o peso de perna, mexe os braços de leve. Preenche esperaC e
  // devolve o balanço do quadril { x (m, para a esquerda), z (m, para a frente), h (m) }
  const balancoEspera = { x: 0, z: 0, h: 0 };
  function espera(t) {
    const respira = Math.sin(t * 1.9);
    const peso = Math.sin(t * 0.62 + 0.4) + 0.35 * Math.sin(t * 1.31);
    const c = repouso.canais;
    for (const n of CANAIS_CORPO) esperaC[n] = c[n];
    esperaC.tf += 0.012 * respira;
    esperaC.tl += 0.02 * peso;
    esperaC.ql += -0.028 * peso;
    esperaC.tg += 0.02 * Math.sin(t * 0.43);
    esperaC.el += 0.012 * respira;
    esperaC.dl += 0.012 * respira;
    esperaC.ef += 0.025 * Math.sin(t * 0.8);
    esperaC.df += 0.025 * Math.sin(t * 0.8 + 2);
    balancoEspera.x = 0.014 * peso * EX;
    balancoEspera.z = 0.006 * Math.sin(t * 0.9) * EX;
    balancoEspera.h = -0.004 * respira - 0.004 * Math.abs(peso);
    return balancoEspera;
  }
  // Para onde ele olha enquanto espera: a bola, e de vez em quando o gol (a cada ~4,5 s, por ~1,3 s)
  function olharDaEspera(t, destino) {
    const ciclo = ((t + 2.6) % 4.6 + 4.6) % 4.6;
    const gol = rampa(ciclo, 0, 0.35) * (1 - rampa(ciclo, 1.3, 1.7));
    const p = plano.chute.alvo;
    return destino.set(misturar(C.x, esp * p.x, gol), misturar(raio, 1.3, gol), misturar(C.z, p.z, gol));
  }

  // Ângulos da cabeça (giro e frente, em relação ao tronco) para olhar um ponto do mundo
  const olharPara = (Fq, alvoM, saida) => {
    _e.set(Fq.c.tf, Fq.c.tg, Fq.c.tl, ORDEM_T);
    _q.setFromEuler(_e);
    _q2.copy(Fq.qQ).multiply(_q); // tronco no corpo
    _v.copy(POS_OLHOS).applyQuaternion(_q).add(POS_TRONCO).applyQuaternion(Fq.qQ);
    _v.y += Fq.H;
    paraCorpo(Fq, alvoM.x, alvoM.y, alvoM.z, _a);
    _a.sub(_v).applyQuaternion(_q2.invert());
    saida.giro = limitar(Math.atan2(_a.x, _a.z), -1.25, 1.25);
    // (o resto do caminho até a bola é dos olhos: a cabeça baixa só uma parte)
    const baixo = Math.atan2(-_a.y, Math.hypot(_a.x, _a.z));
    saida.frente = limitar(baixo > 0 ? 0.62 * baixo : baixo, -0.7, 0.6);
    return saida;
  };
  const olhoAlvo = { giro: 0, frente: 0 };

  // ---------- Do quadro para o boneco ----------

  const pose = {
    tronco: { frente: 0, lado: 0, giro: 0 },
    cabeca: { frente: 0, giro: 0, lado: 0 },
    bracoE: { frente: 0, lado: 0, cotovelo: 0, giro: 0 },
    bracoD: { frente: 0, lado: 0, cotovelo: 0, giro: 0 },
    quadril: { frente: 0, lado: 0, giro: 0 },
    maoE: { x: 0, y: 0, z: 0, peso: 0 },
    maoD: { x: 0, y: 0, z: 0, peso: 0 },
    apoio: 0, pulo: 0, agachar: 0,
  };
  function aplicar(Fq) {
    const c = Fq.c;
    const s = esp;
    // No canhoto, esquerda e direita trocam e os ângulos de lado e de giro mudam de sinal
    const bE = s > 0 ? pose.bracoE : pose.bracoD;
    const bD = s > 0 ? pose.bracoD : pose.bracoE;
    pose.quadril.frente = c.qf;
    pose.quadril.giro = s * c.qg;
    pose.quadril.lado = s * c.ql;
    pose.tronco.frente = c.tf;
    pose.tronco.giro = s * c.tg;
    pose.tronco.lado = s * c.tl;
    pose.cabeca.frente = Fq.cf;
    pose.cabeca.giro = s * Fq.cg;
    pose.cabeca.lado = s * Fq.cl;
    bE.frente = c.ef;
    bE.lado = c.el;
    bE.cotovelo = Math.max(0, c.ec);
    bE.giro = c.eg;
    bD.frente = c.df;
    bD.lado = c.dl;
    bD.cotovelo = Math.max(0, c.dc);
    bD.giro = c.dg;
    const mE = s > 0 ? pose.maoE : pose.maoD;
    const mD = s > 0 ? pose.maoD : pose.maoE;
    mE.peso = R.mE ? R.mE.peso * pesoReacao : 0;
    mD.peso = R.mD ? R.mD.peso * pesoReacao : 0;
    if (R.mE) {
      mE.x = s * R.mE.x;
      mE.y = R.mE.y;
      mE.z = R.mE.z;
    }
    if (R.mD) {
      mD.x = s * R.mD.x;
      mD.y = R.mD.y;
      mD.z = R.mD.z;
    }
    personagem.aplicarPose(pose);
    J.quadril.position.y = Fq.H;
    for (let i = 0; i < 2; i++) {
      const L = Fq.pernas[i];
      jPerna[i].quaternion.set(L.q.x, s * L.q.y, s * L.q.z, L.q.w);
      jJoelho[i].rotation.set(Math.max(0, L.joelho), 0, 0);
      jTornozelo[i].quaternion.set(L.qPe.x, s * L.qPe.y, s * L.qPe.z, L.qPe.w);
    }
    g.position.set(s * Fq.gx, 0, Fq.gz);
    g.rotation.set(0, s * Fq.yaw, 0);
  }
  let pesoReacao = 0;

  // A cabeça vai para o alvo com velocidade limitada (não dá tranco quando o alvo muda)
  // base: 'espera' (t é o relógio do jogo) ou 'corrida' (t é o tempo da cobrança); na troca vale um quadro
  function moverCabeca(Fq, t, base, peso, cfExtra, cgExtra) {
    olharPara(Fq, alvoOlhar, olhoAlvo);
    const gAlvo = olhoAlvo.giro * peso + cgExtra;
    const fAlvo = olhoAlvo.frente * peso + cfExtra;
    const dt = olho.t === null ? 1 : olho.base !== base ? 1 / 60 : t - olho.t;
    olho.base = base;
    if (dt <= 0 || dt > 0.25) {
      olho.giro = gAlvo;
      olho.frente = fAlvo;
    } else {
      const passo = 5.5 * dt; // rad/s
      const k = 1 - Math.exp(-14 * dt);
      olho.giro += limitar((gAlvo - olho.giro) * k, -passo, passo);
      olho.frente += limitar((fAlvo - olho.frente) * k, -passo, passo);
    }
    olho.t = t;
    Fq.cg = olho.giro;
    Fq.cf = olho.frente;
    Fq.cl = 0;
  }

  // Desenha a espera no relógio t (os pés presos nos lugares da postura)
  function desenharEspera(t, tQuadro, base) {
    const p = plano;
    quadro(p, 0, F);
    const b = espera(t);
    for (const n of CANAIS_CORPO) F.c[n] = esperaC[n];
    const c = Math.cos(psi0);
    const s = Math.sin(psi0);
    F.gx = S0.x + b.x * c + b.z * s;
    F.gz = S0.z - b.x * s + b.z * c;
    F.yaw = psi0;
    F.H = repouso.H + b.h;
    atualizarQuadril(F);
    for (let i = 0; i < 2; i++) alvoDaPerna(p, i, 0, F);
    fecharPernas(p, F);
    olharDaEspera(t, alvoOlhar);
    moverCabeca(F, tQuadro, base, 1, repouso.cabeca.frente * 0.3, 0);
    R.mE = null;
    R.mD = null;
    aplicar(F);
  }

  function parado(t = 0) {
    relogio = t;
    desenharEspera(t, t, 'espera');
  }

  // O chute escolhido chega aqui, uma vez, quando a corrida começa (e de novo, igual, no replay)
  function preparar({ forca = 0.7, contato = { x: 0, y: 0 }, alvo: mira = alvo, tecnica = 'colocado' } = {}) {
    plano = planejar({ forca, contato: { x: contato.x, y: contato.y }, alvo: { x: mira.x, z: mira.z }, tecnica });
    publicar();
    // A comemoração varia com o chute (e é a mesma no replay)
    variacaoGol = Math.abs(Math.round(forca * 97 + esp * contato.x * 31 + contato.y * 17 + esp * mira.x * 7)) % 4;
  }

  // Tipo de lamento para cada resultado
  const TIPO_ERRO = { trave: 'quase', defesa: 'quase', fora: 'longe', cima: 'longe', barreira: 'travou', jogador: 'travou', curta: 'travou' };
  const saida = { etapa: 'parado', progresso: 0, contato: false };

  function atualizar(t, { bola: bolaAgora = null, resultado = null, tFim = 0 } = {}) {
    const p = plano;
    if (t < 0) {
      desenharEspera(relogio + t, t, 'corrida');
      saida.etapa = 'parado';
      saida.progresso = 0;
      saida.contato = false;
      return saida;
    }
    quadro(p, t, F);

    // A espera sai aos poucos no começo da corrida (de onde ela estava quando o jogador soltou o botão)
    const wEspera = 1 - suave(t / 0.26);
    if (wEspera > 0) {
      const b = espera(relogio + t);
      for (const n of CANAIS_CORPO) F.c[n] = misturar(F.c[n], esperaC[n], wEspera);
      const c = Math.cos(psi0);
      const s = Math.sin(psi0);
      F.gx += (b.x * c + b.z * s) * wEspera;
      F.gz += (-b.x * s + b.z * c) * wEspera;
      F.H = p.ch.em(t) + b.h * wEspera;
    }

    // A reação ao resultado entra quando o corpo já parou (ou quase)
    pesoReacao = 0;
    R.mE = null;
    R.mD = null;
    R.olha = 1;
    R.cf = 0;
    R.cg = 0;
    R.dh = 0;
    R.pulo = 0;
    if (resultado) {
      const desde = Math.min(tFim - 0.12, t - (p.tFim - 0.22));
      if (desde > 0) {
        pesoReacao = suave(desde / 0.4);
        for (const n of CANAIS_CORPO) reacaoC[n] = F.c[n];
        for (const n of CANAIS_CORPO) R[n] = undefined;
        if (resultado === 'gol') reacaoGol(variacaoGol, desde, R);
        else reacaoErro(TIPO_ERRO[resultado] || 'travou', desde, R);
        for (const n of CANAIS_CORPO) if (typeof R[n] === 'number') F.c[n] = misturar(F.c[n], R[n], pesoReacao);
        F.H += (R.dh || 0) * pesoReacao;
        F.pulo = Math.max(0, (R.pulo || 0) * pesoReacao) * EY;
        F.H += F.pulo / EY;
      }
    }
    if (wEspera > 0 || pesoReacao > 0) {
      atualizarQuadril(F);
      for (let i = 0; i < 2; i++) alvoDaPerna(p, i, t, F);
      fecharPernas(p, F);
    }

    // Cabeça: olho na bola o tempo todo (parada antes do chute; no voo, a da física)
    if (t >= p.tc && bolaAgora) alvoOlhar.set(esp * bolaAgora.x, bolaAgora.y, bolaAgora.z);
    else if (t >= p.tc) alvoOlhar.set(C.x + p.fx * 14, 1.2, C.z + p.fz * 14);
    else alvoOlhar.set(C.x, raio, C.z);
    if (wEspera > 0) {
      olharDaEspera(relogio + t, _c);
      alvoOlhar.lerp(_c, wEspera);
    }
    const olha = misturar(1, R.olha ?? 1, pesoReacao);
    moverCabeca(F, t, 'corrida', olha, (R.cf || 0) * pesoReacao, (R.cg || 0) * pesoReacao);
    aplicar(F);

    saida.contato = t >= p.tc;
    if (t < p.tChute) {
      saida.etapa = 'corrida';
      saida.progresso = 0;
    } else {
      saida.etapa = t >= p.tFim ? 'fim' : 'chute';
      saida.progresso = t < p.tN ? misturar(0, TEMPO_APOIO, (t - p.tChute) / Math.max(1e-4, p.tN - p.tChute))
        : t < p.tc ? misturar(TEMPO_APOIO, TEMPO_CONTATO, (t - p.tN) / (p.tc - p.tN))
          : Math.min(1, misturar(TEMPO_CONTATO, 1, (t - p.tc) / (p.tFim - p.tc)));
    }
    return saida;
  }
  const reacaoC = novosCanais();

  // ---------- Para fora ----------

  const api = {
    inicio: null,
    tempoContato: 0,
    duracao: 0,
    direcao: new THREE.Vector3(),
    parado,
    preparar,
    atualizar,
    reage: true,
    // Para os testes e a inspeção
    batida: '',
    passos,
    pontoDaBola: null, // onde o pé pega na bola (mundo)
    pontoDoPe: null,   // { junta, ponto: [x, y, z] }: o ponto do pé que bate, no espaço do tornozelo
    pisadas: () => {
      const p = plano;
      const lista = [...p.espera, ...p.pis, p.L1, p.L2];
      return lista.map((q) => ({ pe: ladoReal[q.pe], x: esp * q.x, z: q.z, rotacaoY: esp * q.yaw, pisa: q.tBate, sai: q.tSai }));
    },
    // Números do último quadro desenhado (para os testes): pés no chão e quanto o quadril teve de descer
    medir: () => ({
      pes: { [ladoReal[0]]: F.pernas[0].plantado && F.pernas[0].modo === 'ik', [ladoReal[1]]: F.pernas[1].plantado && F.pernas[1].modo === 'ik' },
      desce: F.desce,
      pulo: F.pulo,
      falta: Math.max(F.pernas[0].falta, F.pernas[1].falta),
      tempos: { chute: plano.tChute, apoio: plano.tN, armada: plano.tb, contato: plano.tc, pouso: plano.tPouso, fim: plano.tFim, saiChute: plano.tSaiK },
    }),
  };
  function publicar() {
    const p = plano;
    api.tempoContato = p.tc;
    api.duracao = p.tFim;
    api.direcao.set(esp * p.fx, 0, p.fz);
    api.batida = p.batida;
    api.pontoDaBola = { x: esp * p.Pc.x, y: p.Pc.y, z: p.Pc.z };
    api.pontoDoPe = { junta: `tornozelo${ladoReal[1]}`, ponto: [esp * p.pePose.ponto.x, p.pePose.ponto.y, p.pePose.ponto.z] };
  }

  // Plano nominal (chute no alvo dado, força média): define o lugar da espera, que não muda mais
  plano = planejar({ forca: 0.7, contato: { x: 0, y: 0 }, alvo: { x: alvo.x, z: alvo.z }, tecnica: 'colocado' });
  publicar();
  api.inicio = { x: esp * S0.x, z: S0.z, rotacaoY: esp * psi0 };
  parado(0);
  return api;
}

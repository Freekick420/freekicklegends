// Cobrança de falta: o cobrador esperando atrás da bola (uma postura por lenda), a corrida, o chute, a
// terminação e as reações depois do lance (comemoração e lamento).
// Usa o boneco de js/jogadores.js: as poses têm o formato descrito lá (personagem.aplicarPose) e as juntas
// ficam em personagem.juntas. Aqui não se cria malha nenhuma: só movimento.
// Eixos do boneco: pés em y = 0, de frente para +z local. A direita do jogador fica em −x local.

import * as THREE from 'three';
import { misturarPoses, espelhar, porChaves, posePadrao, PEITO_DO_PE } from './jogadores.js?v=9';

const GRAUS = Math.PI / 180;
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
const suave = (t) => {
  const u = limitar(t, 0, 1);
  return u * u * (3 - 2 * u);
};


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
// postura: um dos nomes de POSTURAS (o jeito de cada lenda).
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

// Corrida. fase de 0 a 1 = um ciclo (dois passos). Em fase 0,25 a perna direita está toda à frente;
// em 0,75, toda atrás (é dali que sai o chute de destro).
export function poseCorrida(fase = 0) {
  const a = 2 * Math.PI * fase;
  const perna = (f) => ({
    frente: 0.6 * Math.sin(f),
    lado: 0.035,
    joelho: 0.22 + 1.2 * Math.max(0, Math.cos(f + 0.35)) ** 1.5,
    tornozelo: 0.35 * Math.max(0, -Math.sin(f)),
  });
  return {
    tronco: { frente: 0.2, lado: 0, giro: -0.14 * Math.sin(a) },
    cabeca: { frente: -0.12, giro: 0.06 * Math.sin(a) },
    bracoE: { frente: 0.55 * Math.sin(a), lado: 0.2, cotovelo: 1.35 + 0.2 * Math.cos(a) },
    bracoD: { frente: -0.55 * Math.sin(a), lado: 0.2, cotovelo: 1.35 - 0.2 * Math.cos(a) },
    pernaD: perna(a),
    pernaE: perna(a + Math.PI),
    quadril: { giro: 0.08 * Math.sin(a) },
    pulo: 0.04 * Math.max(0, Math.sin(2 * a - 0.5)),
  };
}

// Chute (de destro; o de canhoto é o espelho). progresso de 0 a 1:
//   0 a 0,3   último passo, o pé de apoio (esquerdo) chega ao lado da bola
//   0,3 a 0,5 perna do chute vai para trás (preparação)
//   0,55      contato com a bola (TEMPO_CONTATO)
//   0,55 a 1  terminação: a perna sobe à frente e o corpo cai sobre ela
export const TEMPO_CONTATO = 0.55;
export const TEMPO_APOIO = 0.3; // o pé de apoio pisa no chão e não sai mais do lugar até o fim
const CHAVES_CHUTE = [
  [0, poseCorrida(0.75)],
  [TEMPO_APOIO, {
    tronco: { frente: 0.12, lado: -0.08, giro: 0.08 },
    cabeca: { frente: 0.3 },
    bracoE: { frente: 0.2, lado: 0.65, cotovelo: 0.7 },
    bracoD: { frente: 0.0, lado: 0.3, cotovelo: 0.75 },
    pernaE: { frente: 0.32, lado: 0.04, joelho: 0.18, tornozelo: -0.05 },
    pernaD: { frente: -0.3, lado: 0.04, joelho: 1.15, tornozelo: 0.5 },
    quadril: { giro: -0.08 },
    agachar: 0.05,
  }],
  [0.5, {
    tronco: { frente: 0.02, lado: -0.2, giro: 0.12 },
    cabeca: { frente: 0.42, giro: -0.04 },
    bracoE: { frente: 0.3, lado: 1.25, cotovelo: 0.45 },
    bracoD: { frente: 0.15, lado: 0.32, cotovelo: 0.8 },
    pernaE: { frente: 0.28, lado: 0.05, joelho: 0.3 },
    pernaD: { frente: -0.5, lado: 0.02, joelho: 1.9, tornozelo: 0.7 },
    quadril: { giro: -0.2, lado: -0.04 },
    agachar: 0.05,
  }],
  [TEMPO_CONTATO, {
    tronco: { frente: -0.06, lado: -0.24, giro: 0.02 },
    cabeca: { frente: 0.45 },
    bracoE: { frente: 0.15, lado: 1.35, cotovelo: 0.3 },
    bracoD: { frente: 0.2, lado: 0.36, cotovelo: 0.75 },
    pernaE: { frente: 0.25, lado: 0.05, joelho: 0.22 },
    pernaD: { frente: 0.55, lado: -0.02, joelho: 0.9, tornozelo: 0.95 },
    quadril: { giro: 0.05 },
    agachar: 0.04,
  }],
  [0.75, {
    tronco: { frente: -0.18, lado: -0.14, giro: -0.12 },
    cabeca: { frente: 0.2 },
    bracoE: { frente: -0.05, lado: 1.1, cotovelo: 0.4 },
    bracoD: { frente: -0.1, lado: 0.42, cotovelo: 0.6 },
    pernaE: { frente: -0.04, lado: 0.04, joelho: 0.3, tornozelo: 0.45 },
    pernaD: { frente: 1.25, lado: -0.12, joelho: 0.3, tornozelo: 0.8 },
    quadril: { giro: 0.28 },
    agachar: 0.02,
  }],
  [1, {
    tronco: { frente: 0.08, lado: -0.02, giro: -0.05 },
    cabeca: { frente: -0.12 },
    bracoE: { frente: 0.1, lado: 0.55, cotovelo: 0.6 },
    bracoD: { frente: 0.15, lado: 0.3, cotovelo: 0.7 },
    pernaE: { frente: -0.32, lado: 0.04, joelho: 0.55, tornozelo: 0.4 },
    pernaD: { frente: 0.32, lado: 0.0, joelho: 0.3 },
    quadril: { giro: 0.12 },
    agachar: 0.05,
  }],
];
// braco: 'aberto' abre o braço de equilíbrio (o contrário da perna do chute) durante o chute
export function poseChute(progresso = 0, pe = 'D', braco = 'normal') {
  let p = porChaves(CHAVES_CHUTE, limitar(progresso, 0, 1));
  if (braco === 'aberto' && progresso > 0.2) {
    const k = limitar((progresso - 0.2) / 0.2, 0, 1);
    const b = p.bracoE;
    p = { ...p, bracoE: { frente: b.frente - 0.15 * k, lado: Math.min(1.5, b.lado + 0.5 * k), cotovelo: b.cotovelo * (1 - 0.6 * k) } };
  }
  return pe === 'E' ? espelhar(p) : p;
}

// Comemoração de gol: pula com os braços para cima e o punho fechado. t em segundos desde o gol.
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

// Lamento (bola fora ou defendida): mãos na cabeça, olhando para baixo, balançando a cabeça
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

// ---------- Cobrança: corrida, chute e o pé na bola ----------

export const PADRAO_COBRANCA = {
  distancia: 2.0,  // m da posição inicial até onde o pé de apoio pisa
  angulo: 30,      // graus entre a corrida e a direção do chute (destro vem pela esquerda da bola)
  corrida: 0.4,    // s correndo antes do último passo
  chute: 0.75,     // s do último passo até o fim da terminação (contato em 0,55 disso)
  cadencia: 1.6,   // ciclos de corrida por segundo (cada ciclo = dois passos)
  postura: 'normal', // jeito de esperar atrás da bola (POSTURAS em poseCobradorPronto)
  braco: 'normal',   // 'aberto': braço de equilíbrio aberto no chute
  giroCorpo: 0.45,   // no contato, quanto do ângulo da corrida o corpo ainda guarda (0 = de frente para o gol; 1 = na linha da corrida)
};

// Onde fica o peito do pé e o pé de apoio (no espaço do grupo) num momento do chute
function pesDoChute(personagem, progresso, pe) {
  personagem.aplicarPose(poseChute(progresso, pe));
  const outro = pe === 'D' ? 'E' : 'D';
  const j = personagem.juntas;
  return {
    chute: personagem.pontoNoGrupo(j[`tornozelo${pe}`], ...PEITO_DO_PE),
    apoio: personagem.pontoNoGrupo(j[`tornozelo${outro}`], 0, -0.07, 0.06),
  };
}

// Onde fica o centro da bola (no espaço do grupo, de frente para +z) no instante do contato
export function bolaNoContato(personagem, pe = 'D', raioBola = 0.11) {
  const { chute } = pesDoChute(personagem, TEMPO_CONTATO, pe);
  return new THREE.Vector3(chute.x, raioBola, chute.z + raioBola + 0.02);
}

// Monta a animação da cobrança. bola: {x, z}; alvo: {x, z} para onde o corpo fica virado no chute
// (padrão: meio do gol); pe: 'D' ou 'E'; cfg: o CONFIG do jogo (lê cfg.cobrador, se existir). Devolve:
//   inicio: { x, z, rotacaoY }  onde o cobrador espera (parado(t) já o põe lá)
//   tempoContato: s do começo da corrida até o pé tocar a bola (lance a bola nessa hora)
//   duracao: s até o fim da terminação
//   parado(t): pose de espera atrás da bola (t = relógio, para respirar)
//   atualizar(t): t = s desde o começo da corrida; põe o grupo e a pose. Devolve
//                 { etapa: 'parado' | 'corrida' | 'chute' | 'fim', progresso, contato } (contato: já passou do toque)
//   direcao: vetor {x, y, z} para onde o corpo fica virado no chute
export function criarCobranca(personagem, { bola, alvo = { x: 0, z: 0 }, pe = 'D', cfg = {} } = {}) {
  const c = { ...PADRAO_COBRANCA, ...(cfg.cobrador || {}) };
  const g = personagem.grupo;
  const lado = pe === 'D' ? 1 : -1; // destro vem pela esquerda (+x local)
  const yawChute = Math.atan2(alvo.x - bola.x, alvo.z - bola.z);
  const frente = new THREE.Vector3(Math.sin(yawChute), 0, Math.cos(yawChute));
  // No contato o corpo não fica de frente para o gol: guarda parte do ângulo da corrida, e o pé pega a
  // bola meio de lado (chute com a parte de dentro do pé, como nos jogos de PS2). A bola vai para yawChute
  // do mesmo jeito; a geometria do pé de apoio é feita com o corpo nesse ângulo, então o pé chega na bola.
  const yawContato = yawChute - lado * c.angulo * GRAUS * limitar(c.giroCorpo ?? 0, 0, 1);
  const girar = (p, yaw) => new THREE.Vector3(
    p.x * Math.cos(yaw) + p.z * Math.sin(yaw), p.y, -p.x * Math.sin(yaw) + p.z * Math.cos(yaw));

  // Pé de apoio: onde precisa pisar para o peito do pé chegar na bola no contato
  const noContato = pesDoChute(personagem, TEMPO_CONTATO, pe);
  const raioBola = cfg.raioBola ?? 0.11;
  const bolaLocal = new THREE.Vector3(noContato.chute.x, 0, noContato.chute.z + raioBola + 0.02);
  const apoioMundo = new THREE.Vector3(bola.x, 0, bola.z).add(girar(noContato.apoio.clone().sub(bolaLocal), yawContato));
  apoioMundo.y = 0;
  const apoioNoPiso = pesDoChute(personagem, TEMPO_APOIO, pe).apoio;
  const grupoNoApoio = apoioMundo.clone().sub(girar(apoioNoPiso, yawContato));
  grupoNoApoio.y = 0;

  // Corrida em linha reta, chegando de trás e do lado do pé de apoio
  const yawCorrida = yawChute - lado * c.angulo * GRAUS;
  const dirCorrida = new THREE.Vector3(Math.sin(yawCorrida), 0, Math.cos(yawCorrida));
  const inicio = grupoNoApoio.clone().addScaledVector(dirCorrida, -c.distancia);
  const tApoio = c.corrida + TEMPO_APOIO * c.chute;
  const tempoContato = c.corrida + TEMPO_CONTATO * c.chute;
  const duracao = c.corrida + c.chute;
  // A fase da corrida termina com a perna do chute toda atrás (encaixa no começo do chute)
  const faseFinal = pe === 'D' ? 0.75 : 0.25;
  const fase0 = faseFinal - c.cadencia * c.corrida;
  // Distância andada até o pé de apoio pisar: acelera no primeiro quarto e depois vai reto
  const ARRANQUE = 0.25;
  const andado = (t) => {
    const u = limitar(t / tApoio, 0, 1);
    const h = u < ARRANQUE ? (u * u) / (2 * ARRANQUE) : u - ARRANQUE / 2;
    return (c.distancia * h) / (1 - ARRANQUE / 2);
  };
  const noCaminho = (t) => inicio.clone().addScaledVector(dirCorrida, andado(t));

  function parado(t = 0) {
    g.position.set(inicio.x, 0, inicio.z);
    g.rotation.set(0, yawCorrida, 0);
    personagem.aplicarPose(poseCobradorPronto(t, pe, c.postura));
  }

  function atualizar(t) {
    if (t < 0) {
      parado(-t);
      return { etapa: 'parado', progresso: 0, contato: false };
    }
    if (t < c.corrida) {
      // Corrida: sai da pose de espera nos primeiros passos
      const pose = misturarPoses(poseCobradorPronto(0, pe, c.postura), poseCorrida(fase0 + c.cadencia * t), suave(t / 0.15));
      personagem.aplicarPose(pose);
      const pos = noCaminho(t);
      g.position.set(pos.x, 0, pos.z);
      g.rotation.set(0, yawCorrida, 0);
      return { etapa: 'corrida', progresso: 0, contato: false };
    }
    const p = limitar((t - c.corrida) / c.chute, 0, 1);
    personagem.aplicarPose(poseChute(p, pe, c.braco));
    if (p < TEMPO_APOIO) {
      // Último passo: continua na linha da corrida e vira o corpo para a direção do chute
      const yaw = yawCorrida + (yawContato - yawCorrida) * suave(p / TEMPO_APOIO);
      const pos = noCaminho(t);
      g.position.set(pos.x, 0, pos.z);
      g.rotation.set(0, yaw, 0);
    } else {
      // Pé de apoio preso no chão: o corpo gira por cima dele (sem escorregar)
      const outro = pe === 'D' ? 'E' : 'D';
      const apoio = personagem.pontoNoGrupo(personagem.juntas[`tornozelo${outro}`], 0, -0.07, 0.06);
      const pos = apoioMundo.clone().sub(girar(apoio, yawContato));
      g.position.set(pos.x, 0, pos.z);
      g.rotation.set(0, yawContato, 0);
    }
    return { etapa: p >= 1 ? 'fim' : 'chute', progresso: p, contato: p >= TEMPO_CONTATO };
  }

  parado(0);
  return {
    inicio: { x: inicio.x, z: inicio.z, rotacaoY: yawCorrida },
    tempoContato,
    duracao,
    direcao: frente,
    parado,
    atualizar,
  };
}

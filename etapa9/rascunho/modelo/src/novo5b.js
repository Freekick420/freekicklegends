// ---------- Ajudantes para a cena ----------

// Aparências genéricas para os adversários e figurantes: variadas (com a barreira e os outros jogadores em
// campo aparecem uns 15 por lance), mas sem lembrar ninguém. A textura deles é a pequena: são vistos de longe.
const GENERICOS = [
  { pele: '#e6b892', cabelo: { estilo: 'curto', cor: '#2b1d14', corte: 'lado' }, barba: 'nenhuma', chuteira: '#111111', porte: 'normal' },
  { pele: '#86522f', cabelo: { estilo: 'raspado', cor: '#151010' }, barba: 'rala', corBarba: '#151010', chuteira: '#f5f5f5', porte: 'forte' },
  { pele: '#f1cfb0', cabelo: { estilo: 'curto', cor: '#b8894e', corte: 'frente' }, barba: 'nenhuma', chuteira: '#1e5bd8', porte: 'normal' },
  { pele: '#c68e62', cabelo: { estilo: 'curto', cor: '#1c1410', corte: 'arrepiado' }, barba: 'cavanhaque', corBarba: '#1c1410', chuteira: '#111111', porte: 'normal' },
  { pele: '#6b4026', cabelo: { estilo: 'careca', cor: '#111111' }, barba: 'cheia', corBarba: '#151010', chuteira: '#e8e8e8', porte: 'forte' },
  { pele: '#efc6a2', cabelo: { estilo: 'topete', cor: '#6b4a2b' }, barba: 'rala', corBarba: '#5a3c22', chuteira: '#111111', porte: 'normal' },
  { pele: '#d9a57a', cabelo: { estilo: 'cacheado', cor: '#24170f', comprimento: 'curto' }, barba: 'nenhuma', chuteira: '#ff6a00', porte: 'magro' },
  { pele: '#f3d2b5', cabelo: { estilo: 'raspado', cor: '#a8643a' }, barba: 'rala', corBarba: '#a8643a', chuteira: '#111111', porte: 'normal' },
  { pele: '#b57d52', cabelo: { estilo: 'curto', cor: '#17110d', corte: 'frente' }, barba: 'rala', corBarba: '#17110d', chuteira: '#d7263d', porte: 'normal' },
  { pele: '#f0c3a0', cabelo: { estilo: 'medio', cor: '#4a3020', corte: 'repartido' }, barba: 'nenhuma', chuteira: '#f5f5f5', porte: 'magro' },
  { pele: '#5c3820', cabelo: { estilo: 'curto', cor: '#120e0c', corte: 'arrepiado' }, barba: 'nenhuma', chuteira: '#2ecc71', porte: 'normal' },
  { pele: '#e2b48a', cabelo: { estilo: 'careca', cor: '#2a1d14' }, barba: 'cavanhaque', corBarba: '#3a2a1f', chuteira: '#111111', porte: 'forte' },
  { pele: '#d4a072', cabelo: { estilo: 'topete', cor: '#1a1410' }, barba: 'nenhuma', chuteira: '#f7d84a', porte: 'normal' },
  { pele: '#f2c9a5', cabelo: { estilo: 'curto', cor: '#8a5a32', corte: 'lado' }, barba: 'cheia', corBarba: '#7a4a28', chuteira: '#111111', porte: 'forte' },
  { pele: '#7a4a2c', cabelo: { estilo: 'cacheado', cor: '#151010', comprimento: 'curto' }, barba: 'rala', corBarba: '#151010', chuteira: '#f5f5f5', porte: 'normal' },
  { pele: '#efc6a2', cabelo: { estilo: 'raspado', cor: '#3a2a20' }, barba: 'nenhuma', chuteira: '#1e5bd8', porte: 'normal' },
  { pele: '#c68e62', cabelo: { estilo: 'medio', cor: '#1c1410', corte: 'franja' }, barba: 'nenhuma', chuteira: '#111111', porte: 'magro' },
  { pele: '#f1cfb0', cabelo: { estilo: 'curto', cor: '#d9b45a', corte: 'arrepiado' }, barba: 'rala', corBarba: '#b8894e', chuteira: '#ff6a00', porte: 'normal' },
  { pele: '#86522f', cabelo: { estilo: 'curto', cor: '#151010', corte: 'frente' }, barba: 'cavanhaque', corBarba: '#151010', chuteira: '#111111', porte: 'normal' },
  { pele: '#e6b892', cabelo: { estilo: 'longo', cor: '#3a2a1f', preso: true }, barba: 'rala', corBarba: '#3a2a1f', chuteira: '#e8e8e8', porte: 'normal' },
  { pele: '#d9a57a', cabelo: { estilo: 'raspado', cor: '#1c1410' }, barba: 'cheia', corBarba: '#1c1410', chuteira: '#d7263d', porte: 'forte' },
  { pele: '#f3d2b5', cabelo: { estilo: 'topete', cor: '#c98a4b' }, barba: 'nenhuma', chuteira: '#111111', porte: 'magro' },
  { pele: '#6b4026', cabelo: { estilo: 'raspado', cor: '#111111' }, barba: 'nenhuma', chuteira: '#f7d84a', porte: 'normal' },
  { pele: '#b57d52', cabelo: { estilo: 'curto', cor: '#2b1d14', corte: 'lado' }, barba: 'bigode', corBarba: '#2b1d14', chuteira: '#f5f5f5', porte: 'normal' },
];
export function visualAdversario(indice = 0, altura = 1.84) {
  const n = GENERICOS.length;
  const r = GENERICOS[((Math.floor(indice) % n) + n) % n];
  return { ...r, cabelo: { ...r.cabelo }, faixa: null, altura, coxas: 'normais', textura: 'baixa' };
}
export const VISUAL_GOLEIRO_ADVERSARIO = {
  pele: '#e2b48a', cabelo: { estilo: 'raspado', cor: '#2a1d14' }, barba: 'rala', corBarba: '#2a1d14',
  faixa: null, altura: 1.9, porte: 'forte', coxas: 'normais', chuteira: '#111111', goleiro: true,
};


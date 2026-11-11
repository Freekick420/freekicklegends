
// Quantos recursos estão em cache (para conferir que dispose() não deixa sobras). "camisas" são os atlas de
// uniforme (um por time) e "rostos" os atlas de aparência (um por jogador); "corpos" são as malhas de pele.
export function estatisticasCache() {
  const u = cacheUniformes.numeros();
  const a = cacheAparencias[512].numeros();
  const b = cacheAparencias[256].numeros();
  const c = cacheCorpos.numeros();
  return {
    geometrias: cacheGeo.size + c.total, materiais: a.total + b.total, texturas: cacheTex.size + u.total + a.total + b.total,
    camisas: u.total, camisasEmUso: u.emUso, camisasGuardadas: u.guardados,
    rostos: a.total + b.total, rostosEmUso: a.emUso + b.emUso, rostosGuardados: a.guardados + b.guardados,
    corpos: c.total, corposEmUso: c.emUso, corposGuardados: c.guardados,
  };
}


const THREE = 'file:///tmp/claude-0/-home-user/92f63482-318d-57a2-ba81-43ab7e6086d3/scratchpad/harness/vendor/three-0.160.0/package/build/three.module.js';
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') return { url: THREE, shortCircuit: true };
  return nextResolve(specifier, context);
}

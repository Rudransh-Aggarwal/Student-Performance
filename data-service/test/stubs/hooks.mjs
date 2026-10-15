// Redirects the modules that touch Firebase, MongoDB or auth-service to in-memory stubs.
const STUBBED_SUFFIXES = [
  '/src/config/firebase.js',
  '/src/services/users.js',
  '/src/services/moduleAssignment.js',
  '/src/services/modules.js',
  '/src/services/students.js',
];

const STUB_URL = new URL('./index.js', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  if (STUBBED_SUFFIXES.some((suffix) => result.url.endsWith(suffix))) {
    return { ...result, url: STUB_URL, shortCircuit: true };
  }
  return result;
}
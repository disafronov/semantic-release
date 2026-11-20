import { createRequire } from 'node:module';
import semanticRelease from 'semantic-release';

const require = createRequire(import.meta.url);

// The caller selects this path only when the repository has no release config.
export default function runFallback(options = {}, runtime = {}) {
  return semanticRelease({ ...require('./fallback-config.cjs'), ...options }, runtime);
}

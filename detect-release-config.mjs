import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Use the same search locations as the semantic-release version in this image.
// Detection must not execute JavaScript configuration or load plugins.
const require = createRequire(import.meta.url);
const releaseRequire = createRequire(require.resolve('semantic-release'));
const { getDefaultSearchPlaces } = releaseRequire('cosmiconfig/dist/defaults.js');

export function detectReleaseConfig(cwd) {
  for (const name of getDefaultSearchPlaces('release')) {
    if (name === 'package.json') {
      const manifest = join(cwd, name);
      if (!existsSync(manifest)) continue;
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      if (pkg?.release != null) return { kind: 'project', path: name };
      continue;
    }
    const path = join(cwd, name);
    if (existsSync(path) && statSync(path).isFile()) {
      return { kind: 'project', path: name };
    }
  }
  return { kind: 'fallback' };
}

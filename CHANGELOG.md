## [5.2.0-rc.1](https://github.com/disafronov/semantic-release/compare/v5.1.1...v5.2.0-rc.1) (2026-11-20)

### Features

* exercise real local release preparation and capture resulting diff ([c55cdd4](https://github.com/disafronov/semantic-release/commit/c55cdd4b52b4e57a88d255f4200f0edf789e306e))

### Bug Fixes

* accept diff output path through runner environment ([bf97412](https://github.com/disafronov/semantic-release/commit/bf97412ea3865686a9670e52f5b433fa70b163a6))
* avoid duplicate NODE_PATH declaration in image ([c272da3](https://github.com/disafronov/semantic-release/commit/c272da39294211bb3bf982649476123c2b207be3))
* create synchronous CLI release policy for validation ([a55e6d1](https://github.com/disafronov/semantic-release/commit/a55e6d1ab41a0485543a6eee4c42d9a980fc9990))
* execute validation through the actual production release API ([97da8bd](https://github.com/disafronov/semantic-release/commit/97da8bd321fee8b71b35cf6bee20c11ce1f5bd19))
* honor project-specific release plugin overrides during validation ([faf1d0c](https://github.com/disafronov/semantic-release/commit/faf1d0c911c3070ae0f48e66bf068eb305e49de3))
* invoke the fallback CLI adapter while keeping release runtime minimal ([f13a89f](https://github.com/disafronov/semantic-release/commit/f13a89f67b9f5ce4c5597a12386b6a8a50c682a2))
* invoke the fallback CLI adapter while keeping release runtime minimal ([0a52db7](https://github.com/disafronov/semantic-release/commit/0a52db77ba969b25d7afcaba3b78b3e54d04a9bc))
* invoke the fallback CLI adapter while keeping release runtime minimal ([1786e71](https://github.com/disafronov/semantic-release/commit/1786e7129d8fb76e80b4c2e161330a20c2083dda))
* invoke the fallback CLI adapter while keeping release runtime minimal ([d17f625](https://github.com/disafronov/semantic-release/commit/d17f62544dabed5d3635e72c013d1049b778538d))
* keep CLI argument compatibility outside the fallback runner ([371eb6b](https://github.com/disafronov/semantic-release/commit/371eb6b67646d69949374aa347cd916e9bfd257c))
* keep validation policy filtering in the validator only ([a8b81d9](https://github.com/disafronov/semantic-release/commit/a8b81d943e35c361e6ce744488cad84555be947a))
* log fallback policy selection during validation ([8314bb9](https://github.com/disafronov/semantic-release/commit/8314bb9a75f3a55fb957e9b2dc88071c46d5439e))
* point isolated bare remote HEAD at target release branch ([1fb8b24](https://github.com/disafronov/semantic-release/commit/1fb8b24810999d87f162f203f1feabbeec136534))
* preserve config-file detection when delegating to upstream CLI ([b354eea](https://github.com/disafronov/semantic-release/commit/b354eeaedbe10158249ba1f46dbab9abd7c82657))
* report actual created tags and propagate upstream CLI exit code ([a9826cb](https://github.com/disafronov/semantic-release/commit/a9826cbd4dc25d2ba42ec1e5b57e85b0577cf14b))
* report only active plugins during release validation ([662f152](https://github.com/disafronov/semantic-release/commit/662f152503e3acc81ab6dd5dd9136c511be4883b))
* restore Docker workflow from semantic-docker-template ([f65efd8](https://github.com/disafronov/semantic-release/commit/f65efd8220a3bac34c5f2a859ad7773b976ad73c))
* validate PRs with their own checked-out container image ([d89440e](https://github.com/disafronov/semantic-release/commit/d89440ee9dd28461ed7d70ba897f5b80cf4b3329))
* validate releases through upstream core in isolated Git sandbox ([6126d6e](https://github.com/disafronov/semantic-release/commit/6126d6e4b601f15e47e176cc4bf134122b4eaffa))

### Reverts

* leave Semantic workflow unchanged ([be36ccc](https://github.com/disafronov/semantic-release/commit/be36ccc8380feba29e7721496b00c0d5a7f4bbae))

### Code Refactoring

* centralize release configuration loading in fallback runner ([40e0c21](https://github.com/disafronov/semantic-release/commit/40e0c21fd63544ec80d41eedf517470b6cce2ffa))
* consolidate release invocation and validation in fallback runner ([f0052f6](https://github.com/disafronov/semantic-release/commit/f0052f6a2bf91555232625656a2e8fd3e5b919a1))
* consolidate release invocation and validation in fallback runner ([be2b104](https://github.com/disafronov/semantic-release/commit/be2b104e34334b8a1e79205c4c618f5e8990f951))
* keep fallback runner focused on its production invocation ([4d1fe7c](https://github.com/disafronov/semantic-release/commit/4d1fe7c2f05c03a5f2eb1930803d39c5e95b6347))
* keep validation overrides entirely in validator ([8628949](https://github.com/disafronov/semantic-release/commit/8628949d001dd2bf9baf836bb7613ff3c897cb77))
* make fallback runner a minimal config adapter ([5c8a599](https://github.com/disafronov/semantic-release/commit/5c8a59965eaccfb44876373e0c0c0a97fcb5c9fc))
* make fallback runner the single release invocation point ([f12b4db](https://github.com/disafronov/semantic-release/commit/f12b4db662860bf114da59135a52d95f3cc94e31))
* make Node runner the sole entrypoint and preserve upstream CLI arguments ([58bffa4](https://github.com/disafronov/semantic-release/commit/58bffa48914604ba3beb058174857dffd59536e5))
* name fallback policy consistently and harden release filesystem ([13546b4](https://github.com/disafronov/semantic-release/commit/13546b4c6f2a384b278ae39728045105ec61cb98))
* remove retired release entrypoints from packaging ([77dd077](https://github.com/disafronov/semantic-release/commit/77dd0777e5c4c8162aea4493dee0db5f2741ede2))
* remove retired release entrypoints from packaging ([4876823](https://github.com/disafronov/semantic-release/commit/4876823fa6ebe960df82e11fc0ad030d2263236a))
* remove retired release entrypoints from packaging ([7259ce0](https://github.com/disafronov/semantic-release/commit/7259ce0a9107086eb4a04133de47d96dad08e092))
* route validation exclusively through shared release runner ([e914373](https://github.com/disafronov/semantic-release/commit/e914373b6c0f2756c2e399754565b99b24d359ec))
* run Node release entrypoint directly from Docker ([c5c68b0](https://github.com/disafronov/semantic-release/commit/c5c68b008fec036ea38d9604b527d9fb72be2370))
* run release worker directly as Docker entrypoint ([42563dc](https://github.com/disafronov/semantic-release/commit/42563dcac874e52aad3d8185e5af330b19548789))
* share actual fallback release invocation with validation ([d3786bb](https://github.com/disafronov/semantic-release/commit/d3786bba2d6e834b4e7026a7550c1cfea1a4f964))
* use fallback runner as the sole release entrypoint ([abea897](https://github.com/disafronov/semantic-release/commit/abea897399ead6ab008d4703b8a6ce027593784a))
* use upstream semantic-release CLI from a single release entrypoint ([1fa25cd](https://github.com/disafronov/semantic-release/commit/1fa25cd926638c89428301a368feaac9992410df))
* validator delegates policy loading and invocation to fallback runner ([2fa1ddd](https://github.com/disafronov/semantic-release/commit/2fa1ddd58b50da7f044af6496b55665e788fd210))

## [5.2.0-rc.1](https://github.com/disafronov/semantic-release/compare/v5.1.1...v5.2.0-rc.1) (2026-11-20)

### Features

* exercise real local release preparation and capture resulting diff ([c55cdd4](https://github.com/disafronov/semantic-release/commit/c55cdd4b52b4e57a88d255f4200f0edf789e306e))

### Bug Fixes

* accept diff output path through runner environment ([bf97412](https://github.com/disafronov/semantic-release/commit/bf97412ea3865686a9670e52f5b433fa70b163a6))
* execute validation through the actual production release API ([97da8bd](https://github.com/disafronov/semantic-release/commit/97da8bd321fee8b71b35cf6bee20c11ce1f5bd19))
* honor project-specific release plugin overrides during validation ([faf1d0c](https://github.com/disafronov/semantic-release/commit/faf1d0c911c3070ae0f48e66bf068eb305e49de3))
* point isolated bare remote HEAD at target release branch ([1fb8b24](https://github.com/disafronov/semantic-release/commit/1fb8b24810999d87f162f203f1feabbeec136534))
* report only active plugins during release validation ([662f152](https://github.com/disafronov/semantic-release/commit/662f152503e3acc81ab6dd5dd9136c511be4883b))
* restore Docker workflow from semantic-docker-template ([f65efd8](https://github.com/disafronov/semantic-release/commit/f65efd8220a3bac34c5f2a859ad7773b976ad73c))
* validate releases through upstream core in isolated Git sandbox ([6126d6e](https://github.com/disafronov/semantic-release/commit/6126d6e4b601f15e47e176cc4bf134122b4eaffa))

### Code Refactoring

* keep fallback runner focused on its production invocation ([4d1fe7c](https://github.com/disafronov/semantic-release/commit/4d1fe7c2f05c03a5f2eb1930803d39c5e95b6347))
* keep validation overrides entirely in validator ([8628949](https://github.com/disafronov/semantic-release/commit/8628949d001dd2bf9baf836bb7613ff3c897cb77))
* make fallback runner the single release invocation point ([f12b4db](https://github.com/disafronov/semantic-release/commit/f12b4db662860bf114da59135a52d95f3cc94e31))
* name fallback policy consistently and harden release filesystem ([13546b4](https://github.com/disafronov/semantic-release/commit/13546b4c6f2a384b278ae39728045105ec61cb98))
* route validation exclusively through shared release runner ([e914373](https://github.com/disafronov/semantic-release/commit/e914373b6c0f2756c2e399754565b99b24d359ec))
* share actual fallback release invocation with validation ([d3786bb](https://github.com/disafronov/semantic-release/commit/d3786bba2d6e834b4e7026a7550c1cfea1a4f964))

## [5.1.1](https://github.com/disafronov/semantic-release/compare/v5.1.0...v5.1.1) (2026-11-20)

### Bug Fixes

* validate pull requests using the release policy verifier ([b7888ff](https://github.com/disafronov/semantic-release/commit/b7888ff782258af9668126eb322492db09d5bb42))

## [5.1.0](https://github.com/disafronov/semantic-release/compare/v5.0.0...v5.1.0) (2026-11-20)

### Features

* add read-only PR release validation mode ([69a7caf](https://github.com/disafronov/semantic-release/commit/69a7caf348e8f607283fc3f801aca02cbf7d600e))

## [5.0.0](https://github.com/disafronov/semantic-release/compare/v4.0.2...v5.0.0) (2026-11-20)

### ⚠ BREAKING CHANGES

* The image upgrades semantic-release from 25 to 26, whose minimum supported Node.js version is 26.13. Existing consumers using the bundled runtime must use a compatible image.

### Bug Fixes

* apply bundled release policy as runtime options in semantic-release 26 ([9ffaf57](https://github.com/disafronov/semantic-release/commit/9ffaf57d2034d8e6f17f350c7f7845c4d29709ad))
* include SSH client for Git remote operations ([a416d1a](https://github.com/disafronov/semantic-release/commit/a416d1ad3105cc584f6b88392588aab9aea46582))
* invoke bundled configuration as runtime policy for fallback ([694238d](https://github.com/disafronov/semantic-release/commit/694238d2014568c9dc29c0cd620e0f0afd3d6b55))
* redact secret-bearing errors in the fallback runner ([49e8133](https://github.com/disafronov/semantic-release/commit/49e813388d4e5dafb15cd759c5be157940adcd1c))

### Code Refactoring

* audit ([840c889](https://github.com/disafronov/semantic-release/commit/840c88911c829bab826a7c28105648f2fae7895d))
* rename fallback release script to runner ([0d7bb65](https://github.com/disafronov/semantic-release/commit/0d7bb65ef213c7d1e7c4ad856c81ef42a79214c9))
* require Node.js 26.13 for semantic-release 26 ([81f0be2](https://github.com/disafronov/semantic-release/commit/81f0be26bb08929c43c83d328eece3d41c0614ee))

## [5.0.0-rc.4](https://github.com/disafronov/semantic-release/compare/v5.0.0-rc.3...v5.0.0-rc.4) (2026-11-20)

### Code Refactoring

* rename fallback release script to runner ([f0a4e3e](https://github.com/disafronov/semantic-release/commit/f0a4e3e243a7c73827799865e4a8e7256a834b97))

## [5.0.0-rc.3](https://github.com/disafronov/semantic-release/compare/v5.0.0-rc.2...v5.0.0-rc.3) (2026-11-20)

### Bug Fixes

* apply bundled release policy as runtime options in semantic-release 26 ([6f177f7](https://github.com/disafronov/semantic-release/commit/6f177f7fa8ba3c5fee4c303ca556d76d24bbbd7e))
* invoke bundled configuration as runtime policy for fallback ([3c91e6e](https://github.com/disafronov/semantic-release/commit/3c91e6e06f833a3dff62cec94949a55a6c8c0e5d))
* redact secret-bearing errors in the fallback runner ([a26d98c](https://github.com/disafronov/semantic-release/commit/a26d98c6f3add68dd6c1879db6e46983e059568e))

## [5.0.0-rc.2](https://github.com/disafronov/semantic-release/compare/v5.0.0-rc.1...v5.0.0-rc.2) (2026-11-20)

### Bug Fixes

* include SSH client for Git remote operations ([6df914b](https://github.com/disafronov/semantic-release/commit/6df914b69631b2a7d338de3fd1705f5980e16596))

## [5.0.0-rc.1](https://github.com/disafronov/semantic-release/compare/v4.0.3-rc.1...v5.0.0-rc.1) (2026-11-20)

### ⚠ BREAKING CHANGES

* The image upgrades semantic-release from 25 to 26, whose minimum supported Node.js version is 26.13. Existing consumers using the bundled runtime must use a compatible image.

### Code Refactoring

* require Node.js 26.13 for semantic-release 26 ([5b57a92](https://github.com/disafronov/semantic-release/commit/5b57a924f12818c6f0accb2de30568547536da39))

## [4.0.3-rc.1](https://github.com/disafronov/semantic-release/compare/v4.0.2...v4.0.3-rc.1) (2026-11-20)

### Code Refactoring

* audit ([243e8ae](https://github.com/disafronov/semantic-release/commit/243e8ae620bf6e4f07caf90bb8cd7d30319b7568))

## [4.0.2](https://github.com/disafronov/semantic-release/compare/v4.0.1...v4.0.2) (2026-11-18)

### Code Refactoring

* deps ([59b81ae](https://github.com/disafronov/semantic-release/commit/59b81ae58ee9f7b097185873ca758620835d803b))

## [4.0.1](https://github.com/disafronov/semantic-release/compare/v4.0.0...v4.0.1) (2026-11-16)

### Code Refactoring

* deps ([567774d](https://github.com/disafronov/semantic-release/commit/567774d91b8488d95ddeb94f3a631b4f89656bee))

## [4.0.0](https://github.com/disafronov/semantic-release/compare/v3.0.2...v4.0.0) (2026-11-03)

### ⚠ BREAKING CHANGES

* The semantic workflow no longer automatically rebases open pull requests after a release. Consumers relying on automatic branch updates must manage them explicitly.

Signed-off-by: [secure] <[secure]>

### Code Refactoring

* remove automatic post-release rebasing ([02aad5f](https://github.com/disafronov/semantic-release/commit/02aad5f2d073cca69aa6239568943ed5557e444b))

## [3.0.2](https://github.com/disafronov/semantic-release/compare/v3.0.1...v3.0.2) (2026-11-03)

### Code Refactoring

* deps ([da1ffd1](https://github.com/disafronov/semantic-release/commit/da1ffd1bad7ae6419818f8fa12d21b1d8f267192))

## [3.0.1](https://github.com/disafronov/semantic-release/compare/v3.0.0...v3.0.1) (2026-11-02)

### Code Refactoring

* rename hasPython to hasUv ([35283aa](https://github.com/disafronov/semantic-release/commit/35283aa609b068ce1884e139e65f3b8d6c62c454))

## [3.0.0](https://github.com/disafronov/semantic-release/compare/v2.0.19...v3.0.0) (2026-11-02)

### ⚠ BREAKING CHANGES

* Repositories using the legacy release branch must migrate
to main as the stable release branch before adopting this workflow.

Signed-off-by: Dmitrii Safronov <dhameoelin@gmail.com>

### Features

* **ci:** allow selecting semantic-release image tag via repository variable ([c5c0157](https://github.com/disafronov/semantic-release/commit/c5c0157f086e3b149c3d8f7750f4f4589a382a6c))
* prepare automatic Python and npm package versioning ([902fc7d](https://github.com/disafronov/semantic-release/commit/902fc7d126f0f542696d67b2a3e5aaabdfbef684))
* prepare automatic Python and npm package versioning ([93cbb76](https://github.com/disafronov/semantic-release/commit/93cbb76afb2ff03baef029b7e5ad7f62e2407ce6))
* prepare automatic Python and npm package versioning ([69f5382](https://github.com/disafronov/semantic-release/commit/69f5382006c8f9818262e0c4880d7fa1071c7ab7))
* prepare automatic Python and npm package versioning ([1bf085f](https://github.com/disafronov/semantic-release/commit/1bf085f9af3bfc454899df2ee24b06575cf0fc1b))
* prepare automatic Python and npm package versioning ([94a425a](https://github.com/disafronov/semantic-release/commit/94a425a5c49cb7d8cd5621b8b90bf68665644d32))
* prepare automatic Python and npm package versioning ([5705428](https://github.com/disafronov/semantic-release/commit/5705428a39a45730c82c92733b4a580260d5a58a))
* remove legacy release branch support ([b8b42e5](https://github.com/disafronov/semantic-release/commit/b8b42e5eef2fe7fb4b80538faad1d7b0eb460a21))

### Bug Fixes

* audit ([7571cce](https://github.com/disafronov/semantic-release/commit/7571cce7be6a712a870c373f5eeebd2decde23df))
* **ci:** validate rc pull requests ([66dcdda](https://github.com/disafronov/semantic-release/commit/66dcdda747d3d267c001df93902679e27d1dc097))
* **ci:** validate rc pull requests ([2bea985](https://github.com/disafronov/semantic-release/commit/2bea98537f75d0bf0d36e21dc7a50b1bc86d27e9))
* use writable uv cache for non-root release jobs ([4818bfe](https://github.com/disafronov/semantic-release/commit/4818bfed988948c929147709169029d4ac1a5beb))
* use writable uv Python installation directory for non-root releases ([ed05575](https://github.com/disafronov/semantic-release/commit/ed055756ec0367567c1de80a84a620a9a1a706f6))

## [3.0.0-rc.3](https://github.com/disafronov/semantic-release/compare/v3.0.0-rc.2...v3.0.0-rc.3) (2026-11-02)

### Bug Fixes

* use writable uv Python installation directory for non-root releases ([8a6241e](https://github.com/disafronov/semantic-release/commit/8a6241e34948994f1f341b75072dfb13457854b3))

## [3.0.0-rc.2](https://github.com/disafronov/semantic-release/compare/v3.0.0-rc.1...v3.0.0-rc.2) (2026-11-02)

### Bug Fixes

* use writable uv cache for non-root release jobs ([54335d9](https://github.com/disafronov/semantic-release/commit/54335d90e4faadf8b83bcf32ef6c4fd2e9d846af))

## [3.0.0-rc.1](https://github.com/disafronov/semantic-release/compare/v2.1.0-rc.1...v3.0.0-rc.1) (2026-11-02)

### ⚠ BREAKING CHANGES

* Repositories using the legacy release branch must migrate
to main as the stable release branch before adopting this workflow.

Signed-off-by: Dmitrii Safronov <dhameoelin@gmail.com>

### Features

* remove legacy release branch support ([9e1bc2f](https://github.com/disafronov/semantic-release/commit/9e1bc2f003e8b13d4e328f0298f78c962c20592b))

## [2.1.0-rc.1](https://github.com/disafronov/semantic-release/compare/v2.0.19...v2.1.0-rc.1) (2026-11-02)

### Features

* **ci:** allow selecting semantic-release image tag via repository variable ([f8417a6](https://github.com/disafronov/semantic-release/commit/f8417a643bad1a6750b1523a19f8da6444cb38f6))
* prepare automatic Python and npm package versioning ([c934f00](https://github.com/disafronov/semantic-release/commit/c934f005fd7228426c5e3e0942b5209824751bae))
* prepare automatic Python and npm package versioning ([423f4e7](https://github.com/disafronov/semantic-release/commit/423f4e7dc42d05d188503d5e4f572d6a471eac2e))
* prepare automatic Python and npm package versioning ([6169376](https://github.com/disafronov/semantic-release/commit/6169376687285fae2fe78cc3685311255f62ac60))
* prepare automatic Python and npm package versioning ([2aadc91](https://github.com/disafronov/semantic-release/commit/2aadc9140aa1c5045a24ce84bdfcb9cc10ef95be))
* prepare automatic Python and npm package versioning ([6b3d2ba](https://github.com/disafronov/semantic-release/commit/6b3d2ba506c1159f409b16a4a45d9f317e24b23d))
* prepare automatic Python and npm package versioning ([31e614f](https://github.com/disafronov/semantic-release/commit/31e614f68245feb8ac39dafa3dce316703c428fe))

### Bug Fixes

* audit ([f85a95e](https://github.com/disafronov/semantic-release/commit/f85a95ee7f7c2683725b99dc9c795f5bd6b288ae))
* **ci:** validate rc pull requests ([b6f46e6](https://github.com/disafronov/semantic-release/commit/b6f46e62269b22ce7ab543e5135f9def2ea60368))
* **ci:** validate rc pull requests ([c6d600c](https://github.com/disafronov/semantic-release/commit/c6d600c942efdc1e826a35eea032300e64214463))

## [2.0.19](https://github.com/disafronov/semantic-release/compare/v2.0.18...v2.0.19) (2026-10-27)

### Bug Fixes

* include refactors in release notes and bound glob major ([d5536be](https://github.com/disafronov/semantic-release/commit/d5536bef4bd37433d4cf131ea5dac2e6b6f2d608))

## [2.0.18](https://github.com/disafronov/semantic-release/compare/v2.0.17...v2.0.18) (2026-10-27)

## [2.0.17](https://github.com/disafronov/semantic-release/compare/v2.0.16...v2.0.17) (2026-10-27)

## [2.0.17-rc.1](https://github.com/disafronov/semantic-release/compare/v2.0.16...v2.0.17-rc.1) (2026-10-27)

## [2.0.16](https://github.com/disafronov/semantic-release/compare/v2.0.15...v2.0.16) (2026-10-26)

### Bug Fixes

* audit (partial) ([3da95bb](https://github.com/disafronov/semantic-release/commit/3da95bb8bb658553183707851d5654fea710e021))
* separate image release policy from consumer defaults ([631d128](https://github.com/disafronov/semantic-release/commit/631d128caf1a3e0cda29f10115591857510282ab))

## [2.0.16-rc.1](https://github.com/disafronov/semantic-release/compare/v2.0.15...v2.0.16-rc.1) (2026-10-26)

### Bug Fixes

* audit (partial) ([67c264c](https://github.com/disafronov/semantic-release/commit/67c264c5a48546759c39325cf2480c561f41382f))
* separate image release policy from consumer defaults ([172eb9c](https://github.com/disafronov/semantic-release/commit/172eb9c5a2a7870228bfb1c96ac49faa4c77d558))

## [2.0.15](https://github.com/disafronov/semantic-release/compare/v2.0.14...v2.0.15) (2026-10-26)

### Bug Fixes

* extend default release config without copying it ([3de6df2](https://github.com/disafronov/semantic-release/commit/3de6df242f61c2cc6b3ffda01f5004533338b80f))

## [2.0.14](https://github.com/disafronov/semantic-release/compare/v2.0.13...v2.0.14) (2026-10-26)

### Bug Fixes

* derive release sign-off from Git committer identity ([af6620a](https://github.com/disafronov/semantic-release/commit/af6620aacacdd91d080974c9b8577e0923e1e796))
* use Git identity environment for lockfile commits ([cd9ca76](https://github.com/disafronov/semantic-release/commit/cd9ca76e79b32936cfa1e8daf0c36254502f61ec))

## [2.0.13](https://github.com/disafronov/semantic-release/compare/v2.0.12...v2.0.13) (2026-10-25)

### Bug Fixes

* **ci:** attribute generated releases to GitHub Actions ([872ad2f](https://github.com/disafronov/semantic-release/commit/872ad2f70b5f0f68128ba6bd28c0bb00f631ff46))

## [2.0.12](https://github.com/disafronov/semantic-release/compare/v2.0.11...v2.0.12) (2026-10-25)

### Bug Fixes

* **ci:** use GitHub Actions as the release committer ([341a3ed](https://github.com/disafronov/semantic-release/commit/341a3edabbecb0141b1dfa2133e25c09ddc16a1a))

## [2.0.10](https://github.com/disafronov/semantic-release/compare/v2.0.9...v2.0.10) (2026-10-08)

## [2.0.0](https://github.com/disafronov/semantic-release/compare/v1.4.2...v2.0.0) (2025-12-30)

### ⚠ BREAKING CHANGES

* add breaking support!!

### Features

* add breaking support!! ([bba0bd8](https://github.com/disafronov/semantic-release/commit/bba0bd81acccf5dbecf442ded77a54b9373bb74a))

### Bug Fixes

* message ([3a861f9](https://github.com/disafronov/semantic-release/commit/3a861f9a05e3e351ba57bb8a4addf7277da76f58))

## [1.4.2](https://github.com/disafronov/semantic-release/compare/v1.4.1...v1.4.2) (2025-12-08)

### Bug Fixes

* improve readability of git commit message format in semantic-release configuration ([e17a4f1](https://github.com/disafronov/semantic-release/commit/e17a4f1e2e0fd6a885ec61c4600a4cf3090b6920))

## [1.4.1](https://github.com/disafronov/semantic-release/compare/v1.4.0...v1.4.1) (2025-12-08)

### Bug Fixes

* refactor git commit message format in semantic-release configuration ([1d1f16a](https://github.com/disafronov/semantic-release/commit/1d1f16a9447e19a1bd8b39012ca486d8ecd47453))

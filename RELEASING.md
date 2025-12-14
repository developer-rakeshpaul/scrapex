# Releasing `scrapex`

This repo publishes to npm automatically when a GitHub Release is **published**.

## One-time setup

- Create a GitHub Actions secret named `NPM_TOKEN` with an npm automation token that can publish `scrapex`.

## Publish an alpha (example: `v1.0.0-alpha.1`)

1. Ensure `package.json` has the target version (example: `1.0.0-alpha.1`).
2. Create and push the tag:

   ```bash
   git tag v1.0.0-alpha.1
   git push origin v1.0.0-alpha.1
   ```

3. Create a GitHub Release for that tag:
   - Tag: `v1.0.0-alpha.1`
   - Check **“This is a pre-release”** (recommended; workflow also detects `-*` tags)
   - Paste the release body from `.github/releases/v1.0.0-alpha.1.md`
4. Click **Publish release**.

## What happens next

- GitHub Actions workflow `.github/workflows/release.yml` runs `type-check`, `lint`, `test`, `build`, then publishes to npm.
- Pre-releases publish to the npm dist-tag `alpha` (install via `npm i scrapex@alpha`).


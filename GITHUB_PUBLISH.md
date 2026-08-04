# GitHub publishing

Repository: https://github.com/testoo202610-jpg/work (branch `main`).

## CI
`.github/workflows/ci.yml` runs `npm run check` on pushes to `main` and pull requests.

## GitHub Pages
`.github/workflows/deploy-pages.yml` deploys `dist/` to Pages after CI succeeds on `main`. `vite.config.ts` sets `base: '/work/'` to match the repository name.

To enable hosting (one-time, needs repository admin):
1. Open https://github.com/testoo202610-jpg/work/settings/pages
2. Under "Build and deployment" choose **GitHub Actions**.
3. Push a commit to `main` (or re-run the latest CI run) to trigger deployment.
4. Verify https://testoo202610-jpg.github.io/work/ loads the menu and starts a battle.

If the workflow is missing Pages permissions, ensure Settings > Actions > General > Workflow permissions is "Read and write".

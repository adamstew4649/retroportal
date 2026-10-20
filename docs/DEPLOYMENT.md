# Deploying RetroPortal to GitHub Pages

RetroPortal is a static site. GitHub Pages hosts the production build, and GitHub Actions type-checks, tests, builds and deploys it. The same build is packaged as a browser extension.

## Prerequisites

- A GitHub account.
- Git installed locally.
- Node.js 22 and npm for local builds (the workflow installs Node 22 automatically).
- No API keys, database or paid hosting account.

## 1. Create the repository

Create a new repository on GitHub. The name is up to you; `retroportal` is a common choice. The application works at either:

- `https://USERNAME.github.io/REPOSITORY/` for a project site.
- `https://USERNAME.github.io/` for a user/organisation site whose repository is named `USERNAME.github.io`.

In the project folder:

```bash
git init
git add .
git commit -m "Initial RetroPortal build"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

If you already have a repository, add it as `origin` and push `main`.

## 2. Enable GitHub Pages

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Do not choose a branch folder; the workflow uploads a build artifact.

No repository-name setting is required in the code. `vite.config.ts` uses `base: './'`, and all runtime data URLs are relative, so assets and news files resolve correctly under a repository subdirectory, at a domain root, or on a custom domain.

## 3. Allow Actions to deploy and commit news

### Pages deployment

The deploy workflow uses the standard Pages permissions declared in `.github/workflows/deploy.yml`:

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

If your organisation enforces restricted workflow permissions, allow GitHub Actions to read repository contents and write Pages deployments.

### News commits

The news workflow commits refreshed JSON files to `main` and then dispatches the Pages deployment with `gh workflow run deploy.yml`. Pushes made with the default `GITHUB_TOKEN` do not trigger other workflows, so the explicit dispatch is required. To allow both operations:

1. Go to **Settings → Actions → General**.
2. Under **Workflow permissions**, select **Read and write permissions**.
3. Save.

The workflow declares `permissions: contents: write, actions: write`. If workflow permissions are restricted, scheduled news commits or the deployment dispatch will fail.

## 4. Trigger the first deployment

Push to `main`, or open **Actions → Deploy RetroPortal to GitHub Pages → Run workflow**.

The deploy job performs these steps:

1. Check out the repository.
2. Install Node 22 and run `npm ci`.
3. Run `npm run typecheck`.
4. Run `npm test`.
5. Run `npm run build`.
6. Package the extension with `node scripts/build-extension.mjs`.
7. Upload `extension/dist` as the `retroportal-extension` artifact.
8. Upload `dist` as the Pages artifact and deploy it.

When the job finishes, the deployment URL appears in the workflow summary and under **Settings → Pages**. It is typically:

```text
https://USERNAME.github.io/REPOSITORY/
```

Propagation can take a minute after the first deployment.

## 5. How news updating works

The file `.github/workflows/update-news.yml` runs:

- Every 30 minutes (`*/30 * * * *`).
- Manually via **Actions → Update UK news dataset → Run workflow**.

It installs dependencies, runs `npm run news`, commits changes under `public/data`, and dispatches the Pages workflow. The deployment checks out the latest `main`, so the refreshed JSON is included in the published artifact. This is important: the news data is not merely generated on a runner and discarded. The dispatch also runs when the dataset was unchanged, which means a failed dispatch is retried on the next schedule.

The workflow also runs on a schedule, so keep the repository's Actions enabled. GitHub explicitly does not guarantee scheduled runs to the minute; busy periods can delay them. Use manual dispatch when you need an immediate update.

If a feed fails, the script leaves its previous snapshot in place where possible and records status in the dataset. The published site keeps working with the last successful data. The interface displays the dataset timestamp and marks cached results as stale after a failed refresh.

### Adjusting the sources or schedule

- Edit the `FEEDS` array in `scripts/update-news.mjs` to add or remove public RSS/Atom feeds.
- Edit `cron` in `.github/workflows/update-news.yml` to change the schedule. Use standard five-field cron syntax in UTC.
- Commit the change and run the workflow manually once to verify it.

Do not add feeds whose terms prohibit aggregation. Keep publisher names and links intact.

## 6. Building and checking locally

```bash
npm ci
npm run verify
npm run preview
```

`npm run verify` runs type-checking, the Vitest suite, the production build and extension packaging. `npm run preview` serves `dist/` at <http://localhost:4173>.

To emulate a repository subdirectory locally, you can serve `dist/` from a nested path (for example with `npx serve` or a simple static server) rather than changing the Vite base. Relative URLs should continue to resolve.

## 7. Custom domain

1. In **Settings → Pages → Custom domain**, enter the domain and save.
2. Add the DNS records GitHub shows for your domain.
3. Enable **Enforce HTTPS** once DNS verification succeeds.
4. Optionally add a `CNAME` file to the repository if you manage the domain that way.

Because the build uses relative paths, no rebuild configuration change is needed for a custom domain.

## 8. Browser extension artifact

Every deployment uploads a downloadable `retroportal-extension` artifact containing the unpacked extension. To install:

1. Download and unzip the artifact from the workflow run.
2. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the folder containing `manifest.json`.
5. Open a new tab.
6. Use the extension's **Options** page to choose bundled or hosted mode. For hosted mode, enter your actual Pages URL.

The artifact is intentionally not signed or published to the Chrome Web Store. Installing from source is the supported path.

## 9. Troubleshooting deployments

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `npm ci` fails | Lockfile missing or out of sync | Commit `package-lock.json`; run `npm install` locally and push the updated lockfile. |
| Type-check or tests fail | Code error | Run `npm run typecheck` and `npm test` locally; fix before pushing. |
| Pages deployment rejected | Pages source not set to GitHub Actions, or insufficient permissions | Set **Settings → Pages → Source** to **GitHub Actions** and review workflow permissions. |
| Blank page after deployment | Asset paths broken | Confirm `base: './'` and that `dist/index.html` references `./assets/...`, not `/assets/...`. |
| News is empty | Dataset missing or endpoint wrong | Run `npm run news`, commit `public/data/news.json`, and check **Settings → News → Dataset URL**. |
| News stops updating | Scheduled workflow disabled or no write permission | Enable Actions and grant **Read and write permissions**. |
| News commit succeeds but site unchanged | Deploy workflow failed | Open the latest **Deploy RetroPortal** run and inspect the build/test step. |
| Custom domain shows certificate error | DNS or HTTPS not ready | Wait for DNS verification, then enable **Enforce HTTPS**. |
| Extension loads a stale version | Old unpacked build | Rebuild with `npm run build:extension`, then click **Reload** on `chrome://extensions`. |

## 10. Rollback

Every deployment is tied to a commit. To roll back:

1. Revert the problematic commit on `main` (`git revert <sha>`), or use **Actions** to re-run a previous successful deploy workflow from the same commit.
2. Push the revert. The deploy workflow publishes the reverted build.
3. If only the news data is wrong, revert the news commit under `public/data` and let the normal deployment run.

Local user data is stored in each visitor's browser and is unaffected by deployments.

# GitHub publishing

GitHub CLI was not available in the development environment, so publishing was not performed.

After installing GitHub CLI and authenticating without sharing credentials in chat:
```bash
gh auth login
git branch -M main
gh repo create dragon-kingdoms-rts --private --source=. --remote=origin --push
```

Then enable GitHub Pages using the GitHub Actions source. Verify the deployed URL and asset loading before calling it live.

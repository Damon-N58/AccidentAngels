# Contributing — GETS (Accident Angels)

This project has multiple developers. To keep `main` always deployable, we
follow a simple **trunk-based** workflow. **Nobody pushes to `main` directly.**

## Branches

- **`main`** — production. Protected. Only updated via reviewed Pull Requests.
- **Feature branches** — branch off `main`, one per task/issue.

### Branch naming
```
feat/<short-description>     new feature      e.g. feat/payment-splits
fix/<short-description>      bug fix          e.g. fix/driver-login-redirect
chore/<short-description>    tooling/infra    e.g. chore/repo-conventions
docs/<short-description>     documentation    e.g. docs/handover
refactor/<short-description> refactor/cleanup e.g. refactor/driver-nav
```

## Workflow

1. `git checkout main && git pull`
2. `git checkout -b feat/my-thing`
3. Commit small, focused changes.
4. Push: `git push -u origin feat/my-thing`
5. Open a **Pull Request** into `main`. Link its issue with `Closes #12`.
6. A teammate reviews (**1 approval required**). CI must pass.
7. **Squash-merge**, then delete the branch.

Each PR gets an automatic **preview deployment** (once Vercel Git is connected)
— test there before merging.

## Rules of thumb

- Keep PRs small and single-purpose — easier to review, faster to merge.
- Never commit secrets. Use environment variables (Vercel + `.env.local`).
- Link every PR to a GitHub issue.
- Don't merge your own PR without a review.

## Environments

| Environment | Branch | Database |
|-------------|--------|----------|
| Production  | `main` | Prod Supabase |
| Preview     | any PR | **Staging** Supabase |
| Local       | feature branch | Staging Supabase |

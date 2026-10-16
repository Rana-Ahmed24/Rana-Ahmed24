# Automatic push and production deployment

This is a standing instruction for future Codex work in this repository. For each user request that changes project files, complete the requested work, then commit and push it to the configured production branch and deploy it to production before ending the task. The user has authorized this workflow and does not need to approve each release again.

## Release steps

1. Inspect the current branch, Git status, remotes, and deployment configuration. Read the current diff and keep unrelated or pre-existing user changes out of the release.
2. Run the relevant static checks and production build. Do not run tests unless the user asks for testing or verification.
3. Stage and commit only files changed for the current request. Use the configured production branch and remote; do not invent a remote or branch name.
4. Push the commit. If Vercel's Git integration creates the production deployment, wait for it to finish. Otherwise follow the repository's Vercel deployment instructions and deploy the linked production project.
5. Verify the deployment reaches `READY`, its commit SHA matches the pushed commit, the expected production domain is assigned, and the live site responds successfully. A successful Git push alone is not proof of deployment.
6. Report the commit SHA, deployment status, production URL, and checks run.

## Stop conditions

- If no Git remote or production branch is configured, do not guess. Finish the local work and tell the user which one-time Git target is missing.
- If deployment configuration points to an unexpected project or domain, do not deploy there. Report the mismatch.
- If required checks fail or the production deployment is not `READY`, do not report the release as successful. Explain the failure and continue fixing it when possible.
- Never stage secrets, `.env.local`, local preview data, or unrelated changes.

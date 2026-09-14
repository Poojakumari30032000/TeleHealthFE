# Workflow Rules

## Branching
- NEVER commit or push to `main` or `development`.
- Every task starts with a new branch off latest `development`:
  git fetch origin && git switch -c <branch> origin/development
- Branch name: `<type>/<JIRA-KEY>-<slug>`
  - type: feature | bugfix | hotfix | chore
  - JIRA-KEY: exact ticket key, uppercase (e.g. SCRUM-142)
  - slug: 2-5 lowercase words, hyphen separated
  - Example: feature/SCRUM-142-add-user-auth

## Commits
- Format: `<JIRA-KEY>: <imperative summary>`
- Example: `SCRUM-142: add JWT refresh handling`

## Pull Requests
- Open PRs against `development`, never `main`.
- Title: `<JIRA-KEY> <ticket summary>`
- Body must link the Jira ticket and list what changed.
- Push only to the task branch. Never merge the PR yourself.

## Jira
- Read the ticket before starting; derive the branch name from its key and summary.
- Do not transition ticket status unless explicitly asked.

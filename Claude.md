# Workflow Rules

## Branching

- NEVER commit or push to `main` or `development`.
- Every task starts with a new branch off latest `development`:

      git fetch origin && git switch -c <branch> origin/development

- Branch name: `<type>/<JIRA-KEY>-<slug>`
  - **type** — see *Branch type* below
  - **JIRA-KEY** — exact ticket key, uppercase. This repository accepts `TEL` keys only.
  - **slug** — 2 to 5 lowercase words, hyphen separated. Digits are allowed inside a
    word (`dotnet8`, `oauth2`).
  - Example: `feature/TEL-9-verify-dotnet8-build`

### Branch type

Derive the type from the ticket's Jira **issue type**, not from how the work feels:

| Jira issue type | Branch type |
|---|---|
| Bug | `bugfix` |
| Story, Task, Subtask, anything else | `feature` |

`chore` and `hotfix` are reserved for humans — automation never selects them. A
docs-only or CI-only change on a Task is still `feature`.

## Commits

- Format: `<JIRA-KEY>: <imperative summary>`
- Example: `TEL-9: record .NET 8 build verification`

## Pull Requests

- Open PRs against `development`, never `main`.
- Title: `<JIRA-KEY> <ticket summary>` — the key must match the branch's key.
- Body must link the Jira ticket and list what changed.
- Push only to the task branch. Never merge the PR yourself.

## What CI enforces

`.github/workflows/branch-policy.yml` runs on every pull request and fails it unless:

- the branch matches `^(feature|bugfix|hotfix|chore)/TEL-[1-9][0-9]*(-[a-z0-9]+){2,5}$`
  — note the `{2,5}`: a bare `feature/TEL-9` is rejected, and so is a slug over five words
- a PR into `main` comes only from `development` or a `hotfix/*` branch
- the PR title matches `TEL-<n> <summary>`
- the ticket key in the branch and the ticket key in the title are the same

Accepted keys come from the `PROJECT_KEYS` variable at the top of that workflow.

## Jira

Board: `To Do` → `In Progress` → `PR Review` → `Done`

| Status | Meaning | Who moves it |
|---|---|---|
| To Do | not started | a human |
| In Progress | approved for work — this is the scheduled agent's queue | a human |
| PR Review | PR raised, CI green, awaiting human review | the agent, or a human |
| Done | reviewed and merged | a human only |

- Read the ticket before starting; derive the branch name from its key and summary.
- Automation may make **exactly one** transition: `In Progress` → `PR Review`, and only
  when every acceptance criterion is met, a non-draft PR into `development` is open, and
  all required checks have completed and passed. It may never move a ticket to `Done`.
- **Query by `status`, never `statusCategory`.** `PR Review` and `In Progress` share the
  statusCategory `In Progress`, so `statusCategory = "In Progress"` also returns tickets
  already in review. Use `status = "In Progress"`.

## Scheduled agent

An unattended run picks up `In Progress` tickets each evening, implements them, and opens
PRs into `development`. When it hits something needing a human decision it pushes the work
finished so far, opens a draft PR, labels the ticket `awaits-decision`, and records the
question on the ticket; a morning run delivers those questions.

Tickets labelled `awaits-decision`, `scope-tbd`, `decision`, `discovery`, `gap-analysis`
or `external-dependency` are skipped, as are Epics.

The Routine prompts (claude.ai → Routines) are the source of truth for that behaviour.
This file is what both humans and the agent read for repository conventions.

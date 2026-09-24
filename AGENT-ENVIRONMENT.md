# Agent build environment

How the TeleHealth frontend gets built and tested, and what had to change to
make that true.

The backend has its own copy of this file. The problem is the same in both
repositories; the causes differ.

## The problem

Until this change, nothing in the pipeline ever built the app.

`.github/workflows/branch-policy.yml` validates branch names, PR targets and PR
titles. That is all it does. A green check meant "the branch was named
correctly" - not "it compiles", and certainly not "the tests pass".

**There are 101 `.spec.ts` files under `src/` and none of them has ever run in
CI.** Their current pass rate is unknown. That is not a statement about their
quality - nobody has been in a position to find out.

Local development does not close the gap either. The toolchain expects
Node >= 18.13 (Angular 17); at the time of writing the development machine ran
**v16.14.0**, where the Angular CLI refuses to start:

```
Node.js version v16.14.0 detected.
The Angular CLI requires a minimum Node.js version of v18.13.
```

So neither CI, nor the nightly agent, nor the local machine had actually built
this app.

## Fix 1 - CI builds every PR

`.github/workflows/build.yml` installs with `npm ci`, builds the production
configuration and runs the Karma suite on every PR into `development` or
`main`, and on every push to those branches.

Node is pinned to **20.x** rather than floating, so a runner image update
cannot quietly change the toolchain under a release.

It runs `npm run build:prod`, not `npm run build`. The `build` script carries a
`prebuild` hook that rimrafs `dist`, `.angular` and `node_modules/.cache` -
harmless in CI but pure cost, and `build:prod` has no such hook.

This also repairs the nightly runner's handover rule. It may only move a ticket
In Progress -> PR Review once "all required checks have completed and passed" -
a condition that was nearly free when the only check was a name validator.

### The test job is non-blocking, for now

The Test step is marked `continue-on-error: true` deliberately.

With 101 never-executed spec files, gating on them immediately would very
likely red-light every PR in the repository on day one. A check that is always
red teaches people to ignore checks, which is worse than having none.

**The first CI run reports the real numbers.** Once the suite is green - or the
known failures are fixed, or explicitly excluded - delete `continue-on-error`
from the Test step and the suite becomes a real gate. That one-line change is
the whole follow-up.

### No lint job

`package.json` defines `"lint": "ng lint"`, but ESLint is not installed and
there is no ESLint configuration in the repository, so the script cannot run.
Adding a lint gate means adding `@angular-eslint` first; that is its own
ticket, not a side effect of this one.

## Fix 2 - the agent can build before it pushes

Fix 1 proves correctness *after* a push. This one lets the nightly runner catch
its own mistakes *before* opening a PR.

`agent-setup.sh` checks the sandbox's Node version, installs Node 20 through
nvm if it is too old or missing, persists it for the agent's later shells, and
then runs `npm ci` - which doubles as proof that the npm registry is reachable.
Point the **Telehealth-agents** environment's setup script at it. The
environment currently reports *"No setup script configured"*.

### Egress

Good news first: `registry.npmjs.org` is already on the sandbox proxy's bypass
list, so `npm ci` should work without any change. That is the expensive one.

Only the Node install itself may need allowlisting, and only if the sandbox's
own Node is older than 18.13:

| Domain | Needed for |
| --- | --- |
| `raw.githubusercontent.com` | the nvm install script |
| `github.com`, `objects.githubusercontent.com` | nvm's own source |
| `nodejs.org` | the Node 20 tarball |

To see what the proxy is refusing, from inside the sandbox:

```bash
curl -sS "$HTTPS_PROXY/__agentproxy/status"
```

If the allowlist is not an option, use a prebuilt environment image that
already carries Node 20. `npm ci` works either way.

## Fix 3 - unverified work must not look reviewed

Not a repository change; it belongs in the nightly routine prompt. Recorded
here because it is the same failure, and because the backend has already been
bitten by it: a PR was opened non-draft and merged having never been compiled.

Add to the routine prompt:

> If you could not build and run the test suite, the PR MUST be opened as a
> DRAFT and the ticket stays In Progress. State in the PR body exactly why
> verification was impossible.

## Verifying

After merging Fix 1, the next PR into `development` should show a **Build and
test** check alongside **Branch Policy**. On the first run, look for:

- the production build completing with 0 errors
- the Karma summary: how many of the 101 spec files pass, and how many fail

That second number is the one to act on. It is the first measurement this
project has of its own test suite.

After wiring Fix 2, the next nightly run log should show a `node --version` of
20.x from setup.

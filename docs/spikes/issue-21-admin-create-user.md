# Spike: Admin-created member accounts via Cognito `AdminCreateUser`

**Issue:** #21 · **Type:** Spike (investigation only) · **Feeds:** #22, #23

## Decision under validation

Members do **not** self-register. An admin adds a member (name + email) → the
backend calls Cognito `AdminCreateUser` → Cognito emails a temporary password →
the member signs in and is forced to set a permanent password. No public signup,
no Pre-Signup allowlist Lambda.

This document records the answers to the five open questions so implementation
(#22 backend, #23 frontend) can start without re-investigating.

---

## Q1 — Does LocalStack support `admin-create-user` / the invite flow?

**No — not in the setup this repo uses.** Cognito is a **LocalStack Pro (paid)**
feature. `docker-compose.yml` runs the community image (`localstack/localstack:3.0.0`
with `SERVICES=s3,dynamodb,apigateway,lambda` and no Pro API key), and
`scripts/setup-local.sh:80` already documents this explicitly:

```
Cognito setup skipped (requires paid LocalStack license)
```

So `awslocal cognito-idp admin-create-user` is **not available** in the default
local environment, and the invite email is never delivered locally even on Pro.

### Recommended workaround (local dev/testing)

1. **Develop against the deployed `garden-club-dev` stack** — the repo already
   supports this via `npm run dev:remote` (`scripts/setup-develop.sh`), which
   writes `.env.local` pointing the frontend at the real dev Cognito pool + API.
   This is the intended path to exercise the real `AdminCreateUser` invite flow,
   including the emailed temporary password and the force-password-change UX.
2. **Unit-test the members Lambda with a mocked Cognito client** (`moto` or a
   stubbed `boto3` client) so backend logic (create → add-to-group → error
   handling) is covered without any live Cognito. Recommended for #22.
3. **If a LocalStack Pro key becomes available**, add `cognito-idp` to `SERVICES`
   in `docker-compose.yml` and set `LOCALSTACK_AUTH_TOKEN`. Even then the invite
   email isn't sent — read the temp password from the `admin-create-user`
   response, or set a known one with `admin-set-user-password`.

**Takeaway for #22/#23:** do not rely on LocalStack for this feature. Gate any
real-Cognito integration test behind the `dev:remote` flow; cover Lambda logic
with mocked boto3 in the default local/CI environment.

---

## Q2 — How do we customize the invite email?

Add `AdminCreateUserConfig` to `GardenClubUserPool` in `backend/template.yaml`.
`InviteMessageTemplate` supports the `{username}` and `{####}` (temp password)
placeholders:

```yaml
GardenClubUserPool:
  Type: AWS::Cognito::UserPool
  Properties:
    # ...existing UserPoolName / Policies / Schema...
    AdminCreateUserConfig:
      AllowAdminCreateUserOnly: true          # disables public self-signup
      InviteMessageTemplate:
        EmailSubject: "Welcome to Garden Club"
        EmailMessage: |
          Hi {username}, an account was created for you at Garden Club.
          Your temporary password is {####}. Sign in and you'll be asked
          to choose a permanent password.
```

Notes:
- `AllowAdminCreateUserOnly: true` enforces the "no self-registration" decision
  at the pool level.
- Default email delivery uses `COGNITO_DEFAULT`, capped at **~50 emails/day** and
  a generic from-address — fine for dev, **not** for production.
- **Production:** add an `EmailConfiguration` block using **SES** with a
  **verified sender identity** (and SES out of sandbox) to deliver real invite
  emails at volume. Call this out as a prerequisite in #22/#23.

---

## Q3 — Does `<Authenticator>` handle the force-password-change challenge?

**Yes, out of the box — but there is a client-config blocker to fix first.**

`frontend/src/app/(auth)/signin/page.tsx` already renders Amplify's
`<Authenticator>`. It natively handles the `CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED`
step for `FORCE_CHANGE_PASSWORD` users — **no custom screen is required.**

**Blocker found (must fix in #23):** `<Authenticator>` uses **SRP**
(`USER_SRP_AUTH`) as its default auth flow, but the app client
(`GardenClubUserPoolClient` in `template.yaml`) only enables:

```yaml
ExplicitAuthFlows:
  - ALLOW_USER_PASSWORD_AUTH
  - ALLOW_REFRESH_TOKEN_AUTH
```

`ALLOW_USER_SRP_AUTH` is **not** enabled, so the default Authenticator sign-in
will fail. Pick one:

- **Preferred:** add `- ALLOW_USER_SRP_AUTH` to `ExplicitAuthFlows` (SRP is more
  secure and is the Authenticator default; the new-password challenge works over
  SRP too), **or**
- Configure Amplify to use `USER_PASSWORD_AUTH` explicitly
  (`signIn({ options: { authFlowType: 'USER_PASSWORD_AUTH' } })` / Authenticator
  `Auth.Cognito.authFlowType`) to match the currently-enabled flow.

**UX decision:** rely on the built-in `<Authenticator>` new-password screen; no
bespoke component. Just resolve the auth-flow mismatch above.

_Related aside (out of scope):_ the sign-in page passes
`socialProviders={['google']}`, but the pool has no Google IdP / hosted-UI domain
configured — either wire that up or drop the prop. Noting so it isn't mistaken
for part of this flow.

---

## Q4 — How do we assign admin vs. regular member at creation?

Call `AdminAddUserToGroup` after `AdminCreateUser`.

- The **`Admins`** group already exists (`AdminsGroup` in `template.yaml:71`).
- **Regular members = no group.** Admin detection is by presence in `Admins`:
  the frontend reads `idToken.payload["cognito:groups"]` and checks for `"Admins"`
  (see the commented reference in `frontend/src/hooks/useIsAdmin.ts`); the backend
  will read the same claim. A member simply omitted from `Admins` is a
  regular member — no separate group is required.
- **Optional:** a dedicated `Members` group would make membership explicit and
  ease future member-only queries, but it is **not needed** for the admin/member
  distinction. Defer unless #22/#23 surface a concrete need.

Flow for the members Lambda: `AdminCreateUser` → (if admin) `AdminAddUserToGroup`
with `GroupName=Admins`. Role change later = `AdminAddUserToGroup` /
`AdminRemoveUserFromGroup`.

---

## Q5 — What IAM permissions does the members Lambda need?

Confirmed set, scoped to the User Pool ARN, following the existing per-function
role pattern (`EventsLambdaRole`, etc.):

```yaml
- Effect: Allow
  Action:
    - cognito-idp:AdminCreateUser
    - cognito-idp:AdminDeleteUser
    - cognito-idp:AdminGetUser            # look up a single member
    - cognito-idp:AdminAddUserToGroup
    - cognito-idp:AdminRemoveUserFromGroup  # needed for role changes
    - cognito-idp:ListUsers               # list members for the admin UI
  Resource: !GetAtt GardenClubUserPool.Arn
```

Additions beyond the issue's expected list: `AdminGetUser` (single-member
lookups) and `AdminRemoveUserFromGroup` (promote/demote). The Lambda also needs
the pool id injected as an env var (e.g. `USER_POOL_ID: !Ref GardenClubUserPool`)
alongside the existing `Globals` env block.

---

## Summary / decisions feeding #22 & #23

| # | Question | Outcome |
|---|----------|---------|
| Q1 | LocalStack support | **No** (Cognito is Pro; community setup skips it). Use `dev:remote` for real-flow testing; mock boto3 for Lambda unit tests. |
| Q2 | Invite email | `AdminCreateUserConfig.InviteMessageTemplate` + `AllowAdminCreateUserOnly: true`. Prod needs SES verified sender. |
| Q3 | Force-password UX | Built-in `<Authenticator>` handles it — **no custom screen**. Must add `ALLOW_USER_SRP_AUTH` (or force `USER_PASSWORD_AUTH`) to unblock sign-in. |
| Q4 | Group assignment | `AdminAddUserToGroup` → `Admins`. Members = no group. Optional `Members` group deferred. |
| Q5 | Lambda IAM | `AdminCreateUser`, `AdminDeleteUser`, `AdminGetUser`, `AdminAddUserToGroup`, `AdminRemoveUserFromGroup`, `ListUsers`, scoped to the pool ARN; inject `USER_POOL_ID`. |

**New risks surfaced during the spike:**
1. **Auth-flow mismatch** (Q3) — `<Authenticator>` needs SRP; the client doesn't
   enable it. Small `template.yaml` change, but a hard sign-in blocker if missed.
2. **No local Cognito** (Q1) — implementation and its tests must not assume
   LocalStack Cognito.
3. **Production email** (Q2) — SES verified sender is a real deployment
   prerequisite, not covered by the default `COGNITO_DEFAULT` sender.

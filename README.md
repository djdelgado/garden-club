# Garden Club Web Application

A community garden club web application where members can view events and browse photo galleries. Admin users can create events and manage photos.

## Project Overview

- **Frontend**: Next.js 15 with TypeScript, Material UI, Tailwind CSS, and AWS Amplify Auth. Built as a **static export** and hosted on **Amazon S3 + CloudFront**.
- **Backend**: AWS Lambda (Python 3.12) with API Gateway, DynamoDB, S3, and Cognito
- **Infrastructure**: AWS SAM (Serverless Application Model) for IaC
- **Local Development**: Docker Compose with LocalStack for AWS service emulation

## Prerequisites

- Node.js 20+
- Python 3.12+
- Docker & Docker Compose (only required to run LocalStack)
- AWS SAM CLI: `npm install -g aws-sam-cli`
- AWS CLI v2
- LocalStack CLI: `pip install localstack`
- awslocal CLI: `pip install awslocal`

## Local Development Setup

### 1. Clone and Install Dependencies

```bash
cd garden-club
npm install
cd frontend && npm install
cd ../backend && pip install -r requirements.txt
cd ..
```

### 2. Start LocalStack and Initialize Resources

```bash
npm run local:up
```

This command:
- Starts the LocalStack Docker container
- Waits for it to be healthy
- Creates DynamoDB tables (Events, Images)
- Creates S3 bucket (garden-club-images)
- Exports credentials to `.env.local`

> **Note:** LocalStack Community does **not** include Cognito, so real
> authentication (sign-in, admin checks, JWTs) cannot be exercised locally. To
> develop against real auth, use `npm run dev:remote`, which points
> `frontend/.env.local` at the deployed `garden-club-dev` stack (API Gateway URL,
> User Pool ID, App Client ID, images bucket) and then starts `npm run dev`. This
> requires AWS credentials with access to the `garden-club-dev` stack.

### 3. Run Frontend (Terminal 1)

```bash
npm run dev
```

Frontend will be available at `http://localhost:3000`

### 4. Run Backend (Terminal 2)

```bash
npm run local:api
```

Backend API will be available at `http://localhost:3001`

## Folder Structure

```
garden-club/
├── frontend/                    # Next.js application (static export → frontend/out/)
│   ├── src/
│   │   ├── app/                # App Router structure (route groups (app)/(auth))
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom hooks
│   │   ├── lib/                # Utilities and config
│   │   ├── services/           # Business-logic wrappers over lib/api.ts
│   │   ├── types/              # TypeScript interfaces
│   │   └── theme.ts            # MUI theme configuration
│   ├── public/                 # Static assets
│   └── package.json
├── backend/                     # AWS SAM project
│   ├── functions/
│   │   ├── events/             # Events Lambda handler
│   │   ├── images/             # Images Lambda handler
│   │   ├── members/            # Members Lambda handler
│   │   └── upload/             # Upload presign Lambda handler
│   ├── template.yaml           # SAM infrastructure template
│   ├── samconfig.toml          # SAM configuration
│   └── requirements.txt
├── scripts/
│   ├── setup-local.sh          # Local development setup (LocalStack resources)
│   ├── setup-develop.sh        # Pull garden-club-dev stack outputs into .env.local
│   └── bootstrap-admin.sh      # Create the first Cognito admin for an environment
├── docker-compose.yml           # LocalStack service for local development
└── README.md
```

## Authentication

The app uses Amazon Cognito for authentication via the `aws-amplify` JS library:

- **Sign In**: Email/password authentication via Amplify Auth
- **Sign Up**: Self-service sign-up is **closed** — the user pool sets
  `AllowAdminCreateUserOnly`, so new members are created by an admin (via the
  `/admin/members` page, backed by the Admins-only `POST /members` endpoint). The
  `/signup` route now simply redirects to `/signin`.
- **First Admin**: Bootstrapped once per environment with
  `./scripts/bootstrap-admin.sh` (see [Deployment](#deployment)).
- **Admin Role**: Users in the "Admins" Cognito group have special privileges
  - Can create and manage events
  - Can upload and manage images
  - Can invite and manage members

## Key Features

### For All Users
- Browse upcoming events with details
- View photo galleries organized by folder
- Browse high-resolution images in a modal viewer

### For Admin Users
- Create new events with title, description, date/time
- Upload images and organize them into folders
- Invite and manage members

## Deployment

Deployments run automatically via GitHub Actions. Branch maps to environment:

| Branch    | Environment | Stack             |
|-----------|-------------|-------------------|
| `develop` | `dev`       | `garden-club-dev` |
| `main`    | `prod`      | `garden-club-prod`|

Both workflows authenticate to AWS with **GitHub OIDC** (no long-lived AWS keys).

### Backend (`.github/workflows/deploy-backend.yml`)

On a push to `develop` or `main` that touches `backend/**`, the workflow runs
`sam build && sam deploy` against the matching environment
(`sam deploy --config-env dev|prod`).

Manual backend deploy:

```bash
cd backend
sam build
sam deploy --config-env dev    # or prod
```

### Frontend (`.github/workflows/deploy-frontend.yml`)

The frontend is a **static export**. On a push to `develop` or `main` that
touches `frontend/**`, `package.json`, or `package-lock.json`, the workflow:

1. Runs `npm ci` and `npm run build` (in `frontend/`), producing `frontend/out/`
   with the environment's `NEXT_PUBLIC_*` values baked in at build time.
2. Assumes the environment's AWS role via OIDC.
3. Syncs the build to S3: `aws s3 sync frontend/out/ s3://<bucket> --delete`.
4. Invalidates the CloudFront distribution (`/*`).

Manual frontend deploy:

```bash
cd frontend
npm run build
aws s3 sync out/ s3://<bucket> --delete
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

### Bootstrap the First Admin

On a freshly deployed stack no admin exists, and `POST /members` is Admins-only —
so there is no way to create the first admin through the app. Run this **once per
environment** (`dev`, `prod`) to create a Cognito user and add them to the
`Admins` group:

```bash
# By stack name (resolves the UserPoolId output automatically)
./scripts/bootstrap-admin.sh garden-club-dev admin@example.com

# Or pass a user pool ID directly
./scripts/bootstrap-admin.sh us-east-1_XXXXXXXXX admin@example.com
```

The script is idempotent — re-running it for an existing user just ensures group
membership. It sends a real invite email (`--desired-delivery-mediums EMAIL`), so
be deliberate about the address you use in `prod`. The bootstrapped user starts in
`FORCE_CHANGE_PASSWORD` state and must set a new password on first sign-in.

> This only affects real AWS environments. Locally there is no Cognito (LocalStack
> Community); the members handler falls back to the `LOCAL_DEV_CLAIMS` escape hatch
> for admin gating.

### GitHub Actions Configuration

Create two GitHub **Environments** (`dev` and `prod`) under **Settings →
Environments** so secrets can be scoped per environment, then configure:

**Repository variable**

| Name             | Value                      |
|------------------|----------------------------|
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID |

**Per-environment secrets** (`dev` and `prod`)

| Name                               | Purpose                                                    |
|------------------------------------|------------------------------------------------------------|
| `AWS_ROLE_ARN_DEV` / `AWS_ROLE_ARN_PROD` | OIDC role ARN the backend workflow assumes            |
| `NEXT_PUBLIC_API_BASE_URL`         | API Gateway base URL (baked into the frontend build)       |
| `NEXT_PUBLIC_IMAGES_BUCKET`        | Images S3 bucket name (used to build the public images URL) |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Cognito User Pool ID                                       |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID`    | Cognito App Client ID                                      |
| `S3_BUCKET_DEV` / `S3_BUCKET_PROD` | Static-site S3 bucket the build is synced to               |
| `CLOUDFRONT_DISTRIBUTION_ID_DEV` / `CLOUDFRONT_DISTRIBUTION_ID_PROD` | CloudFront distribution to invalidate |

> The frontend workflow assumes the role
> `arn:aws:iam::<AWS_ACCOUNT_ID>:role/garden-club-github-<env>` and derives
> `NEXT_PUBLIC_IMAGES_BASE_URL` from the bucket name + region. `NEXT_PUBLIC_*`
> variables are baked into the client bundle at build time and cannot be changed
> at runtime — the build must be re-run to change them.

## Environment Variables

For local development, `frontend/.env.local` is generated for you by
`npm run local:up` (LocalStack) or `npm run dev:remote` (deployed dev stack) — you
should not need to write it by hand. The `NEXT_PUBLIC_*` names must match
`frontend/src/lib/constants.ts`:

- `NEXT_PUBLIC_API_BASE_URL` — backend API base URL
- `NEXT_PUBLIC_IMAGES_BASE_URL` — public S3 base URL for image display
- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`

Backend Lambda environment variables for local runs live in `backend/env.json`
(see `backend/.env.example` for reference). Never commit `.env.local` or
credentials — `.env.local` is in `.gitignore`.

## Development Workflow

1. **Frontend Changes**: Edit files in `frontend/src/` — Next.js dev server auto-reloads
2. **Backend Changes**: Edit files in `backend/functions/` — restart `npm run local:api`
3. **Infrastructure Changes**: Edit `backend/template.yaml` and redeploy with `sam deploy`

## Troubleshooting

### LocalStack Connection Issues
- Ensure Docker is running: `docker ps`
- Check LocalStack logs: `docker logs garden-club-localstack`
- Verify network: `docker network ls` should show `garden-club_localstack_default`

### Lambda Execution Issues
- Check SAM local logs for handler errors
- Verify environment variables in `env.json`
- Ensure DynamoDB tables exist: `awslocal dynamodb list-tables`

### Frontend Auth Issues
- Clear browser cookies and localStorage
- Check `.env.local` has correct Cognito IDs
- Verify Amplify configuration in `src/lib/amplify.ts`
- Remember auth cannot be exercised against LocalStack — use `npm run dev:remote`

## License

MIT

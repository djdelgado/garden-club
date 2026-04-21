# Garden Club Web Application

A community garden club web application where members can view events and browse photo galleries. Admin users can create events and manage photos.

## Project Overview

- **Frontend**: Next.js 15 with TypeScript, Material UI, Tailwind CSS, and AWS Amplify Auth
- **Backend**: AWS Lambda (Python 3.12) with API Gateway, DynamoDB, S3, and Cognito
- **Infrastructure**: AWS SAM (Serverless Application Model) for IaC
- **Local Development**: Docker Compose with LocalStack for AWS service emulation
- **Frontend Hosting**: Docker container deployed to Amazon ECS Express Mode (Fargate)

## Prerequisites

- Node.js 20+
- Python 3.12+
- Docker & Docker Compose
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
- Creates Cognito User Pool and App Client
- Creates a test admin user
- Exports credentials to `.env.local`

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

### Running the Frontend as a Container (Optional)

After running `npm run local:up` (so `.env.local` exists with the local Cognito IDs), you can build and run the frontend inside Docker:

```bash
# Loads NEXT_PUBLIC_* from your .env.local shell env and passes them as build args
set -a && source .env.local && set +a
docker compose up frontend
```

The containerized frontend is available at `http://localhost:3000`. This closely mirrors the ECS production environment.

## Folder Structure

```
garden-club/
├── frontend/                    # Next.js application
│   ├── src/
│   │   ├── app/                # App Router structure
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom hooks
│   │   ├── lib/                # Utilities and config
│   │   ├── types/              # TypeScript interfaces
│   │   ├── theme.ts            # MUI theme configuration
│   │   └── middleware.ts       # Route protection middleware
│   ├── public/                 # Static assets
│   └── package.json
├── backend/                     # AWS SAM project
│   ├── functions/
│   │   ├── events/             # Events Lambda handler
│   │   ├── images/             # Images Lambda handler
│   │   └── upload/             # Upload presign Lambda handler
│   ├── template.yaml           # SAM infrastructure template
│   ├── samconfig.toml          # SAM local configuration
│   └── requirements.txt
├── scripts/
│   └── setup-local.sh          # Local development setup
├── Dockerfile                   # Multi-stage frontend container build
├── .dockerignore
└── docker-compose.yml           # LocalStack + optional frontend container
```

## Authentication

The app uses Amazon Cognito for authentication via the `aws-amplify` JS library:

- **Sign In**: Email/password authentication via Amplify Auth
- **Sign Up**: Create new account with email verification
- **Admin Role**: Users in the "Admins" Cognito group have special privileges
  - Can create and manage events
  - Can upload and manage images

## Key Features

### For All Users
- Browse upcoming events with details
- View photo galleries organized by event
- Browse high-resolution images in a modal viewer

### For Admin Users
- Create new events with title, description, date/time
- Upload images with header images for events
- Manage image galleries per event

## Deployment

### Deploy Backend

```bash
cd backend
sam build
sam deploy --guided
```

### Deploy Frontend → ECS Express Mode

The frontend is packaged as a Docker container and deployed automatically to Amazon ECS Express Mode (Fargate) via GitHub Actions on every push to `develop` or `main`.

See [**Deployment to ECS Express Mode**](#deployment-to-ecs-express-mode) below for the full one-time setup guide.

## Environment Variables

See `.env.local.example` for all required environment variables. For local development, copy this file to `.env.local` after running `npm run local:up`.

> **Important:** All `NEXT_PUBLIC_*` variables are baked into the client bundle at `next build` time. In CI/CD they are passed as Docker build arguments — they cannot be changed at container runtime. Store them as GitHub Actions secrets scoped to each environment (`dev` / `prod`).

## Development Workflow

1. **Frontend Changes**: Edit files in `frontend/src/` — Next.js dev server auto-reloads
2. **Backend Changes**: Edit files in `backend/functions/` — restart `sam local start-api`
3. **Infrastructure Changes**: Edit `backend/template.yaml` and redeploy with `sam deploy`

## Troubleshooting

### LocalStack Connection Issues
- Ensure Docker is running: `docker ps`
- Check LocalStack logs: `docker logs garden-club-localstack`
- Verify network: `docker network ls` should show `localstack_default`

### Lambda Execution Issues
- Check SAM local logs for handler errors
- Verify environment variables in `env.json`
- Ensure DynamoDB tables exist: `awslocal dynamodb list-tables`

### Frontend Auth Issues
- Clear browser cookies and localStorage
- Check `.env.local` has correct Cognito IDs
- Verify Amplify configuration in `src/lib/amplify.ts`

---

## Deployment to ECS Express Mode

### One-Time AWS Setup

#### 1. Create the ECR Repository

```bash
aws ecr create-repository \
  --repository-name garden-club-frontend \
  --region us-east-1
```

#### 2. Create the ECS Cluster (if not already created)

```bash
# dev cluster
aws ecs create-cluster --cluster-name garden-club-dev
# prod cluster
aws ecs create-cluster --cluster-name garden-club-prod
```

#### 3. Create the ECS Express Mode Service (first deploy)

Do this once in the AWS Console or via CLI after you have pushed an initial image:

1. Open **ECS → Clusters → garden-club-dev** → **Create service**.
2. Choose **Express** launch type (Fargate).
3. Set the image to `<AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/garden-club-frontend:dev-latest`.
4. Set container port to **3000**.
5. Choose CPU/memory (e.g. 0.5 vCPU / 1 GB for dev).
6. Attach a VPC, subnets, and security group (allow inbound 3000 or 80/443 via ALB).
7. Attach an Application Load Balancer forwarding to port 3000 (optional but recommended for HTTPS).
8. Under **Task role / execution role**, attach:
   - **Task execution role:** `ecsTaskExecutionRole` (pulls ECR image, writes CloudWatch logs)
   - **Infrastructure role:** `ecsInfrastructureRoleForExpressServices`
9. Name the service `garden-club-frontend-dev`.
10. Repeat for `garden-club-prod` on the prod cluster.

#### 4. Register the GitHub OIDC Identity Provider

In **IAM → Identity providers**, add:

- **Provider URL:** `https://token.actions.githubusercontent.com`
- **Audience:** `sts.amazonaws.com`

#### 5. Create the GitHub Actions IAM Role

Create a role named **`github-actions-ecs-role`** with the following trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:djdelgado/garden-club:ref:refs/heads/*"
        }
      }
    }
  ]
}
```

Attach an inline permissions policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "arn:aws:ecr:us-east-1:<AWS_ACCOUNT_ID>:repository/garden-club-frontend"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeServices",
        "ecs:UpdateService",
        "ecs:RegisterTaskDefinition",
        "ecs:DescribeTaskDefinition",
        "ecs:DescribeTasks",
        "ecs:ListTasks"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": [
        "arn:aws:iam::<AWS_ACCOUNT_ID>:role/ecsTaskExecutionRole",
        "arn:aws:iam::<AWS_ACCOUNT_ID>:role/ecsInfrastructureRoleForExpressServices"
      ]
    }
  ]
}
```

#### 6. Create the ECS Task Execution Role

Create a role named **`ecsTaskExecutionRole`**:
- **Trust:** `ecs-tasks.amazonaws.com`
- **Policy:** AWS managed `AmazonECSTaskExecutionRolePolicy`

#### 7. Create the ECS Infrastructure Role

Create a role named **`ecsInfrastructureRoleForExpressServices`**:
- **Trust:** `ecs.amazonaws.com`
- **Policy:** AWS managed `AmazonECSInfrastructureRolePolicyForVolumes` (check current AWS docs for the exact managed policy name for ECS Express Mode)

#### 8. Configure GitHub Actions Variables and Secrets

In your GitHub repository → **Settings → Secrets and variables → Actions**:

| Name | Type | Scope | Value |
|------|------|-------|-------|
| `AWS_ACCOUNT_ID` | Variable | Repository | Your 12-digit AWS account ID |
| `AWS_REGION` | Variable | Repository | `us-east-1` |
| `NEXT_PUBLIC_API_URL` | Secret | `dev` environment | Dev API Gateway URL |
| `NEXT_PUBLIC_IMAGES_URL` | Secret | `dev` environment | Dev S3 images URL |
| `NEXT_PUBLIC_GOCNITO_USER_POOL_ID` | Secret | `dev` environment | Dev Cognito Pool ID |
| `NEXT_PUBLIC_GOCNITO_CLIENT_ID` | Secret | `dev` environment | Dev Cognito App Client ID |
| `NEXT_PUBLIC_API_URL` | Secret | `prod` environment | Prod API Gateway URL |
| `NEXT_PUBLIC_IMAGES_URL` | Secret | `prod` environment | Prod S3 images URL |
| `NEXT_PUBLIC_GOCNITO_USER_POOL_ID` | Secret | `prod` environment | Prod Cognito Pool ID |
| `NEXT_PUBLIC_GOCNITO_CLIENT_ID` | Secret | `prod` environment | Prod Cognito App Client ID |

> Create two GitHub **Environments** (`dev` and `prod`) under **Settings → Environments** so secrets can be scoped per environment.

#### 9. Update Backend CORS (samconfig.toml)

Once your ECS service is behind a load balancer, update `backend/samconfig.toml`:

```toml
[dev.deploy.parameters]
parameter_overrides = "Stage=\"dev\" CorsOrigin=\"https://dev.yourdomain.com/\" ..."
```

Replace the old `amplifyapp.com` URL with your new ECS ALB or custom domain.

---

### Ongoing Deploy Flow

Every push to `develop` or `main` (touching `frontend/**`, `Dockerfile`, `package.json`, or `package-lock.json`) triggers the GitHub Actions workflow:

1. **resolve-env** — determines dev or prod based on branch.
2. **build-and-push** — builds the Docker image with env-specific `NEXT_PUBLIC_*` values baked in, pushes to ECR with a short SHA tag and a `dev-latest` / `prod-latest` floating tag.
3. **deploy** — registers a new ECS task definition revision with the new image URI and updates the service; waits for stability.

Track progress in the **Actions** tab of the repository.

### Rolling Back

To roll back to a previous image, update the ECS service manually:

```bash
# Find the previous image tag in ECR or the Actions run history, then:
aws ecs update-service \
  --cluster garden-club-prod \
  --service garden-club-frontend-prod \
  --task-definition garden-club-frontend-prod:<PREVIOUS_REVISION>
```

Or simply re-run the GitHub Actions workflow for a previous commit using **workflow_dispatch**.

---

## License

MIT

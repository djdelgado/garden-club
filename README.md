# Garden Club Web Application

A community garden club web application where members can view events and browse photo galleries. Admin users can create events and manage photos.

## Project Overview

- **Frontend**: Next.js 15 with TypeScript, Material UI, Tailwind CSS, and AWS Amplify
- **Backend**: AWS Lambda (Python 3.12) with API Gateway, DynamoDB, S3, and Cognito
- **Infrastructure**: AWS SAM (Serverless Application Model) for IaC
- **Local Development**: Docker Compose with LocalStack for AWS service emulation

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
└── docker-compose.yml          # LocalStack configuration
```

## Authentication

The app uses Amazon Cognito for authentication:

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

## Deployment to AWS

### Prerequisites for Deployment
- AWS account with appropriate credentials configured
- S3 bucket for SAM deployment artifacts

### Deploy Backend

```bash
cd backend
sam build
sam deploy --guided
```

### Deploy Frontend

```bash
cd frontend
npm run build
```

Then deploy using AWS Amplify Hosting or your preferred hosting solution.

## Environment Variables

See `.env.local.example` for all required environment variables. For local development, copy this file to `.env.local` after running `npm run local:up`.

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

## License

MIT

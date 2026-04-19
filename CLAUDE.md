# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Garden Club** is a full-stack web application for community garden club members to view events and browse photo galleries. Admins can create events and manage photos.

- **Frontend**: Next.js 15 + TypeScript + Material UI + Tailwind CSS + AWS Amplify Auth
- **Backend**: AWS Lambda (Python 3.12) + API Gateway + DynamoDB + S3 + Cognito
- **Infrastructure**: AWS SAM (Serverless Application Model) for IaC
- **Local Development**: Docker Compose + LocalStack for AWS service emulation

## Common Commands

### Local Development Setup
```bash
npm run local:up      # Start LocalStack, create AWS resources, export credentials
npm run local:down    # Tear down LocalStack
```

### Frontend (Next.js)
```bash
npm run dev           # Start dev server (http://localhost:3000)
npm run build         # Build for production
npm run start         # Start production server
npm run lint          # Run ESLint
```

### Backend (AWS Lambda + SAM)
```bash
npm run local:api     # Start SAM local API (http://localhost:3001)
cd backend && sam build                    # Build Lambda functions
cd backend && sam deploy --guided          # Deploy to AWS
```

### Running Tests
Currently no test framework is set up. Tests would be added to:
- Frontend: `frontend/` directory (recommended: Jest + React Testing Library)
- Backend: `backend/` directory (recommended: pytest)

## Architecture

### High-Level Data Flow

1. **Frontend** (Next.js) runs on port 3000
2. **Frontend** makes API calls to **Backend** on port 3001 (or AWS API Gateway in production)
3. **Backend** handles business logic and data access:
   - Events: CRUD operations on DynamoDB `GardenClubEvents` table
   - Images: Metadata stored in `GardenClubImages` table, files stored in S3
   - Uploads: Lambda presigns S3 URLs for client-side uploads
4. **Cognito** manages authentication (sign-up, sign-in, admin group membership)
5. **LocalStack** emulates all AWS services locally for development

### Frontend Architecture

**Structure**: `frontend/src/`
- `app/` — Next.js App Router (file-based routing)
  - `(app)/` — Protected routes (events, gallery, home) — require authentication
  - `(auth)/` — Public routes (signin, signup)
- `components/` — Reusable React components
- `hooks/` — Custom React hooks
- `lib/` — Utilities: Amplify config, API client, helpers
- `types/` — TypeScript interfaces and types
- `theme.ts` — Material UI theme configuration
- `middleware.ts` — Route protection middleware (verifies Cognito auth)
- `styles/` — Global CSS and Tailwind customizations

**Key Patterns**:
- **Route Groups**: `(app)` and `(auth)` organize public vs. protected routes
- **Middleware Protection**: `middleware.ts` redirects unauthenticated users to sign-in
- **AWS Amplify Auth**: `aws-amplify` library + Cognito for authentication
- **State**: React hooks + localStorage (no Redux/Zustand)
- **Styling**: Material UI (component library) + Tailwind CSS (utility classes)
- **Data Fetching**: axios for API calls

### Backend Architecture

**Structure**: `backend/`
- `template.yaml` — SAM infrastructure: Cognito, DynamoDB, S3, Lambda, API Gateway
- `samconfig.toml` — SAM local configuration (endpoints, env vars)
- `functions/` — Lambda handler code
  - `events/` — Event list, creation, deletion
  - `images/` — Image metadata CRUD
  - `upload/` — Generate presigned S3 URLs for uploads
- `env.json` — Local environment variables for Lambda execution
- `Dockerfile.lambda` — Custom Docker image for Lambda testing (if needed)

**Key Patterns**:
- **Event-Driven**: Lambda handlers respond to API Gateway events
- **Environment Variables**: Injected via SAM template (table/bucket names, Cognito IDs)
- **Local Testing**: SAM local emulates Lambda + API Gateway
- **Authorization**: Cognito user groups determine admin status (checked in Lambda)

### Data Models

**DynamoDB Tables**:
- `GardenClubEvents` — eventId (PK), title, description, datetime, etc.
- `GardenClubImages` — imageId (PK), eventId (GSI), fileName, uploadedBy, etc.

**S3 Bucket**:
- `garden-club-images` — Stores high-resolution images (organized by eventId prefix)

**Cognito**:
- User Pool: `GardenClubUserPool`
- App Client: `GardenClubAppClient`
- Admin Group: `Admins` (users in this group can create/manage events & images)

## Key Development Workflows

### Adding a New Frontend Page
1. Create route file: `frontend/src/app/(app)/[route]/page.tsx`
2. Add any components to `frontend/src/components/`
3. If fetching data, add API call to `frontend/src/lib/api.ts` (or similar)
4. Ensure auth is enforced via middleware (already done for routes in `(app)`)

### Adding a New Backend Endpoint
1. Create Lambda handler: `backend/functions/[feature]/app.py`
2. Add resource to `backend/template.yaml` (API Gateway + Lambda integration)
3. Update `env.json` with any new environment variables
4. Restart `sam local start-api` to pick up changes
5. Test via frontend or curl

### Uploading Images
- Frontend requests presigned URL from `upload` Lambda handler
- Frontend uploads directly to S3 using the presigned URL
- Frontend then creates metadata record by calling `images` Lambda
- This avoids Lambda size limits and enables client-side uploads

### Local Development Workflow
1. Terminal 1: `npm run local:up` (starts LocalStack + creates resources)
2. Terminal 2: `npm run dev` (starts Next.js frontend)
3. Terminal 3: `npm run local:api` (starts SAM local backend)
4. Edit files → frontend/backend auto-reload (next dev) or restart `sam local start-api`
5. Open http://localhost:3000 and test

### Deploying to AWS
1. **Backend**: `cd backend && sam build && sam deploy --guided`
2. **Frontend**: `cd frontend && npm run build` → deploy via Amplify Hosting or similar
3. Update `.env.local` with production Cognito/API Gateway endpoints

## Important Implementation Details

### Authentication Flow
- **Sign-up**: User provides email/password → Cognito creates account → auto-verified (no email confirmation)
- **Sign-in**: User provides email/password → Cognito returns JWT → Amplify stores in localStorage
- **Admin Check**: Frontend checks Cognito groups; Backend checks JWT claims for group membership
- **Middleware**: `middleware.ts` redirects unauthenticated requests to `/signin`

### CORS
- API Gateway configured with CORS origin: `http://localhost:3000` (local) or production domain
- Update in `backend/template.yaml` when deploying

### Environment Variables
- **Frontend**: `.env.local` (created by `npm run local:up`) contains Cognito IDs, API Gateway URL
- **Backend**: `env.json` and `template.yaml` define Lambda environment variables
- **Sensitive Data**: Never commit `.env.local` or credentials; `.env.local` is in `.gitignore`

### LocalStack Limitations
- LocalStack emulates AWS services but isn't 100% feature-complete
- If Lambda code uses AWS SDK features not in LocalStack, test in AWS
- Common workarounds: check LocalStack docs or manually test in AWS

## Troubleshooting

### Frontend won't load / auth error
- Clear browser localStorage and cookies
- Verify `.env.local` exists with correct Cognito IDs (from `npm run local:up`)
- Check `frontend/src/lib/amplify.ts` config matches `.env.local`

### Backend API returns 500 error
- Check SAM logs: Terminal running `npm run local:api`
- Verify Lambda handler code is correct (Python syntax, imports)
- Ensure DynamoDB tables exist: `awslocal dynamodb list-tables`

### LocalStack won't start / port conflicts
- Ensure Docker is running: `docker ps`
- Check no other service is using ports 3000, 3001, 4566 (LocalStack)
- Restart Docker: `docker restart` or full restart

### Can't upload images
- Verify S3 bucket exists: `awslocal s3 ls`
- Check Lambda presigned URL is valid (has correct expiration)
- Verify CORS is configured for S3 uploads from frontend

## Testing Strategy Recommendations

- **Frontend**: Jest + React Testing Library for component testing; E2E with Playwright/Cypress
- **Backend**: pytest for unit/integration tests with mocked AWS services
- **Integration**: E2E tests spanning frontend + local Lambda + LocalStack

## Style & Code Patterns

- **Frontend**: Functional components with hooks; prefer TypeScript interfaces for props
- **Backend**: Lambda handlers should be thin; move business logic to separate modules
- **Naming**: camelCase for JS/TS, snake_case for Python
- **Async**: Use async/await (frontend) and async def (Python backend)

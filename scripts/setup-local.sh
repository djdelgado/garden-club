#!/bin/bash

set -e

echo "🌱 Setting up Garden Club local environment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Wait for LocalStack to be ready
echo -e "${BLUE}Waiting for LocalStack to be ready...${NC}"
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if curl -s http://localhost:4566/_localstack/health | grep -q '"services"'; then
    echo -e "${GREEN}✓ LocalStack is ready${NC}"
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done

if [ $attempt -eq $max_attempts ]; then
  echo "LocalStack failed to start"
  exit 1
fi

# Export LocalStack endpoint
export AWS_ENDPOINT_URL=http://localhost:4566
export LOCALSTACK_ENDPOINT_URL=http://localhost:4566
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

echo -e "${BLUE}Creating DynamoDB tables...${NC}"

# Create Events table
awslocal dynamodb create-table \
  --table-name GardenClubEvents \
  --attribute-definitions \
    AttributeName=eventId,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
  --key-schema \
    AttributeName=eventId,KeyType=HASH \
  --global-secondary-indexes \
    "IndexName=CreatedAtIndex,KeySchema=[{AttributeName=createdAt,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=10,WriteCapacityUnits=10}" \
  --billing-mode PAY_PER_REQUEST \
  2>/dev/null || echo "Events table already exists"

echo -e "${GREEN}✓ Events table created${NC}"

# Create Images table
awslocal dynamodb create-table \
  --table-name GardenClubImages \
  --attribute-definitions \
    AttributeName=imageId,AttributeType=S \
    AttributeName=folderName,AttributeType=S \
  --key-schema \
    AttributeName=imageId,KeyType=HASH \
  --global-secondary-indexes \
    "IndexName=FolderNameIndex,KeySchema=[{AttributeName=folderName,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=10,WriteCapacityUnits=10}" \
  --billing-mode PAY_PER_REQUEST \
  2>/dev/null || echo "Images table already exists"

echo -e "${GREEN}✓ Images table created${NC}"

echo -e "${BLUE}Creating S3 bucket...${NC}"

# Create S3 bucket
awslocal s3 mb s3://garden-club-images 2>/dev/null || echo "Bucket already exists"

echo -e "${GREEN}✓ S3 bucket created${NC}"

echo -e "${BLUE}Cognito setup skipped (requires paid LocalStack license)${NC}"

# Use placeholder values for development
USER_POOL_ID="local-user-pool-id"
CLIENT_ID="local-client-id"
TEST_EMAIL="admin@gardenclub.local"
TEST_PASSWORD="TestPassword123!"

echo -e "${GREEN}✓ Placeholder credentials configured${NC}"

# Create .env.local
echo -e "${BLUE}Generating .env.local...${NC}"

cat > .env.local <<EOF
# Frontend - Public Environment Variables
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_USER_POOL_ID=$USER_POOL_ID
NEXT_PUBLIC_USER_POOL_CLIENT_ID=$CLIENT_ID
NEXT_PUBLIC_IMAGES_BASE_URL=https://s3.localhost.localstack.cloud:4566/garden-club-images
NEXT_PUBLIC_AWS_REGION=us-east-1

# AWS Configuration
AWS_REGION=us-east-1

# LocalStack - Backend Only
AWS_ENDPOINT_URL=http://localhost:4566
LOCALSTACK_ENDPOINT_URL=http://garden-club-localstack:4566
EVENTS_TABLE_NAME=GardenClubEvents
IMAGES_TABLE_NAME=GardenClubImages
IMAGES_BUCKET_NAME=garden-club-images
EOF

echo -e "${GREEN}✓ .env.local generated${NC}"

echo ""
echo -e "${GREEN}✓ Local environment setup complete!${NC}"
echo ""
echo -e "${BLUE}Test Admin Credentials:${NC}"
echo "  Email: $TEST_EMAIL"
echo "  Password: $TEST_PASSWORD"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Run 'npm run dev' to start the frontend"
echo "  2. Run 'npm run local:api' to start the backend"
echo "  3. Visit http://localhost:3000"

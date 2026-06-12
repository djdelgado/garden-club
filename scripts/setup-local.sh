#!/bin/bash

set -e

echo "Setting up Garden Club local environment..."

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

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

export AWS_ENDPOINT_URL=http://localhost:4566
export LOCALSTACK_ENDPOINT_URL=http://localhost:4566
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

echo -e "${BLUE}Creating DynamoDB tables...${NC}"

awslocal dynamodb create-table \
  --table-name GardenClubEvents \
  --attribute-definitions \
    AttributeName=eventId,AttributeType=S \
    AttributeName=startTime,AttributeType=S \
  --key-schema \
    AttributeName=eventId,KeyType=HASH \
  --global-secondary-indexes \
    "IndexName=StartTimeIndex,KeySchema=[{AttributeName=startTime,KeyType=HASH}],Projection={ProjectionType=ALL}" \
  --billing-mode PAY_PER_REQUEST \
  2>/dev/null || echo "Events table already exists"

echo -e "${GREEN}✓ Events table created${NC}"

awslocal dynamodb create-table \
  --table-name GardenClubImages \
  --attribute-definitions \
    AttributeName=imageId,AttributeType=S \
    AttributeName=folderName,AttributeType=S \
  --key-schema \
    AttributeName=imageId,KeyType=HASH \
  --global-secondary-indexes \
    "IndexName=FolderNameIndex,KeySchema=[{AttributeName=folderName,KeyType=HASH}],Projection={ProjectionType=ALL}" \
  --billing-mode PAY_PER_REQUEST \
  2>/dev/null || echo "Images table already exists"

echo -e "${GREEN}✓ Images table created${NC}"

echo -e "${BLUE}Creating S3 bucket...${NC}"

awslocal s3 mb s3://garden-club-images 2>/dev/null || echo "Bucket already exists"

# Enable CORS on the local bucket so the frontend can upload directly
awslocal s3api put-bucket-cors --bucket garden-club-images --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }]
}'

echo -e "${GREEN}✓ S3 bucket created with CORS${NC}"

echo -e "${BLUE}Cognito setup skipped (requires paid LocalStack license)${NC}"

echo ""
echo -e "${GREEN}✓ Local environment ready${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Run 'npm run local:api' to start the SAM local backend"
echo "  2. Test endpoints via curl or your HTTP client of choice"
echo "  3. Run 'npm run dev:remote' to develop the frontend against the deployed dev backend"

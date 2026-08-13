#!/bin/bash

set -e

echo "Fetching garden-club-dev stack outputs..."

STACK=garden-club-dev
REGION=us-east-1

# Next.js only loads .env.local from its own project directory, so this must
# land in frontend/ rather than the caller's cwd. Resolve from the script's
# location so it works no matter where it's invoked from.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/frontend/.env.local"

fetch_output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}

API_URL=$(fetch_output ApiUrl)
USER_POOL_ID=$(fetch_output UserPoolId)
USER_POOL_CLIENT_ID=$(fetch_output UserPoolClientId)
IMAGES_BUCKET=$(fetch_output ImagesBucketName)

if [ -z "$API_URL" ] || [ "$API_URL" = "None" ]; then
  echo "ERROR: Could not fetch stack outputs from $STACK. Is the stack deployed and your AWS credentials configured?"
  exit 1
fi

cat > "$ENV_FILE" <<EOF
NEXT_PUBLIC_API_BASE_URL=$API_URL
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=$USER_POOL_CLIENT_ID
NEXT_PUBLIC_IMAGES_BASE_URL=https://$IMAGES_BUCKET.s3.$REGION.amazonaws.com
NEXT_PUBLIC_AWS_REGION=$REGION
EOF

# An earlier version of this script wrote to the caller's cwd, so a stale copy
# at the repo root shadows nothing but is misleading. Clear it out.
if [ -f "$REPO_ROOT/.env.local" ]; then
  rm -f "$REPO_ROOT/.env.local"
  echo "Removed stale $REPO_ROOT/.env.local (was never read by Next.js)"
fi

echo "$ENV_FILE written — pointing at $STACK ($API_URL)"
echo "Restart 'npm run dev' if it is already running; Next.js reads .env.local at startup."

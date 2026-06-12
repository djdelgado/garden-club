#!/bin/bash

set -e

echo "Fetching garden-club-dev stack outputs..."

STACK=garden-club-dev
REGION=us-east-1

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

cat > .env.local <<EOF
NEXT_PUBLIC_API_BASE_URL=$API_URL
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=$USER_POOL_CLIENT_ID
NEXT_PUBLIC_IMAGES_BASE_URL=https://$IMAGES_BUCKET.s3.$REGION.amazonaws.com
NEXT_PUBLIC_AWS_REGION=$REGION
EOF

echo ".env.local written — pointing at $STACK ($API_URL)"

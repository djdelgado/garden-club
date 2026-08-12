#!/bin/bash

set -euo pipefail

# Bootstrap the first admin user on a deployed stack.
#
# On a fresh stack no admin exists, so there is no way to create the first one
# through the app (POST /members is Admins-only). This script creates a Cognito
# user and adds them to the Admins group in one step.
#
# The created user starts in FORCE_CHANGE_PASSWORD state — they receive an
# invite email with a temporary password and must set a new password on first
# sign-in.

REGION=${AWS_REGION:-us-east-1}

usage() {
  cat <<EOF
Usage: $0 <user-pool-id|stack-name> <email>

Creates a Cognito user and adds them to the "Admins" group.

Arguments:
  user-pool-id|stack-name   A Cognito user pool ID (contains "_"), or a
                            CloudFormation stack name (e.g. garden-club-dev,
                            garden-club-prod) whose UserPoolId output is resolved.
  email                     Email address for the new admin user.

Environment:
  AWS_REGION                AWS region (default: us-east-1).

Run once per environment (dev, prod). Requires AWS credentials with
cognito-idp:AdminCreateUser and cognito-idp:AdminAddUserToGroup.
EOF
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

if [ $# -ne 2 ]; then
  usage
  exit 1
fi

POOL_OR_STACK=$1
EMAIL=$2

# A Cognito user pool ID looks like "us-east-1_XXXXXXXXX" (region prefix + "_").
# Anything else is treated as a CloudFormation stack name to resolve.
if [[ "$POOL_OR_STACK" == *_* ]]; then
  USER_POOL_ID=$POOL_OR_STACK
else
  echo "Resolving UserPoolId from stack '$POOL_OR_STACK'..."
  USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$POOL_OR_STACK" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
    --output text)
fi

if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" = "None" ]; then
  echo "ERROR: Could not determine the user pool ID from '$POOL_OR_STACK'. Is the stack deployed and are your AWS credentials configured?"
  exit 1
fi

echo "Using user pool $USER_POOL_ID (region $REGION)"

# Idempotency: skip the create if the user already exists, but still (re-)run
# admin-add-user-to-group, which is naturally idempotent.
if aws cognito-idp admin-get-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --region "$REGION" >/dev/null 2>&1; then
  echo "User '$EMAIL' already exists — skipping create."
else
  echo "Creating user '$EMAIL'..."
  aws cognito-idp admin-create-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
    --desired-delivery-mediums EMAIL \
    --region "$REGION" >/dev/null
fi

echo "Adding '$EMAIL' to the Admins group..."
aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --group-name Admins \
  --region "$REGION"

echo "Done. '$EMAIL' is an admin. They must complete the FORCE_CHANGE_PASSWORD flow (set a new password) on first sign-in."

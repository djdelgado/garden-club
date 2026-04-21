export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const IMAGES_BASE_URL =
  process.env.NEXT_PUBLIC_IMAGES_URL ||
  "https://s3.localhost.localstack.cloud:4566/garden-club-images";

export const AWS_REGION = process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1";

export const USER_POOL_ID =
  process.env.NEXT_PUBLIC_GOCNITO_USER_POOL_ID || "us-east-1_XXXXXXXXXXXXXXX";

export const USER_POOL_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOCNITO_CLIENT_ID || "";

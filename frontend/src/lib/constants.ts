export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";

export const IMAGES_BASE_URL =
  process.env.NEXT_PUBLIC_IMAGES_BASE_URL ||
  "https://s3.localhost.localstack.cloud:4566/garden-club-images";

export const AWS_REGION = process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1";

export const USER_POOL_ID =
  process.env.NEXT_PUBLIC_USER_POOL_ID || "us-east-1_XXXXXXXXXXXXXXX";

export const USER_POOL_CLIENT_ID =
  process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || "";

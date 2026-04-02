"use client";

import { Amplify } from "aws-amplify";
import { USER_POOL_ID, USER_POOL_CLIENT_ID, AWS_REGION } from "./constants";

Amplify.configure(
  {
    Auth: {
      Cognito: {
        userPoolId: USER_POOL_ID,
        userPoolClientId: USER_POOL_CLIENT_ID
      },
    },
  },
  { ssr: true }
);

export default Amplify;

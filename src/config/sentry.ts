import * as Sentry from "@sentry/node";
import { expressIntegration } from "@sentry/node";

export const initializeSentry = (): void => {
  Sentry.init({
    dsn: "https://2b1ba2fb76fd8de3206100b84c4eb071@o4509535090442240.ingest.us.sentry.io/4509535093194752",
    sendDefaultPii: true,
    integrations: [
      expressIntegration()
    ],
  });
}; 
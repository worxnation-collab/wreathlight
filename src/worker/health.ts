import { APP_NAME } from "../shared/brand";

export interface Health {
  ok: true;
  app: string;
  aiEnabled: boolean;
}

export function health(aiEnabledVar: string | undefined): Health {
  return { ok: true, app: APP_NAME, aiEnabled: aiEnabledVar === "true" };
}

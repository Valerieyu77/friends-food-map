import { createSupabasePasswords } from "./passwords.js";
import { createSupabasePhotoStore } from "./photoStore.js";
import { createPostgresDatabase } from "./postgresDatabase.js";
import { createRepository } from "./repository.js";
import { createApp } from "./app.js";
import { createWebPushNotifier, silentNotifier } from "./notifier.js";

// Push services may use this to reach whoever runs the app if its notifications cause trouble.
const PUSH_CONTACT = "https://friends-food-map.vercel.app";

function requireSetting(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Put it in .env on the laptop, or in the Vercel project's settings.`);
  return value;
}

/**
 * Builds the app from the Supabase settings in the environment. `loadIndexHtml` turns on invite link previews,
 * on Vercel only, where the built page can be fetched from the site itself.
 */
export function createAppFromEnvironment(loadIndexHtml?: (origin: string) => Promise<string>) {
  const projectUrl = requireSetting("SUPABASE_URL");
  const secretKey = requireSetting("SUPABASE_SECRET_KEY");
  const photoStore = createSupabasePhotoStore(projectUrl, secretKey);
  const repository = createRepository(createPostgresDatabase(requireSetting("DATABASE_URL")), photoStore.urlFor);
  // Without push keys the app works as before, just without phone notifications.
  const pushPublicKey = process.env.VAPID_PUBLIC_KEY;
  const pushPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const notifier = pushPublicKey && pushPrivateKey ? createWebPushNotifier(pushPublicKey, pushPrivateKey, PUSH_CONTACT) : silentNotifier;
  return createApp(repository, photoStore, createSupabasePasswords(projectUrl, secretKey), notifier, loadIndexHtml);
}

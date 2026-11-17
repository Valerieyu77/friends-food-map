import { createClient } from "@supabase/supabase-js";
import type { AuthError } from "@supabase/supabase-js";
import { InputError } from "./repository.js";

/** Email and password checks. The app never stores passwords itself; Supabase Auth does. */
export interface Passwords {
  /** Creates an account that can log in right away, and returns its user id. */
  create(email: string, password: string): Promise<string>;
  /** Returns the user id, or undefined when the email or password is wrong. */
  verify(email: string, password: string): Promise<string | undefined>;
  /** Emails a link that opens `redirectTo` with a one-time sign-in for choosing a new password. */
  sendReset(email: string, redirectTo: string): Promise<void>;
  /** Sets a new password using the sign-in from that link. Returns false if the link has expired. */
  reset(accessToken: string, password: string): Promise<boolean>;
}

function explain(error: AuthError): Error {
  switch (error.code) {
    case "email_exists":
    case "user_already_exists":
      return new InputError("An account with this email already exists. Log in instead.");
    case "weak_password":
      return new InputError("Please choose a longer password.");
    case "email_address_invalid":
    case "validation_failed":
      return new InputError("Please enter a valid email address.");
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return new InputError("Too many tries just now. Please wait a few minutes and try again.");
    default:
      return new Error(`Supabase Auth failed: ${error.code ?? error.message}`);
  }
}

export function createSupabasePasswords(projectUrl: string, secretKey: string): Passwords {
  // A new client per call: logging someone in stores their session on the client, and the photo
  // uploads must keep using the secret key, not that person's sign-in.
  const client = () =>
    createClient(new URL(projectUrl).origin, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    async create(email, password) {
      // Created as already confirmed, so friends can use the app without first finding an email.
      const { data, error } = await client().auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw explain(error);
      return data.user.id;
    },
    async verify(email, password) {
      const { data, error } = await client().auth.signInWithPassword({ email, password });
      if (error?.code === "invalid_credentials") return undefined;
      if (error) throw explain(error);
      return data.user.id;
    },
    async sendReset(email, redirectTo) {
      const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw explain(error);
    },
    async reset(accessToken, password) {
      const supabase = client();
      const { data, error } = await supabase.auth.getUser(accessToken);
      if (error || !data.user) return false;
      const { error: updateError } = await supabase.auth.admin.updateUserById(data.user.id, { password });
      if (updateError) throw explain(updateError);
      return true;
    },
  };
}

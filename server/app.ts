import express from "express";
import type { Request, Response } from "express";
import { isReactionId } from "../shared/reactions.js";
import { MAX_PHOTOS } from "../shared/types.js";
import type { PlaceInput, PushSubscriptionInput, Session, User } from "../shared/types.js";
import type { Notifier } from "./notifier.js";
import type { Passwords } from "./passwords.js";
import type { PhotoStore } from "./photoStore.js";
import { invitePageHtml } from "./invitePage.js";
import { searchPlaces } from "./placeSearch.js";
import { newRatingMessage, reactionMessage } from "./pushMessages.js";
import type { PushMessage } from "./pushMessages.js";
import { InputError, NameTakenError } from "./repository.js";
import type { Repository } from "./repository.js";

// Vercel refuses request bodies over 4.5 MB, and a photo grows by a third when sent as text.
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 40;

function emailFrom(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new InputError("Please enter a valid email address.");
  return email;
}

function passwordFrom(value: unknown): string {
  const password = typeof value === "string" ? value : "";
  if (password.length < MIN_PASSWORD_LENGTH) throw new InputError(`Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (password.length > 72) throw new InputError("Your password can be at most 72 characters.");
  return password;
}

function nameFrom(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) throw new InputError("Please enter your name.");
  if (name.length > MAX_NAME_LENGTH) throw new InputError(`Your name must be at most ${MAX_NAME_LENGTH} characters.`);
  return name;
}

/** Only links back into this app's own reset page are passed to the reset email. */
function resetPageFrom(value: unknown): string {
  try {
    const url = new URL(typeof value === "string" ? value : "");
    if ((url.protocol === "https:" || url.hostname === "localhost") && url.pathname === "/reset-password") return url.href;
  } catch {
    // Falls through to the error below.
  }
  throw new InputError("Could not send the reset email. Please reload the page and try again.");
}

/**
 * Every /api route the phone talks to. Used by the laptop dev server and by the Vercel function.
 * With `loadIndexHtml`, invite links (/join/<code>) are also answered here, so chat apps see a preview of the group.
 */
export function createApp(
  repository: Repository,
  photoStore: PhotoStore,
  passwords: Passwords,
  notifier: Notifier,
  loadIndexHtml?: (origin: string) => Promise<string>,
) {
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  async function requireUser(request: Request, response: Response): Promise<User | undefined> {
    const token = request.header("x-user-token");
    const user = token ? await repository.userForToken(token) : undefined;
    if (!user) response.status(401).json({ error: "Please log in." });
    return user;
  }

  /** The signed-in account, inside the group the phone has open. */
  async function requireSession(request: Request, response: Response): Promise<Session | undefined> {
    const user = await requireUser(request, response);
    if (!user) return undefined;
    const groupId = request.header("x-group-id");
    const session = groupId ? await repository.sessionFor(user.id, groupId) : undefined;
    if (!session) response.status(403).json({ error: "You are not in this group." });
    return session;
  }

  /** Starts a sign-in for this device, and keeps the groups this browser joined before accounts. */
  async function signIn(user: User, oldTokens: unknown): Promise<{ token: string }> {
    await repository.claimMemberTokens(user, Array.isArray(oldTokens) ? oldTokens : []);
    return { token: await repository.startUserSession(user.id) };
  }

  function handleError(error: unknown, response: Response): void {
    if (error instanceof NameTakenError) {
      response.status(409).json({ error: error.message });
      return;
    }
    if (error instanceof InputError) {
      response.status(400).json({ error: error.message });
      return;
    }
    console.error("Request failed:", error instanceof Error ? error.message : error);
    response.status(500).json({ error: "Something went wrong. Please try again." });
  }

  /** Sends a notification; a failure only loses the notification, never the rating or reaction that caused it. */
  async function notify(devices: Promise<PushSubscriptionInput[]>, message: PushMessage): Promise<void> {
    try {
      const gone = await notifier.send(await devices, message);
      if (gone.length > 0) await repository.forgetPushSubscriptions(gone);
    } catch (error) {
      console.error("Notifications failed:", error instanceof Error ? error.message : error);
    }
  }

  async function savePhoto(photo: unknown): Promise<string | undefined> {
    if (photo === undefined || photo === null) return undefined;
    const match = typeof photo === "string" ? /^data:image\/jpeg;base64,(.+)$/s.exec(photo) : null;
    if (!match) throw new InputError("The photo could not be read. Try another one.");
    const jpeg = Buffer.from(match[1], "base64");
    if (jpeg.byteLength > MAX_PHOTO_BYTES) throw new InputError("That photo is too large.");
    return photoStore.save(jpeg);
  }

  /** Uploads the photos sent with a rating (a list, or one `photo` from a page loaded before lists), all or none. */
  async function savePhotos(photos: unknown, photo: unknown): Promise<string[]> {
    const sent = photos === undefined || photos === null ? (photo ? [photo] : []) : photos;
    if (!Array.isArray(sent)) throw new InputError("The photos could not be read.");
    if (sent.length > MAX_PHOTOS) throw new InputError(`Add at most ${MAX_PHOTOS} photos.`);
    const saved: string[] = [];
    try {
      for (const each of sent) saved.push((await savePhoto(each))!);
    } catch (error) {
      await removePhotos(saved);
      throw error;
    }
    return saved;
  }

  async function removePhotos(photoFiles: string[]): Promise<void> {
    for (const photoFile of photoFiles) await photoStore.remove(photoFile).catch(() => undefined);
  }

  app.post("/api/account/signup", async (request, response) => {
    try {
      const name = nameFrom(request.body?.name);
      const userId = await passwords.create(emailFrom(request.body?.email), passwordFrom(request.body?.password));
      const user = await repository.createUser(userId, name);
      response.json(await signIn(user, request.body?.oldTokens));
    } catch (error) {
      handleError(error, response);
    }
  });

  app.post("/api/account/login", async (request, response) => {
    try {
      const email = emailFrom(request.body?.email);
      const password = typeof request.body?.password === "string" ? request.body.password : "";
      const userId = await passwords.verify(email, password);
      if (!userId) {
        response.status(401).json({ error: "That email and password do not match. Check them, or reset your password." });
        return;
      }
      // An account made outside the app (for example in the Supabase dashboard) gets a name from its email.
      const user = (await repository.findUser(userId)) ?? (await repository.createUser(userId, email.split("@")[0]));
      response.json(await signIn(user, request.body?.oldTokens));
    } catch (error) {
      handleError(error, response);
    }
  });

  app.post("/api/account/logout", async (request, response) => {
    try {
      const token = request.header("x-user-token");
      if (token) await repository.endUserSession(token);
      response.status(204).end();
    } catch (error) {
      handleError(error, response);
    }
  });

  app.post("/api/account/forgot", async (request, response) => {
    try {
      await passwords.sendReset(emailFrom(request.body?.email), resetPageFrom(request.body?.resetPage));
      // Same answer whether or not the email has an account, so the page cannot be used to look people up.
      response.status(204).end();
    } catch (error) {
      handleError(error, response);
    }
  });

  app.post("/api/account/reset", async (request, response) => {
    try {
      const password = passwordFrom(request.body?.password);
      const accessToken = typeof request.body?.accessToken === "string" ? request.body.accessToken : "";
      if (!accessToken || !(await passwords.reset(accessToken, password))) {
        response.status(400).json({ error: "This reset link has expired. Ask for a new one from the log in page." });
        return;
      }
      response.status(204).end();
    } catch (error) {
      handleError(error, response);
    }
  });

  app.get("/api/account", async (request, response) => {
    try {
      const user = await requireUser(request, response);
      if (user) response.json({ user, groups: await repository.groupsForUser(user.id) });
    } catch (error) {
      handleError(error, response);
    }
  });

  app.put("/api/account", async (request, response) => {
    try {
      const user = await requireUser(request, response);
      if (user) response.json(await repository.updateProfile(user.id, { name: request.body?.name, avatar: request.body?.avatar }));
    } catch (error) {
      handleError(error, response);
    }
  });

  app.post("/api/groups", async (request, response) => {
    try {
      const user = await requireUser(request, response);
      if (user) response.json(await repository.createGroup(request.body?.groupName, user));
    } catch (error) {
      handleError(error, response);
    }
  });

  app.get("/api/invites/:code", async (request, response) => {
    try {
      const preview = await repository.previewInvite(request.params.code);
      if (!preview) response.status(404).json({ error: "This invite link is not valid." });
      else response.json(preview);
    } catch (error) {
      handleError(error, response);
    }
  });

  if (loadIndexHtml) {
    app.get("/join/:code", async (request, response) => {
      // Vercel answers over https in front of the function, which itself sees plain http.
      const origin = `${request.get("x-forwarded-proto") ?? request.protocol}://${request.get("host")}`;
      try {
        const [indexHtml, preview] = await Promise.all([loadIndexHtml(origin), repository.previewInvite(request.params.code)]);
        // An unknown code still gets the app, which explains that the link is not valid.
        response.type("html").send(preview ? invitePageHtml(indexHtml, preview, origin, request.path) : indexHtml);
      } catch (error) {
        console.error("Invite page failed:", error instanceof Error ? error.message : error);
        response.status(500).type("text").send("Could not open this invite. Please try again.");
      }
    });
  }

  app.post("/api/invites/:code/join", async (request, response) => {
    try {
      const user = await requireUser(request, response);
      if (!user) return;
      const joined = await repository.joinGroup(request.params.code, user);
      if (!joined) response.status(404).json({ error: "This invite link is not valid." });
      else response.json(joined);
    } catch (error) {
      handleError(error, response);
    }
  });

  app.post("/api/invites/:code/claim", async (request, response) => {
    try {
      const user = await requireUser(request, response);
      if (!user) return;
      const claimed = await repository.claimMember(request.params.code, user, request.body?.name);
      if (!claimed) response.status(404).json({ error: "This invite link is not valid." });
      else response.json(claimed);
    } catch (error) {
      handleError(error, response);
    }
  });

  /** Runs an action on the open group as the signed-in member, answering 204 when it is done. */
  function groupAction(action: (session: Session, request: Request) => Promise<unknown>) {
    return async (request: Request, response: Response) => {
      try {
        const session = await requireSession(request, response);
        if (!session) return;
        const result = await action(session, request);
        if (result === undefined) response.status(204).end();
        else response.json(result);
      } catch (error) {
        handleError(error, response);
      }
    };
  }

  app.put("/api/group", groupAction((session, request) => repository.renameGroup(session.group.id, session.member.id, request.body?.name)));

  app.post("/api/group/leave", groupAction((session) => repository.leaveGroup(session.group.id, session.member.id)));

  app.post(
    "/api/group/members/:id/remove",
    groupAction((session, request) => repository.removeMember(session.group.id, session.member.id, String(request.params.id))),
  );

  app.post(
    "/api/group/invite",
    groupAction(async (session) => ({ inviteCode: await repository.newInviteCode(session.group.id, session.member.id) })),
  );

  app.get("/api/me", async (request, response) => {
    try {
      const session = await requireSession(request, response);
      if (session) response.json(session);
    } catch (error) {
      handleError(error, response);
    }
  });

  app.get("/api/places/search", async (request, response) => {
    try {
      if (!(await requireSession(request, response))) return;
    } catch (error) {
      handleError(error, response);
      return;
    }
    const query = typeof request.query.q === "string" ? request.query.q.trim().slice(0, 100) : "";
    if (query.length < 2) {
      response.json([]);
      return;
    }
    const lat = typeof request.query.lat === "string" ? Number.parseFloat(request.query.lat) : NaN;
    const lon = typeof request.query.lon === "string" ? Number.parseFloat(request.query.lon) : NaN;
    // NaN fails both comparisons, so a missing or garbled location searches without one.
    const hasLocation = Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    try {
      response.json(await searchPlaces(query, hasLocation ? { lat, lon } : undefined));
    } catch (error) {
      console.error("Place search failed:", error instanceof Error ? error.message : error);
      response.status(502).json({ error: "Place search is not available right now. You can add the place by name." });
    }
  });

  app.get("/api/entries", async (request, response) => {
    try {
      const session = await requireSession(request, response);
      if (session) response.json(await repository.listEntries(session.group.id));
    } catch (error) {
      handleError(error, response);
    }
  });

  app.post("/api/entries", async (request, response) => {
    let photoFiles: string[] = [];
    try {
      const session = await requireSession(request, response);
      if (!session) return;
      photoFiles = await savePhotos(request.body?.photos, request.body?.photo);
      const place = request.body?.place as PlaceInput;
      const entry = await repository.addEntry({
          groupId: session.group.id,
          memberId: session.member.id,
          place,
          rating: request.body?.rating,
          note: request.body?.note,
          price: request.body?.price,
          priceAmount: request.body?.priceAmount,
          wouldReturn: request.body?.wouldReturn,
          dishes: request.body?.dishes,
          cuisine: request.body?.cuisine,
          photoFiles,
        });
      await notify(repository.devicesForNewRating(session.group.id, session.member.id), newRatingMessage(entry, session.group));
      response.json(entry);
    } catch (error) {
      await removePhotos(photoFiles);
      handleError(error, response);
    }
  });

  app.put("/api/places/:id/cuisine", async (request, response) => {
    try {
      const session = await requireSession(request, response);
      if (!session) return;
      if (await repository.setCuisine(session.group.id, request.params.id, request.body?.cuisine)) response.status(204).end();
      else response.status(404).json({ error: "Place not found." });
    } catch (error) {
      handleError(error, response);
    }
  });

  app.put(
    "/api/activity/seen",
    groupAction(async (session) => ({ activitySeenAt: await repository.markActivitySeen(session.member.id) })),
  );

  /** Runs an action as the signed-in account (not tied to a group), answering 204 when it is done. */
  function accountAction(action: (user: User, request: Request) => Promise<unknown>) {
    return async (request: Request, response: Response) => {
      try {
        const user = await requireUser(request, response);
        if (!user) return;
        const result = await action(user, request);
        if (result === undefined) response.status(204).end();
        else response.json(result);
      } catch (error) {
        handleError(error, response);
      }
    };
  }

  app.get(
    "/api/notifications",
    accountAction(async (user) => ({ publicKey: notifier.publicKey ?? null, ...(await repository.notificationSettings(user.id)) })),
  );

  app.put(
    "/api/notifications",
    accountAction((user, request) =>
      repository.saveNotificationSettings(user.id, { newReviews: request.body?.newReviews, reactions: request.body?.reactions }),
    ),
  );

  app.put("/api/notifications/devices", accountAction((user, request) => repository.addPushSubscription(user.id, request.body?.subscription)));

  app.post(
    "/api/notifications/devices/remove",
    accountAction((user, request) => repository.removePushSubscription(user.id, String(request.body?.endpoint ?? ""))),
  );

  app.get("/api/saved", groupAction((session) => repository.listSaved(session.group.id)));

  app.put("/api/entries/:entryId/reactions/:reaction", async (request, response) => {
    try {
      const session = await requireSession(request, response);
      if (!session) return;
      const { entryId, reaction } = request.params;
      const result = await repository.react(session.group.id, session.member.id, entryId, reaction);
      if (result === false) {
        response.status(404).json({ error: "That rating was deleted." });
        return;
      }
      if (result === "added") {
        const entry = (await repository.listEntries(session.group.id)).find((candidate) => candidate.id === entryId);
        if (entry && isReactionId(reaction)) {
          await notify(repository.devicesForReaction(entryId), reactionMessage(entry, session.member.name, reaction, session.group));
        }
      }
      response.status(204).end();
    } catch (error) {
      handleError(error, response);
    }
  });

  app.delete(
    "/api/entries/:entryId/reactions/:reaction",
    groupAction((session, request) =>
      repository.unreact(session.member.id, String(request.params.entryId), String(request.params.reaction)),
    ),
  );

  app.put("/api/saved/:placeId", async (request, response) => {
    try {
      const session = await requireSession(request, response);
      if (!session) return;
      if (await repository.savePlaceFor(session.group.id, session.member.id, request.params.placeId)) response.status(204).end();
      else response.status(404).json({ error: "Place not found." });
    } catch (error) {
      handleError(error, response);
    }
  });

  app.delete(
    "/api/saved/:placeId",
    groupAction((session, request) => repository.unsavePlaceFor(session.member.id, String(request.params.placeId))),
  );

  app.put("/api/entries/:id", async (request, response) => {
    let newPhotoFiles: string[] = [];
    try {
      const session = await requireSession(request, response);
      if (!session) return;
      const edited = await repository.updateEntry(request.params.id, session.member.id, {
        rating: request.body?.rating,
        note: request.body?.note,
        price: request.body?.price,
        priceAmount: request.body?.priceAmount,
        wouldReturn: request.body?.wouldReturn,
        dishes: request.body?.dishes,
      });
      if (!edited) {
        response.status(404).json({ error: "Entry not found." });
        return;
      }
      // A page loaded before photos could be edited sends no keepPhotos, so its edits leave photos alone.
      if (request.body?.keepPhotos === undefined) {
        response.json(edited);
        return;
      }
      newPhotoFiles = await savePhotos(request.body?.photos, undefined);
      const result = await repository.setPhotos(request.params.id, session.member.id, request.body.keepPhotos, newPhotoFiles);
      await removePhotos(result!.removedPhotoFiles);
      response.json(result!.entry);
    } catch (error) {
      await removePhotos(newPhotoFiles);
      handleError(error, response);
    }
  });

  app.delete("/api/entries/:id", async (request, response) => {
    try {
      const session = await requireSession(request, response);
      if (!session) return;
      const result = await repository.deleteEntry(request.params.id, session.member.id);
      if (!result.deleted) {
        response.status(404).json({ error: "Entry not found." });
        return;
      }
      await removePhotos(result.photoFiles ?? []);
      response.status(204).end();
    } catch (error) {
      handleError(error, response);
    }
  });

  // Vercel calls this once a day so the free Supabase project never pauses from a week without use.
  app.get("/api/keep-awake", async (_request, response) => {
    try {
      await repository.touch();
      response.json({ ok: true });
    } catch (error) {
      handleError(error, response);
    }
  });

  return app;
}

import { randomBytes, randomUUID } from "node:crypto";
import { avatarText, parseAvatar } from "../shared/avatars.js";
import { isCuisineId } from "../shared/cuisines.js";
import type { CuisineId } from "../shared/cuisines.js";
import { MAX_PRICE, MAX_PRICE_AMOUNT, MIN_PRICE, priceLevelFor } from "../shared/prices.js";
import { isReactionId } from "../shared/reactions.js";
import type { ReactionId } from "../shared/reactions.js";
import { MAX_DISHES, MAX_DISH_NAME_LENGTH, MAX_PHOTOS, MAX_RATING, MIN_RATING } from "../shared/types.js";
import type {
  Dish,
  Entry,
  Group,
  GroupMember,
  GroupSummary,
  JoinPreview,
  NotificationSettings,
  Place,
  PlaceInput,
  PushSubscriptionInput,
  Reaction,
  SavedPlace,
  Session,
  User,
} from "../shared/types.js";

const INVITE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const MAX_NAME_LENGTH = 40;
const MAX_GROUP_NAME_LENGTH = 60;
const MAX_NOTE_LENGTH = 500;

export class InputError extends Error {}

/** The name is already in the group; the person may be coming back on another phone or browser. */
export class NameTakenError extends InputError {}

/** The one thing the repository needs from a database: run SQL with $1, $2… parameters and get rows back. */
export interface Database {
  query<Row>(text: string, params?: unknown[]): Promise<Row[]>;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, invite_code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES groups(id), name TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS places (
    id TEXT PRIMARY KEY, osm_key TEXT UNIQUE, name TEXT NOT NULL, address TEXT, city TEXT,
    lat DOUBLE PRECISION, lon DOUBLE PRECISION
  )`,
  `CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES groups(id), member_id TEXT NOT NULL REFERENCES members(id),
    place_id TEXT NOT NULL REFERENCES places(id), rating INTEGER NOT NULL, note TEXT, photo_file TEXT, created_at TEXT NOT NULL
  )`,
  // Added 2026-10-27; places rated before then have no cuisine until someone picks one.
  `ALTER TABLE places ADD COLUMN IF NOT EXISTS cuisine TEXT`,
  // Added 2026-11-03. Passwords live in Supabase Auth; `users.id` is the Supabase user id.
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS user_sessions (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
  )`,
  // Members who joined before accounts have no user until someone claims them.
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`,
  // Added 2026-11-06. Someone who left or was removed keeps their member row, so their ratings stay.
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS left_at TEXT`,
  // Added 2026-11-13: when the author last changed their score or note.
  `ALTER TABLE entries ADD COLUMN IF NOT EXISTS edited_at TEXT`,
  // Added 2026-11-15: cost per person and "would go again", both optional.
  `ALTER TABLE entries ADD COLUMN IF NOT EXISTS price INTEGER`,
  `ALTER TABLE entries ADD COLUMN IF NOT EXISTS would_return BOOLEAN`,
  // Added 2026-11-16: the exact cost per person, for friends who would rather type it than pick a level.
  `ALTER TABLE entries ADD COLUMN IF NOT EXISTS price_amount INTEGER`,
  // Added 2026-11-15: the dishes in a rating, each with its own score.
  `CREATE TABLE IF NOT EXISTS dishes (
    id TEXT PRIMARY KEY, entry_id TEXT NOT NULL REFERENCES entries(id), position INTEGER NOT NULL,
    name TEXT NOT NULL, rating INTEGER NOT NULL
  )`,
  // Added 2026-11-15: a rating's photos after the first, which stays in entries.photo_file so a page
  // loaded before this still shows the cover.
  `CREATE TABLE IF NOT EXISTS entry_photos (
    entry_id TEXT NOT NULL REFERENCES entries(id), position INTEGER NOT NULL, photo_file TEXT NOT NULL,
    PRIMARY KEY (entry_id, photo_file)
  )`,
  // Added 2026-11-15: friends' reactions to a rating, one of each kind per friend.
  `CREATE TABLE IF NOT EXISTS reactions (
    entry_id TEXT NOT NULL REFERENCES entries(id), member_id TEXT NOT NULL REFERENCES members(id),
    reaction TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY (entry_id, member_id, reaction)
  )`,
  // Added 2026-11-16: when the member last opened Activity; null if never.
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS activity_seen_at TEXT`,
  // Added 2026-11-16: phone notifications. Each account picks what it wants; each device that turned them on has a subscription.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_new_reviews BOOLEAN NOT NULL DEFAULT TRUE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_reactions BOOLEAN NOT NULL DEFAULT TRUE`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), p256dh TEXT NOT NULL, auth TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  // Added 2026-11-10: places a member wants to go to, from the ones their group has rated.
  `CREATE TABLE IF NOT EXISTS saved_places (
    member_id TEXT NOT NULL REFERENCES members(id), place_id TEXT NOT NULL REFERENCES places(id), created_at TEXT NOT NULL,
    PRIMARY KEY (member_id, place_id)
  )`,
];

interface GroupRow {
  id: string;
  name: string;
  invite_code: string;
}

interface MemberRow {
  id: string;
  name: string;
  group_id: string;
  token: string;
  user_id: string | null;
  left_at: string | null;
  activity_seen_at: string | null;
}

interface EntryRow {
  id: string;
  created_at: string;
  edited_at: string | null;
  rating: number;
  price: number | null;
  price_amount: number | null;
  would_return: boolean | null;
  note: string | null;
  photo_file: string | null;
  member_id: string;
  member_name: string;
  member_avatar: string | null;
  place_id: string;
  place_name: string;
  place_address: string | null;
  place_city: string | null;
  place_lat: number | null;
  place_lon: number | null;
  place_cuisine: CuisineId | null;
}

function toSubscription(row: { endpoint: string; p256dh: string; auth: string }): PushSubscriptionInput {
  return { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
}

function cleanText(value: unknown, maxLength: number, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new InputError(`Please enter ${label}.`);
  if (text.length > maxLength) throw new InputError(`${label} must be at most ${maxLength} characters.`);
  return text;
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  const text = typeof value === "string" ? value.trim().slice(0, maxLength) : "";
  return text || undefined;
}

function ratingFrom(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < MIN_RATING || value > MAX_RATING) {
    throw new InputError(`Pick a score from ${MIN_RATING} to ${MAX_RATING}.`);
  }
  return value;
}

/** The dishes of a rating, cleaned: each needs a name and a score from 1 to 10. */
function dishesFrom(value: unknown): Dish[] {
  if (!Array.isArray(value)) throw new InputError("The dishes could not be read.");
  if (value.length > MAX_DISHES) throw new InputError(`Add at most ${MAX_DISHES} dishes.`);
  return value.map((dish: { name?: unknown; rating?: unknown } | null) => ({
    name: cleanText(dish?.name, MAX_DISH_NAME_LENGTH, "a name for each dish"),
    rating: ratingFrom(dish?.rating),
  }));
}

/** A price level from $ to $$$$, or null when skipped. */
function optionalPrice(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < MIN_PRICE || value > MAX_PRICE) {
    throw new InputError("Pick a price from $ to $$$$.");
  }
  return value;
}

/** A typed price per person in whole dollars, or null when none was typed. */
function optionalPriceAmount(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_PRICE_AMOUNT) {
    throw new InputError(`Type a price from $1 to $${MAX_PRICE_AMOUNT}, without cents.`);
  }
  return value;
}

/** The price as it is saved: a typed amount sets the level too, so the two cannot disagree. */
function priceFrom(level: unknown, amount: unknown): { price: number | null; priceAmount: number | null } {
  const priceAmount = optionalPriceAmount(amount);
  return { price: priceAmount === null ? optionalPrice(level) : priceLevelFor(priceAmount), priceAmount };
}

/** Yes or no to "would you go again", or null when skipped. */
function optionalYesNo(value: unknown): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "boolean") throw new InputError("Answer yes or no to going again.");
  return value;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** No cuisine given keeps whatever the place had; anything given must be on the list. */
function optionalCuisine(value: unknown): CuisineId | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!isCuisineId(value)) throw new InputError("Pick a cuisine from the list.");
  return value;
}

/** Leaves out an avatar that was never chosen, so a person is just { id, name }. */
function withAvatar<T extends { avatar?: string | null }>(row: T): T & { avatar?: string } {
  const { avatar, ...rest } = row;
  return (avatar ? { ...rest, avatar } : rest) as T & { avatar?: string };
}

function makeInviteCode(): string {
  return Array.from(randomBytes(8), (byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]).join("");
}

function toGroup(row: GroupRow): Group {
  return { id: row.id, name: row.name, inviteCode: row.invite_code };
}

/**
 * Groups, members, places and entries, stored in Postgres.
 * `photoUrlFor` turns a stored photo file name into the address the phone loads it from.
 */
export function createRepository(db: Database, photoUrlFor: (photoFile: string) => string) {
  let schemaReady: Promise<void> | undefined;

  /** Creates the tables the first time anything is asked of this repository. */
  function ready(): Promise<void> {
    schemaReady ??= (async () => {
      for (const statement of SCHEMA) await db.query(statement);
    })();
    return schemaReady;
  }

  async function first<Row>(text: string, params: unknown[]): Promise<Row | undefined> {
    const [row] = await db.query<Row>(text, params);
    return row;
  }

  async function addMember(groupId: string, user: User): Promise<void> {
    const taken = await first("SELECT 1 FROM members WHERE group_id = $1 AND left_at IS NULL AND lower(name) = lower($2)", [
      groupId,
      user.name,
    ]);
    if (taken) throw new NameTakenError(`Someone in this group is already called ${user.name}.`);
    // Members still carry a token of their own; only the sign-ins from before accounts use it.
    await db.query("INSERT INTO members (id, group_id, name, token, user_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)", [
      randomUUID(),
      groupId,
      user.name,
      randomBytes(24).toString("hex"),
      user.id,
      new Date().toISOString(),
    ]);
  }

  /** The account's place in a group, including one it left. */
  function memberOf(groupId: string, userId: string): Promise<MemberRow | undefined> {
    return first<MemberRow>("SELECT * FROM members WHERE group_id = $1 AND user_id = $2", [groupId, userId]);
  }

  function unclaimedMember(groupId: string, name: string): Promise<MemberRow | undefined> {
    return first<MemberRow>(
      "SELECT * FROM members WHERE group_id = $1 AND user_id IS NULL AND left_at IS NULL AND lower(name) = lower($2)",
      [groupId, name.trim()],
    );
  }

  async function comeBack(member: MemberRow): Promise<void> {
    if (member.left_at) await db.query("UPDATE members SET left_at = NULL WHERE id = $1", [member.id]);
  }

  async function requireOwner(groupId: string, memberId: string): Promise<void> {
    const [owner] = await listMembers(groupId);
    if (owner?.id !== memberId) throw new InputError("Only the group's owner can do that.");
  }

  async function claim(member: MemberRow, userId: string): Promise<void> {
    await db.query("UPDATE members SET user_id = $1 WHERE id = $2", [userId, member.id]);
  }

  function findGroupByInvite(inviteCode: string): Promise<GroupRow | undefined> {
    return first<GroupRow>("SELECT * FROM groups WHERE invite_code = $1", [inviteCode.toLowerCase()]);
  }

  async function listMembers(groupId: string): Promise<GroupMember[]> {
    const rows = await db.query<{ id: string; name: string; avatar: string | null; created_at: string }>(
      `SELECT m.id, m.name, u.avatar, m.created_at FROM members m LEFT JOIN users u ON u.id = m.user_id
       WHERE m.group_id = $1 AND m.left_at IS NULL ORDER BY m.created_at`,
      [groupId],
    );
    return rows.map((row) => withAvatar({ id: row.id, name: row.name, avatar: row.avatar, joinedAt: row.created_at }));
  }

  async function savePlace(input: PlaceInput): Promise<string> {
    if (typeof input.id === "string") {
      const known = await first<{ id: string }>("SELECT id FROM places WHERE id = $1", [input.id]);
      if (known) return known.id;
    }
    const name = cleanText(input.name, 120, "a place name");
    const address = optionalText(input.address, 200);
    const city = optionalText(input.city, 80);
    const osmKey = optionalText(input.osmKey, 40);
    const existing = osmKey
      ? await first<{ id: string }>("SELECT id FROM places WHERE osm_key = $1", [osmKey])
      : await first<{ id: string }>(
          "SELECT id FROM places WHERE osm_key IS NULL AND lower(name) = lower($1) AND lower(coalesce(city, '')) = lower($2)",
          [name, city ?? ""],
        );
    if (existing) return existing.id;
    const id = randomUUID();
    await db.query("INSERT INTO places (id, osm_key, name, address, city, lat, lon) VALUES ($1, $2, $3, $4, $5, $6, $7)", [
      id,
      osmKey ?? null,
      name,
      address ?? null,
      city ?? null,
      optionalNumber(input.lat) ?? null,
      optionalNumber(input.lon) ?? null,
    ]);
    return id;
  }

  function toEntry(row: EntryRow, dishes: Dish[] = [], extraPhotoFiles: string[] = [], reactions: Reaction[] = []): Entry {
    const place: Place = {
      id: row.place_id,
      name: row.place_name,
      address: row.place_address ?? undefined,
      city: row.place_city ?? undefined,
      lat: row.place_lat ?? undefined,
      lon: row.place_lon ?? undefined,
      cuisine: row.place_cuisine ?? undefined,
    };
    return {
      id: row.id,
      createdAt: row.created_at,
      editedAt: row.edited_at ?? undefined,
      rating: row.rating,
      price: row.price ?? undefined,
      priceAmount: row.price_amount ?? undefined,
      wouldReturn: row.would_return ?? undefined,
      dishes,
      note: row.note ?? undefined,
      photoUrls: [...(row.photo_file ? [row.photo_file] : []), ...extraPhotoFiles].map(photoUrlFor),
      reactions,
      place,
      member: withAvatar({ id: row.member_id, name: row.member_name, avatar: row.member_avatar }),
    };
  }

  async function listEntries(groupId: string): Promise<Entry[]> {
    await ready();
    const rows = await db.query<EntryRow>(
      `SELECT e.id, e.created_at, e.edited_at, e.rating, e.price, e.price_amount, e.would_return, e.note, e.photo_file, e.member_id, m.name AS member_name, u.avatar AS member_avatar,
              p.id AS place_id, p.name AS place_name, p.address AS place_address, p.city AS place_city,
              p.lat AS place_lat, p.lon AS place_lon, p.cuisine AS place_cuisine
       FROM entries e JOIN members m ON m.id = e.member_id JOIN places p ON p.id = e.place_id
       LEFT JOIN users u ON u.id = m.user_id
       WHERE e.group_id = $1 ORDER BY e.created_at DESC`,
      [groupId],
    );
    const dishRows = await db.query<{ entry_id: string; name: string; rating: number }>(
      `SELECT d.entry_id, d.name, d.rating FROM dishes d JOIN entries e ON e.id = d.entry_id
       WHERE e.group_id = $1 ORDER BY d.position`,
      [groupId],
    );
    const dishesByEntry = new Map<string, Dish[]>();
    for (const dish of dishRows) {
      dishesByEntry.set(dish.entry_id, [...(dishesByEntry.get(dish.entry_id) ?? []), { name: dish.name, rating: dish.rating }]);
    }
    const photoRows = await db.query<{ entry_id: string; photo_file: string }>(
      `SELECT p.entry_id, p.photo_file FROM entry_photos p JOIN entries e ON e.id = p.entry_id
       WHERE e.group_id = $1 ORDER BY p.position`,
      [groupId],
    );
    const photosByEntry = new Map<string, string[]>();
    for (const photo of photoRows) {
      photosByEntry.set(photo.entry_id, [...(photosByEntry.get(photo.entry_id) ?? []), photo.photo_file]);
    }
    const reactionRows = await db.query<{
      entry_id: string;
      reaction: ReactionId;
      created_at: string;
      member_id: string;
      member_name: string;
      member_avatar: string | null;
    }>(
      `SELECT r.entry_id, r.reaction, r.created_at, r.member_id, m.name AS member_name, u.avatar AS member_avatar
       FROM reactions r JOIN entries e ON e.id = r.entry_id JOIN members m ON m.id = r.member_id
       LEFT JOIN users u ON u.id = m.user_id
       WHERE e.group_id = $1 ORDER BY r.created_at`,
      [groupId],
    );
    const reactionsByEntry = new Map<string, Reaction[]>();
    for (const row of reactionRows) {
      const reaction = { reaction: row.reaction, createdAt: row.created_at, member: withAvatar({ id: row.member_id, name: row.member_name, avatar: row.member_avatar }) };
      reactionsByEntry.set(row.entry_id, [...(reactionsByEntry.get(row.entry_id) ?? []), reaction]);
    }
    return rows.map((row) =>
      toEntry(row, dishesByEntry.get(row.id), photosByEntry.get(row.id), reactionsByEntry.get(row.id)),
    );
  }

  /** Every photo file of an entry, the cover first. */
  async function photoFilesOf(entryId: string): Promise<string[]> {
    const cover = await first<{ photo_file: string | null }>("SELECT photo_file FROM entries WHERE id = $1", [entryId]);
    const extra = await db.query<{ photo_file: string }>("SELECT photo_file FROM entry_photos WHERE entry_id = $1 ORDER BY position", [
      entryId,
    ]);
    return [...(cover?.photo_file ? [cover.photo_file] : []), ...extra.map((row) => row.photo_file)];
  }

  /** Stores an entry's photos: the first as its cover, the rest after it. */
  async function savePhotoFiles(entryId: string, photoFiles: string[]): Promise<void> {
    if (photoFiles.length > MAX_PHOTOS) throw new InputError(`Add at most ${MAX_PHOTOS} photos.`);
    await db.query("UPDATE entries SET photo_file = $1 WHERE id = $2", [photoFiles[0] ?? null, entryId]);
    await db.query("DELETE FROM entry_photos WHERE entry_id = $1", [entryId]);
    for (const [index, photoFile] of photoFiles.slice(1).entries()) {
      await db.query("INSERT INTO entry_photos (entry_id, position, photo_file) VALUES ($1, $2, $3)", [entryId, index, photoFile]);
    }
  }

  async function saveDishes(entryId: string, dishes: Dish[]): Promise<void> {
    await db.query("DELETE FROM dishes WHERE entry_id = $1", [entryId]);
    for (const [position, dish] of dishes.entries()) {
      await db.query("INSERT INTO dishes (id, entry_id, position, name, rating) VALUES ($1, $2, $3, $4, $5)", [
        randomUUID(),
        entryId,
        position,
        dish.name,
        dish.rating,
      ]);
    }
  }

  return {
    /** Creates the account's own row, or renames it. `id` is the Supabase Auth user id. */
    async createUser(id: string, name: unknown): Promise<User> {
      await ready();
      const cleanName = cleanText(name, MAX_NAME_LENGTH, "your name");
      await db.query(
        "INSERT INTO users (id, name, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name",
        [id, cleanName, new Date().toISOString()],
      );
      return { id, name: cleanName };
    },

    async findUser(id: string): Promise<User | undefined> {
      await ready();
      const row = await first<User>("SELECT id, name, avatar FROM users WHERE id = $1", [id]);
      return row && withAvatar(row);
    },

    /**
     * Saves a new name and avatar. The name changes in every group, except where someone else
     * already uses it; those groups keep the old name and are listed in `keptOldName`.
     */
    async updateProfile(userId: string, profile: { name: unknown; avatar: unknown }): Promise<{ user: User; keptOldName: string[] }> {
      await ready();
      const name = cleanText(profile.name, MAX_NAME_LENGTH, "your name");
      const noAvatar = profile.avatar === null || profile.avatar === undefined || profile.avatar === "";
      const avatar = noAvatar ? undefined : parseAvatar(profile.avatar);
      if (!noAvatar && !avatar) throw new InputError("Pick an avatar from the list.");
      await db.query("UPDATE users SET name = $1, avatar = $2 WHERE id = $3", [name, avatar ? avatarText(avatar) : null, userId]);
      const keptOldName: string[] = [];
      const memberships = await db.query<{ id: string; group_id: string; group_name: string }>(
        "SELECT m.id, m.group_id, g.name AS group_name FROM members m JOIN groups g ON g.id = m.group_id WHERE m.user_id = $1",
        [userId],
      );
      for (const membership of memberships) {
        const taken = await first(
          "SELECT 1 FROM members WHERE group_id = $1 AND id <> $2 AND lower(name) = lower($3)",
          [membership.group_id, membership.id, name],
        );
        if (taken) keptOldName.push(membership.group_name);
        else await db.query("UPDATE members SET name = $1 WHERE id = $2", [name, membership.id]);
      }
      return { user: withAvatar({ id: userId, name, avatar: avatar ? avatarText(avatar) : null }), keptOldName };
    },

    /** A sign-in for one device; it lasts until that device logs out. */
    async startUserSession(userId: string): Promise<string> {
      await ready();
      const token = randomBytes(32).toString("hex");
      await db.query("INSERT INTO user_sessions (token, user_id, created_at) VALUES ($1, $2, $3)", [
        token,
        userId,
        new Date().toISOString(),
      ]);
      return token;
    },

    async userForToken(token: string): Promise<User | undefined> {
      await ready();
      const row = await first<User>(
        "SELECT u.id, u.name, u.avatar FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $1",
        [token],
      );
      return row && withAvatar(row);
    },

    async endUserSession(token: string): Promise<void> {
      await ready();
      await db.query("DELETE FROM user_sessions WHERE token = $1", [token]);
    },

    /** The account's groups, in the order it joined them. */
    async groupsForUser(userId: string): Promise<GroupSummary[]> {
      await ready();
      const rows = await db.query<{ id: string; name: string; member_count: string | number }>(
        `SELECT g.id, g.name,
                (SELECT count(*) FROM members others WHERE others.group_id = g.id AND others.left_at IS NULL) AS member_count
         FROM members m JOIN groups g ON g.id = m.group_id
         WHERE m.user_id = $1 AND m.left_at IS NULL ORDER BY m.created_at`,
        [userId],
      );
      return rows.map((row) => ({ id: row.id, name: row.name, memberCount: Number(row.member_count) }));
    },

    /** One of the account's groups, opened; undefined if the account is not in it. */
    async sessionFor(userId: string, groupId: string): Promise<Session | undefined> {
      await ready();
      const member = await memberOf(groupId, userId);
      if (!member || member.left_at) return undefined;
      const group = (await first<GroupRow>("SELECT * FROM groups WHERE id = $1", [groupId]))!;
      const members = await listMembers(groupId);
      const mine = members.find((candidate) => candidate.id === member.id)!;
      return {
        group: toGroup(group),
        member: withAvatar({ id: mine.id, name: mine.name, avatar: mine.avatar }),
        members,
        ownerMemberId: members[0].id,
        activitySeenAt: member.activity_seen_at ?? undefined,
      };
    },

    async createGroup(groupName: unknown, user: User): Promise<{ group: Group }> {
      await ready();
      const name = cleanText(groupName, MAX_GROUP_NAME_LENGTH, "a group name");
      const row: GroupRow = { id: randomUUID(), name, invite_code: makeInviteCode() };
      await db.query("INSERT INTO groups (id, name, invite_code, created_at) VALUES ($1, $2, $3, $4)", [
        row.id,
        row.name,
        row.invite_code,
        new Date().toISOString(),
      ]);
      await addMember(row.id, user);
      return { group: toGroup(row) };
    },

    async previewInvite(inviteCode: string): Promise<JoinPreview | undefined> {
      await ready();
      const group = await findGroupByInvite(inviteCode);
      if (!group) return undefined;
      const unclaimed = await db.query<{ name: string }>(
        "SELECT name FROM members WHERE group_id = $1 AND user_id IS NULL AND left_at IS NULL ORDER BY created_at",
        [group.id],
      );
      const placeCount = await first<{ count: string }>("SELECT COUNT(DISTINCT place_id) AS count FROM entries WHERE group_id = $1", [group.id]);
      const cover = await first<{ photo_file: string }>(
        "SELECT photo_file FROM entries WHERE group_id = $1 AND photo_file IS NOT NULL ORDER BY created_at DESC LIMIT 1",
        [group.id],
      );
      return {
        groupName: group.name,
        memberNames: (await listMembers(group.id)).map((member) => member.name),
        unclaimedNames: unclaimed.map((member) => member.name),
        placeCount: Number(placeCount?.count ?? 0),
        ...(cover ? { coverPhotoUrl: photoUrlFor(cover.photo_file) } : {}),
      };
    },

    /**
     * Joins under the account's name. Already in the group, or back after leaving: opens it, with your old ratings. Someone from before accounts
     * with the same name, not yet claimed: that is taken to be you, so you keep their ratings.
     */
    async joinGroup(inviteCode: string, user: User): Promise<{ group: Group } | undefined> {
      await ready();
      const group = await findGroupByInvite(inviteCode);
      if (!group) return undefined;
      const existing = await memberOf(group.id, user.id);
      if (existing) {
        await comeBack(existing);
        return { group: toGroup(group) };
      }
      const sameName = await unclaimedMember(group.id, user.name);
      if (sameName) await claim(sameName, user.id);
      else await addMember(group.id, user);
      return { group: toGroup(group) };
    },

    /** Lets someone who joined before accounts take back their old name, with its ratings. */
    async claimMember(inviteCode: string, user: User, name: unknown): Promise<{ group: Group } | undefined> {
      await ready();
      const group = await findGroupByInvite(inviteCode);
      if (!group) return undefined;
      const existing = await memberOf(group.id, user.id);
      if (existing && !existing.left_at) throw new InputError("You are already in this group.");
      if (existing) {
        await comeBack(existing);
        return { group: toGroup(group) };
      }
      const cleanName = cleanText(name, MAX_NAME_LENGTH, "a name");
      const member = await unclaimedMember(group.id, cleanName);
      if (!member) throw new InputError(`Nobody called ${cleanName} is waiting to be claimed in this group.`);
      await claim(member, user.id);
      return { group: toGroup(group) };
    },

    /**
     * Gives the account the groups this browser joined before accounts existed, using the old
     * sign-ins the browser kept. Returns how many were attached.
     */
    async claimMemberTokens(user: User, tokens: unknown[]): Promise<number> {
      await ready();
      let claimed = 0;
      for (const token of tokens.filter((value): value is string => typeof value === "string").slice(0, 20)) {
        const member = await first<MemberRow>("SELECT * FROM members WHERE token = $1 AND user_id IS NULL", [token]);
        if (!member || (await memberOf(member.group_id, user.id))) continue;
        await claim(member, user.id);
        claimed += 1;
      }
      return claimed;
    },

    async renameGroup(groupId: string, memberId: string, name: unknown): Promise<void> {
      await ready();
      await requireOwner(groupId, memberId);
      await db.query("UPDATE groups SET name = $1 WHERE id = $2", [cleanText(name, MAX_GROUP_NAME_LENGTH, "a group name"), groupId]);
    },

    /** Leaving keeps your ratings in the group; if you were the owner, the next person to have joined takes over. */
    async leaveGroup(groupId: string, memberId: string): Promise<void> {
      await ready();
      await db.query("UPDATE members SET left_at = $1 WHERE id = $2 AND group_id = $3", [new Date().toISOString(), memberId, groupId]);
    },

    async removeMember(groupId: string, ownerMemberId: string, removedMemberId: string): Promise<void> {
      await ready();
      await requireOwner(groupId, ownerMemberId);
      if (removedMemberId === ownerMemberId) throw new InputError("To leave the group yourself, use Leave group.");
      const removed = await first<MemberRow>("SELECT * FROM members WHERE id = $1 AND group_id = $2 AND left_at IS NULL", [
        removedMemberId,
        groupId,
      ]);
      if (!removed) throw new InputError("That person is not in this group.");
      await db.query("UPDATE members SET left_at = $1 WHERE id = $2", [new Date().toISOString(), removedMemberId]);
    },

    /** A fresh invite link; the old one stops working. Returns the new code. */
    async newInviteCode(groupId: string, memberId: string): Promise<string> {
      await ready();
      await requireOwner(groupId, memberId);
      const code = makeInviteCode();
      await db.query("UPDATE groups SET invite_code = $1 WHERE id = $2", [code, groupId]);
      return code;
    },

    async addEntry(input: {
      groupId: string;
      memberId: string;
      place: PlaceInput;
      rating: unknown;
      note: unknown;
      price?: unknown;
      priceAmount?: unknown;
      wouldReturn?: unknown;
      dishes?: unknown;
      cuisine?: unknown;
      photoFiles?: string[];
    }): Promise<Entry> {
      await ready();
      const rating = ratingFrom(input.rating);
      const { price, priceAmount } = priceFrom(input.price, input.priceAmount);
      const wouldReturn = optionalYesNo(input.wouldReturn);
      const dishes = input.dishes === undefined ? [] : dishesFrom(input.dishes);
      const photoFiles = input.photoFiles ?? [];
      if (photoFiles.length > MAX_PHOTOS) throw new InputError(`Add at most ${MAX_PHOTOS} photos.`);
      const cuisine = optionalCuisine(input.cuisine);
      const placeId = await savePlace(input.place);
      // The newest pick wins, so a friend can correct a wrong one by rating the place again.
      if (cuisine) await db.query("UPDATE places SET cuisine = $1 WHERE id = $2", [cuisine, placeId]);
      const id = randomUUID();
      await db.query(
        `INSERT INTO entries (id, group_id, member_id, place_id, rating, note, photo_file, created_at, price, would_return, price_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          id,
          input.groupId,
          input.memberId,
          placeId,
          rating,
          optionalText(input.note, MAX_NOTE_LENGTH) ?? null,
          null,
          new Date().toISOString(),
          price,
          wouldReturn,
          priceAmount,
        ],
      );
      await saveDishes(id, dishes);
      await savePhotoFiles(id, photoFiles);
      return (await listEntries(input.groupId)).find((entry) => entry.id === id)!;
    },

    listEntries,

    /** Sets the cuisine of a place this group has rated. Returns false for a place the group has never rated. */
    async setCuisine(groupId: string, placeId: string, cuisine: unknown): Promise<boolean> {
      await ready();
      const chosen = optionalCuisine(cuisine);
      if (!chosen) throw new InputError("Pick a cuisine from the list.");
      const rated = await first("SELECT 1 FROM entries WHERE group_id = $1 AND place_id = $2", [groupId, placeId]);
      if (!rated) return false;
      await db.query("UPDATE places SET cuisine = $1 WHERE id = $2", [chosen, placeId]);
      return true;
    },

    /** Adds a place to the member's want-to-go list. Returns false for a place the group has never rated. */
    async savePlaceFor(groupId: string, memberId: string, placeId: string): Promise<boolean> {
      await ready();
      const rated = await first("SELECT 1 FROM entries WHERE group_id = $1 AND place_id = $2", [groupId, placeId]);
      if (!rated) return false;
      await db.query(
        "INSERT INTO saved_places (member_id, place_id, created_at) VALUES ($1, $2, $3) ON CONFLICT (member_id, place_id) DO NOTHING",
        [memberId, placeId, new Date().toISOString()],
      );
      return true;
    },

    async unsavePlaceFor(memberId: string, placeId: string): Promise<void> {
      await ready();
      await db.query("DELETE FROM saved_places WHERE member_id = $1 AND place_id = $2", [memberId, placeId]);
    },

    /**
     * Adds a friend's reaction to a rating in their group; adding the same one again changes nothing.
     * Returns "added", "already" when it was there before (so nobody is notified twice), or false when the
     * rating is not in the group. You cannot react to your own rating.
     */
    async react(groupId: string, memberId: string, entryId: string, reaction: unknown): Promise<"added" | "already" | false> {
      await ready();
      if (!isReactionId(reaction)) throw new InputError("Pick a reaction from the list.");
      const entry = await first<{ member_id: string }>("SELECT member_id FROM entries WHERE id = $1 AND group_id = $2", [entryId, groupId]);
      if (!entry) return false;
      if (entry.member_id === memberId) throw new InputError("You can't react to your own rating.");
      const inserted = await db.query(
        `INSERT INTO reactions (entry_id, member_id, reaction, created_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT (entry_id, member_id, reaction) DO NOTHING RETURNING entry_id`,
        [entryId, memberId, reaction, new Date().toISOString()],
      );
      return inserted.length > 0 ? "added" : "already";
    },

    async notificationSettings(userId: string): Promise<NotificationSettings> {
      await ready();
      const row = await first<{ notify_new_reviews: boolean; notify_reactions: boolean }>(
        "SELECT notify_new_reviews, notify_reactions FROM users WHERE id = $1",
        [userId],
      );
      return { newReviews: row?.notify_new_reviews ?? true, reactions: row?.notify_reactions ?? true };
    },

    async saveNotificationSettings(userId: string, settings: { newReviews: unknown; reactions: unknown }): Promise<NotificationSettings> {
      await ready();
      if (typeof settings.newReviews !== "boolean" || typeof settings.reactions !== "boolean") {
        throw new InputError("Choose on or off for each kind of notification.");
      }
      await db.query("UPDATE users SET notify_new_reviews = $1, notify_reactions = $2 WHERE id = $3", [
        settings.newReviews,
        settings.reactions,
        userId,
      ]);
      return { newReviews: settings.newReviews, reactions: settings.reactions };
    },

    /** Turns notifications on for a device. A device that someone else used before now belongs to this account. */
    async addPushSubscription(userId: string, subscription: unknown): Promise<void> {
      await ready();
      const { endpoint, keys } = (subscription ?? {}) as Partial<PushSubscriptionInput>;
      if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000) {
        throw new InputError("This device's notification address could not be read.");
      }
      if (typeof keys?.p256dh !== "string" || typeof keys.auth !== "string" || keys.p256dh.length > 200 || keys.auth.length > 200) {
        throw new InputError("This device's notification keys could not be read.");
      }
      await db.query(
        `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
        [endpoint, userId, keys.p256dh, keys.auth, new Date().toISOString()],
      );
    },

    /** Turns notifications off for one of the account's devices. */
    async removePushSubscription(userId: string, endpoint: string): Promise<void> {
      await ready();
      await db.query("DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2", [endpoint, userId]);
    },

    /** Forgets devices the push service says no longer exist. */
    async forgetPushSubscriptions(endpoints: string[]): Promise<void> {
      await ready();
      for (const endpoint of endpoints) await db.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);
    },

    /** The devices to tell about a new rating: everyone else still in the group who wants new reviews. */
    async devicesForNewRating(groupId: string, authorMemberId: string): Promise<PushSubscriptionInput[]> {
      await ready();
      const rows = await db.query<{ endpoint: string; p256dh: string; auth: string }>(
        `SELECT DISTINCT p.endpoint, p.p256dh, p.auth FROM members m
         JOIN users u ON u.id = m.user_id JOIN push_subscriptions p ON p.user_id = u.id
         WHERE m.group_id = $1 AND m.left_at IS NULL AND m.id <> $2 AND u.notify_new_reviews
           AND u.id <> COALESCE((SELECT user_id FROM members WHERE id = $2), '')`,
        [groupId, authorMemberId],
      );
      return rows.map(toSubscription);
    },

    /** The devices to tell about a reaction: the rating's author, if still in the group and wanting reactions. */
    async devicesForReaction(entryId: string): Promise<PushSubscriptionInput[]> {
      await ready();
      const rows = await db.query<{ endpoint: string; p256dh: string; auth: string }>(
        `SELECT p.endpoint, p.p256dh, p.auth FROM entries e
         JOIN members m ON m.id = e.member_id JOIN users u ON u.id = m.user_id JOIN push_subscriptions p ON p.user_id = u.id
         WHERE e.id = $1 AND m.left_at IS NULL AND u.notify_reactions`,
        [entryId],
      );
      return rows.map(toSubscription);
    },

    async unreact(memberId: string, entryId: string, reaction: string): Promise<void> {
      await ready();
      await db.query("DELETE FROM reactions WHERE entry_id = $1 AND member_id = $2 AND reaction = $3", [entryId, memberId, reaction]);
    },

    /** Records that the member just opened Activity, so what came before is no longer new. Returns that time. */
    async markActivitySeen(memberId: string): Promise<string> {
      await ready();
      const seenAt = new Date().toISOString();
      await db.query("UPDATE members SET activity_seen_at = $1 WHERE id = $2", [seenAt, memberId]);
      return seenAt;
    },

    /** Everyone's want-to-go places in the group, newest first, so friends can see who wants to go where. */
    async listSaved(groupId: string): Promise<SavedPlace[]> {
      await ready();
      const rows = await db.query<{ place_id: string; member_id: string; created_at: string }>(
        `SELECT s.place_id, s.member_id, s.created_at FROM saved_places s JOIN members m ON m.id = s.member_id
         WHERE m.group_id = $1 AND m.left_at IS NULL ORDER BY s.created_at DESC`,
        [groupId],
      );
      return rows.map((row) => ({ placeId: row.place_id, memberId: row.member_id, savedAt: row.created_at }));
    },

    /**
     * Changes the score, note, price and go-again answer of an entry, if it belongs to this member.
     * Its place, photo and time stay; a price or answer left out is cleared. Dishes, when given, replace the old
     * ones; left out, they stay (a page loaded before dishes existed does not erase them).
     * Returns the changed entry, or undefined when it is not theirs.
     */
    async updateEntry(
      entryId: string,
      memberId: string,
      changes: { rating: unknown; note: unknown; price?: unknown; priceAmount?: unknown; wouldReturn?: unknown; dishes?: unknown },
    ): Promise<Entry | undefined> {
      await ready();
      const rating = ratingFrom(changes.rating);
      const { price, priceAmount } = priceFrom(changes.price, changes.priceAmount);
      const wouldReturn = optionalYesNo(changes.wouldReturn);
      const dishes = changes.dishes === undefined ? undefined : dishesFrom(changes.dishes);
      const row = await first<{ group_id: string }>("SELECT group_id FROM entries WHERE id = $1 AND member_id = $2", [entryId, memberId]);
      if (!row) return undefined;
      await db.query("UPDATE entries SET rating = $1, note = $2, edited_at = $3, price = $4, would_return = $5, price_amount = $6 WHERE id = $7", [
        rating,
        optionalText(changes.note, MAX_NOTE_LENGTH) ?? null,
        new Date().toISOString(),
        price,
        wouldReturn,
        priceAmount,
        entryId,
      ]);
      if (dishes) await saveDishes(entryId, dishes);
      return (await listEntries(row.group_id)).find((entry) => entry.id === entryId);
    },

    /**
     * Sets an entry's photos, if it belongs to this member: the ones kept (by address, in that order), then the new
     * files. Returns the changed entry and the files no longer used, for storage to remove; undefined when not theirs.
     */
    async setPhotos(
      entryId: string,
      memberId: string,
      keepUrls: unknown,
      newPhotoFiles: string[],
    ): Promise<{ entry: Entry; removedPhotoFiles: string[] } | undefined> {
      await ready();
      if (!Array.isArray(keepUrls)) throw new InputError("The photos could not be read.");
      const row = await first<{ group_id: string }>("SELECT group_id FROM entries WHERE id = $1 AND member_id = $2", [entryId, memberId]);
      if (!row) return undefined;
      const current = await photoFilesOf(entryId);
      const kept = keepUrls
        .map((url) => current.find((photoFile) => photoUrlFor(photoFile) === url))
        .filter((photoFile): photoFile is string => photoFile !== undefined);
      await savePhotoFiles(entryId, [...kept, ...newPhotoFiles]);
      const entry = (await listEntries(row.group_id)).find((candidate) => candidate.id === entryId)!;
      return { entry, removedPhotoFiles: current.filter((photoFile) => !kept.includes(photoFile)) };
    },

    /** Deletes the entry if it belongs to this member. Returns its photo files, for storage to remove. */
    async deleteEntry(entryId: string, memberId: string): Promise<{ deleted: boolean; photoFiles?: string[] }> {
      await ready();
      const row = await first("SELECT 1 FROM entries WHERE id = $1 AND member_id = $2", [entryId, memberId]);
      if (!row) return { deleted: false };
      const photoFiles = await photoFilesOf(entryId);
      await db.query("DELETE FROM dishes WHERE entry_id = $1", [entryId]);
      await db.query("DELETE FROM entry_photos WHERE entry_id = $1", [entryId]);
      await db.query("DELETE FROM reactions WHERE entry_id = $1", [entryId]);
      await db.query("DELETE FROM entries WHERE id = $1", [entryId]);
      return { deleted: true, photoFiles };
    },

    /** A tiny query, so the hosted database counts as in use. */
    async touch(): Promise<number> {
      await ready();
      const row = await first<{ count: string | number }>("SELECT count(*) AS count FROM groups", []);
      return Number(row?.count ?? 0);
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;

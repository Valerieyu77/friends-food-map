import type { CuisineId } from "../shared/cuisines.js";
import type { Coordinates } from "../shared/distance.js";
import type { ReactionId } from "../shared/reactions.js";
import type { Account, Dish, Entry, Group, JoinPreview, NotificationSettings, PlaceInput, SavedPlace, Session, User } from "../shared/types.js";
import { loadAccountToken, loadOpenGroup } from "./session.js";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface SignedIn {
  token: string;
}

interface InGroup {
  group: Group;
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = loadAccountToken();
  const groupId = loadOpenGroup();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["x-user-token"] = token;
  if (groupId) headers["x-group-id"] = groupId;
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch {
    throw new ApiError("Could not reach the app. Check your connection and try again.", 0);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? "Something went wrong. Please try again.", response.status);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const signUp = (details: { name: string; email: string; password: string; oldTokens: string[] }) =>
  request<SignedIn>("/api/account/signup", post(details));

export const logIn = (details: { email: string; password: string; oldTokens: string[] }) =>
  request<SignedIn>("/api/account/login", post(details));

export const logOut = () => request<void>("/api/account/logout", post({}));

export const sendPasswordReset = (email: string) =>
  request<void>("/api/account/forgot", post({ email, resetPage: `${window.location.origin}/reset-password` }));

export const resetPassword = (accessToken: string, password: string) =>
  request<void>("/api/account/reset", post({ accessToken, password }));

export const fetchAccount = () => request<Account>("/api/account");

export const updateProfile = (profile: { name: string; avatar: string | null }) =>
  request<{ user: User; keptOldName: string[] }>("/api/account", { method: "PUT", body: JSON.stringify(profile) });

export const createGroup = (groupName: string) => request<InGroup>("/api/groups", post({ groupName }));

export const previewInvite = (code: string) => request<JoinPreview>(`/api/invites/${code}`);

export const joinGroup = (code: string) => request<InGroup>(`/api/invites/${code}/join`, post({}));

/** Takes back a name from before accounts, with its ratings. */
export const claimName = (code: string, name: string) => request<InGroup>(`/api/invites/${code}/claim`, post({ name }));

export const fetchSession = () => request<Session>("/api/me");

export const renameGroup = (name: string) => request<void>("/api/group", { method: "PUT", body: JSON.stringify({ name }) });

export const leaveGroup = () => request<void>("/api/group/leave", post({}));

export const removeMember = (memberId: string) => request<void>(`/api/group/members/${memberId}/remove`, post({}));

export const newInviteLink = () => request<{ inviteCode: string }>("/api/group/invite", post({}));

export function searchPlaces(query: string, near?: Coordinates) {
  const parameters = new URLSearchParams({ q: query });
  if (near) {
    parameters.set("lat", near.lat.toFixed(4));
    parameters.set("lon", near.lon.toFixed(4));
  }
  return request<PlaceInput[]>(`/api/places/search?${parameters}`);
}

export const fetchEntries = () => request<Entry[]>("/api/entries");

/** What you say about a place besides where it is: the score, note, the optional price and go-again answer, and dishes. */
export interface EntryDetails {
  rating: number;
  note: string;
  price: number | null;
  /** The exact price in whole dollars when they typed one; the server then works out the level. */
  priceAmount: number | null;
  wouldReturn: boolean | null;
  dishes: Dish[];
}

/** New photos as JPEG data URLs. */
export const addEntry = (entry: EntryDetails & { place: PlaceInput; cuisine: CuisineId; photos: string[] }) =>
  request<Entry>("/api/entries", post(entry));

export const setCuisine = (placeId: string, cuisine: CuisineId) =>
  request<void>(`/api/places/${placeId}/cuisine`, { method: "PUT", body: JSON.stringify({ cuisine }) });

/** An edit: the new details, the saved photos to keep (by address, in order), and new photos as JPEG data URLs. */
export type EntryChanges = EntryDetails & { keepPhotos: string[]; photos: string[] };

export const updateEntry = (id: string, changes: EntryChanges) =>
  request<Entry>(`/api/entries/${id}`, { method: "PUT", body: JSON.stringify(changes) });

export const deleteEntry = (id: string) => request<void>(`/api/entries/${id}`, { method: "DELETE" });

export const react = (entryId: string, reaction: ReactionId) =>
  request<void>(`/api/entries/${entryId}/reactions/${reaction}`, { method: "PUT" });

export const unreact = (entryId: string, reaction: ReactionId) =>
  request<void>(`/api/entries/${entryId}/reactions/${reaction}`, { method: "DELETE" });

export const markActivitySeen = () => request<{ activitySeenAt: string }>("/api/activity/seen", { method: "PUT" });

export interface NotificationState extends NotificationSettings {
  /** The key a device needs to turn notifications on; null when the server has no push keys. */
  publicKey: string | null;
}

export const fetchNotificationState = () => request<NotificationState>("/api/notifications");

export const saveNotificationSettings = (settings: NotificationSettings) =>
  request<NotificationSettings>("/api/notifications", { method: "PUT", body: JSON.stringify(settings) });

export const addNotificationDevice = (subscription: PushSubscriptionJSON) =>
  request<void>("/api/notifications/devices", { method: "PUT", body: JSON.stringify({ subscription }) });

export const removeNotificationDevice = (endpoint: string) => request<void>("/api/notifications/devices/remove", post({ endpoint }));

export const fetchSaved = () => request<SavedPlace[]>("/api/saved");

export const savePlace = (placeId: string) => request<void>(`/api/saved/${placeId}`, { method: "PUT" });

export const unsavePlace = (placeId: string) => request<void>(`/api/saved/${placeId}`, { method: "DELETE" });

import type { CuisineId } from "./cuisines.js";
import type { ReactionId } from "./reactions.js";

export const MIN_RATING = 1;
export const MAX_RATING = 10;

/** A person with an account. Their name is used when they join a group. */
export interface User {
  id: string;
  name: string;
  /** "sticker:<id>" or "color:<id>"; see shared/avatars.ts. */
  avatar?: string;
}

/** One of your groups, as listed in the group menu. */
export interface GroupSummary {
  id: string;
  name: string;
  memberCount: number;
}

export interface Account {
  user: User;
  groups: GroupSummary[];
}

export interface Member {
  id: string;
  name: string;
  avatar?: string;
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
}

/** Someone currently in the group, as listed on the group settings page. */
export interface GroupMember extends Member {
  joinedAt: string;
}

export interface Session {
  group: Group;
  member: Member;
  /** Everyone still in the group, first joined first. */
  members: GroupMember[];
  /** The owner is whoever has been in the group longest; they can rename it, remove people, and replace the invite link. */
  ownerMemberId: string;
  /** When you last opened Activity; missing if never. Anything newer is new to you. */
  activitySeenAt?: string;
}

/**
 * A place as chosen from search or typed by hand. `osmKey` is set only for search results;
 * `id` only for a place already in the app, such as when adding a review from its page.
 */
export interface PlaceInput {
  id?: string;
  osmKey?: string;
  name: string;
  address?: string;
  city?: string;
  lat?: number;
  lon?: number;
}

export interface Place {
  id: string;
  name: string;
  address?: string;
  city?: string;
  lat?: number;
  lon?: number;
  cuisine?: CuisineId;
}

/** One dish in a rating, with its own score. */
export interface Dish {
  name: string;
  rating: number;
}

export const MAX_DISHES = 20;
export const MAX_PHOTOS = 4;
export const MAX_DISH_NAME_LENGTH = 60;

export interface Entry {
  id: string;
  createdAt: string;
  /** When the author last changed the score or note; missing if never. */
  editedAt?: string;
  rating: number;
  /** Cost per person, 1 ($) to 4 ($$$$); see shared/prices.ts. Missing if skipped. */
  price?: number;
  /** The exact cost per person in whole dollars, when they typed one; price is then its level. */
  priceAmount?: number;
  /** Whether they would go again. Missing if skipped. */
  wouldReturn?: boolean;
  /** What they ordered, in the order they listed it; empty if they listed none. */
  dishes: Dish[];
  note?: string;
  /** Its photos, the cover first; empty if none. */
  photoUrls: string[];
  /** Friends' reactions, oldest first; empty if none. */
  reactions: Reaction[];
  place: Place;
  member: Member;
}

/** One friend's reaction to a rating. A friend can leave several different ones. */
export interface Reaction {
  reaction: ReactionId;
  createdAt: string;
  member: Member;
}

/** A place someone in the group wants to go to. */
export interface SavedPlace {
  placeId: string;
  memberId: string;
  savedAt: string;
}

/** Which phone notifications an account wants; they go to every device where notifications are turned on. */
export interface NotificationSettings {
  /** A friend in one of your groups posted a rating. */
  newReviews: boolean;
  /** A friend reacted to one of your ratings. */
  reactions: boolean;
}

/** A device's address for notifications, as the browser's PushSubscription.toJSON() gives it. */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface JoinPreview {
  groupName: string;
  memberNames: string[];
  /** People who joined before accounts existed and have not been claimed by an account yet. */
  unclaimedNames: string[];
  /** How many places the group has rated. */
  placeCount: number;
  /** The group's newest photo, for the card a chat app shows for the link; missing when nobody added one. */
  coverPhotoUrl?: string;
}

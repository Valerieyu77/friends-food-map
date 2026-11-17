import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CuisineId } from "../shared/cuisines.js";
import type { Coordinates } from "../shared/distance.js";
import type { ReactionId } from "../shared/reactions.js";
import type { Account, Entry, Member, SavedPlace, Session } from "../shared/types.js";
import { buildActivity, countNew } from "./activity.js";
import type { ActivityItem } from "./activity.js";
import * as api from "./api.js";
import { findCurrentLocation } from "./location.js";
import { pinsFromPlaces, summarizePlaces } from "./places.js";
import type { PlacePin, PlaceSummary } from "./places.js";
import { visitAfterSaving } from "./saved.js";

const NOTICE_MILLISECONDS = 4000;
/** How often an open app checks for friends' new ratings and reactions. */
const REFRESH_MILLISECONDS = 2 * 60 * 1000;

/** What the signed-in app can do outside the open group; App owns these. */
export interface AccountActions {
  switchGroup: (groupId: string) => void;
  newGroup: () => void;
  logOut: () => void;
  /** Reloads the account and group (after a profile or group change), then shows `notice`. */
  reloadAccount: (notice: string) => void;
  /** After leaving the open group: opens another one, then shows `notice`. */
  leftGroup: (notice: string) => void;
}

interface GroupData extends AccountActions {
  account: Account;
  session: Session;
  /** The group's ratings, newest first; null while loading. */
  entries: Entry[] | null;
  loadError: string | null;
  reloadEntries: () => void;
  places: PlaceSummary[];
  pins: PlacePin[];
  here: Coordinates | undefined;
  addEntry: (entry: Entry) => void;
  removeEntry: (entry: Entry) => Promise<void>;
  /** Saves a new score, note, price, go-again answer, dishes and photos for your own review; throws when the server refuses, so the form can say why. */
  editEntry: (entry: Entry, changes: api.EntryChanges) => Promise<void>;
  setPlaceCuisine: (placeId: string, cuisine: CuisineId) => Promise<void>;
  /** Everyone's want-to-go places; null while loading. */
  saved: SavedPlace[] | null;
  isSaved: (placeId: string) => boolean;
  /** The people in the group who saved a place and have not rated it since, you included. */
  wantToGoBy: (placeId: string) => Member[];
  toggleSaved: (placeId: string) => void;
  /** Adds your reaction to a friend's rating, or takes it back; shows at once and undoes itself if the server says no. */
  toggleReaction: (entry: Entry, reaction: ReactionId) => void;
  /** Friends' new ratings and reactions to yours, newest first. */
  activity: ActivityItem[];
  /** When you last opened Activity; missing if never. */
  activitySeenAt: string | undefined;
  /** How many Activity items came after you last opened it; the bell's red dot. */
  newActivityCount: number;
  /** Records that you just looked at Activity, here and on the server, so the red dot goes away on every device. */
  markActivitySeen: () => void;
  notice: string | null;
  notify: (message: string) => void;
}

const GroupDataContext = createContext<GroupData | null>(null);

export function useGroupData(): GroupData {
  const data = useContext(GroupDataContext);
  if (!data) throw new Error("useGroupData is used outside GroupDataProvider");
  return data;
}

interface GroupDataProviderProps extends AccountActions {
  account: Account;
  session: Session;
  startNotice?: string;
  children: ReactNode;
}

/** Loads the open group's ratings once, for every page to share. */
export function GroupDataProvider({ account, session, startNotice, children, ...actions }: GroupDataProviderProps) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [here, setHere] = useState<Coordinates | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(startNotice ?? null);

  const reloadEntries = useCallback(() => {
    setLoadError(null);
    api.fetchEntries().then(setEntries, (failure: unknown) => {
      setLoadError(failure instanceof Error ? failure.message : "Could not load your group's ratings.");
    });
  }, []);
  useEffect(reloadEntries, [reloadEntries, session.group.id]);

  // Picks up friends' new ratings and reactions without a reload: when you come back to the app, and every
  // few minutes while it is open. A failed check is silent; the ratings already shown stay.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") api.fetchEntries().then(setEntries, () => undefined);
    };
    const timer = window.setInterval(refresh, REFRESH_MILLISECONDS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [session.group.id]);

  const [saved, setSaved] = useState<SavedPlace[] | null>(null);
  useEffect(() => {
    // Without the list, places just show as not saved; the feed still works.
    api.fetchSaved().then(setSaved, () => setSaved([]));
  }, [session.group.id]);

  useEffect(() => {
    let cancelled = false;
    void findCurrentLocation().then((found) => {
      if (!cancelled) setHere(found);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MILLISECONDS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const places = useMemo(() => summarizePlaces(entries ?? []), [entries]);
  const pins = useMemo(() => pinsFromPlaces(places), [places]);

  const myId = session.member.id;
  const activity = useMemo(() => buildActivity(entries ?? [], myId), [entries, myId]);
  const [activitySeenAt, setActivitySeenAt] = useState(session.activitySeenAt);
  useEffect(() => setActivitySeenAt(session.activitySeenAt), [session.activitySeenAt]);

  const markActivitySeen = useCallback(() => {
    setActivitySeenAt(new Date().toISOString());
    // If this fails the dot is only gone here; it comes back after a reload, which is harmless.
    api.markActivitySeen().then((result) => setActivitySeenAt(result.activitySeenAt), () => undefined);
  }, []);
  const isSaved = (placeId: string) => saved?.some((item) => item.placeId === placeId && item.memberId === myId) ?? false;

  /** Updates the list right away, and puts it back if the server says no. */
  function toggleSaved(placeId: string) {
    const before = saved ?? [];
    const removing = isSaved(placeId);
    setSaved(
      removing
        ? before.filter((item) => !(item.placeId === placeId && item.memberId === myId))
        : [{ placeId, memberId: myId, savedAt: new Date().toISOString() }, ...before],
    );
    (removing ? api.unsavePlace(placeId) : api.savePlace(placeId)).catch((failure: unknown) => {
      setSaved(before);
      setNotice(failure instanceof Error ? failure.message : "Could not update your list.");
    });
  }

  function toggleReaction(entry: Entry, reaction: ReactionId) {
    const before = entry.reactions;
    const removing = before.some((item) => item.reaction === reaction && item.member.id === myId);
    const me = { id: myId, name: session.member.name, avatar: account.user.avatar };
    const setReactions = (reactions: Entry["reactions"]) =>
      setEntries((current) => current?.map((candidate) => (candidate.id === entry.id ? { ...candidate, reactions } : candidate)) ?? null);
    setReactions(
      removing
        ? before.filter((item) => !(item.reaction === reaction && item.member.id === myId))
        : [...before, { reaction, createdAt: new Date().toISOString(), member: me }],
    );
    (removing ? api.unreact(entry.id, reaction) : api.react(entry.id, reaction)).catch((failure: unknown) => {
      setReactions(before);
      setNotice(failure instanceof Error ? failure.message : "Could not save your reaction.");
    });
  }

  const value: GroupData = {
    ...actions,
    account,
    session,
    entries,
    loadError,
    reloadEntries,
    places,
    pins,
    here,
    addEntry: (entry) => setEntries((current) => [entry, ...(current ?? [])]),
    async removeEntry(entry) {
      try {
        await api.deleteEntry(entry.id);
        setEntries((current) => current?.filter((candidate) => candidate.id !== entry.id) ?? null);
      } catch (failure) {
        setNotice(failure instanceof Error ? failure.message : "Could not delete that.");
      }
    },
    async editEntry(entry, changes) {
      const edited = await api.updateEntry(entry.id, changes);
      setEntries((current) => current?.map((candidate) => (candidate.id === edited.id ? edited : candidate)) ?? null);
    },
    async setPlaceCuisine(placeId, cuisine) {
      await api.setCuisine(placeId, cuisine);
      setEntries(
        (current) =>
          current?.map((entry) => (entry.place.id === placeId ? { ...entry, place: { ...entry.place, cuisine } } : entry)) ?? null,
      );
    },
    saved,
    isSaved,
    wantToGoBy: (placeId) =>
      session.members.filter((member) =>
        saved?.some(
          (item) => item.placeId === placeId && item.memberId === member.id && !visitAfterSaving(entries ?? [], item),
        ),
      ),
    toggleSaved,
    toggleReaction,
    activity,
    activitySeenAt,
    newActivityCount: countNew(activity, activitySeenAt),
    markActivitySeen,
    notice,
    notify: setNotice,
  };
  return <GroupDataContext.Provider value={value}>{children}</GroupDataContext.Provider>;
}

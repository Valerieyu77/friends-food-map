const ACCOUNT_KEY = "friends-food-map.account";
const OPEN_GROUP_KEY = "friends-food-map.open-group";
// Before accounts (until 2026-11-03), each browser kept one sign-in per group under these keys.
const OLD_TOKEN_KEY = "friends-food-map.token";
const OLD_GROUPS_KEY = "friends-food-map.groups";

type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// Browser storage can be blocked (private windows); the app then asks you to log in again next visit.
function browserStorage(): KeyValueStore | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function read(key: string, storage: KeyValueStore | null): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null, storage: KeyValueStore | null): void {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch {
    // Nothing to do: the sign-in still works until the page is closed.
  }
}

export function loadAccountToken(storage = browserStorage()): string | null {
  return read(ACCOUNT_KEY, storage);
}

export function saveAccountToken(token: string | null, storage = browserStorage()): void {
  write(ACCOUNT_KEY, token, storage);
}

export function loadOpenGroup(storage = browserStorage()): string | null {
  return read(OPEN_GROUP_KEY, storage);
}

export function saveOpenGroup(groupId: string | null, storage = browserStorage()): void {
  write(OPEN_GROUP_KEY, groupId, storage);
}

/** The group sign-ins this browser kept from before accounts, handed to the server at the first log in. */
export function oldSignIns(storage = browserStorage()): string[] {
  const tokens = new Set<string>();
  const single = read(OLD_TOKEN_KEY, storage);
  if (single) tokens.add(single);
  try {
    const saved: unknown = JSON.parse(read(OLD_GROUPS_KEY, storage) ?? "[]");
    if (Array.isArray(saved)) {
      for (const group of saved) if (typeof group?.token === "string") tokens.add(group.token);
    }
  } catch {
    // A damaged list has nothing worth keeping.
  }
  return [...tokens];
}

export function clearOldSignIns(storage = browserStorage()): void {
  write(OLD_TOKEN_KEY, null, storage);
  write(OLD_GROUPS_KEY, null, storage);
}

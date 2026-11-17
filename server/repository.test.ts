import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { InputError, NameTakenError, createRepository } from "./repository.js";
import type { Database } from "./repository.js";

/** A fresh Postgres in memory for each test, so tests never touch the real Supabase data. */
function memoryDatabase(): Database {
  const pglite = new PGlite();
  return { query: async <Row>(text: string, params?: unknown[]) => (await pglite.query<Row>(text, params)).rows };
}

let database: Database;

function newRepository() {
  database = memoryDatabase();
  return createRepository(database, (photoFile) => `https://photos.test/${photoFile}`);
}

const girlAndGoat = { osmKey: "node1", name: "Girl & The Goat", address: "809 West Randolph Street", city: "Chicago" };

async function setup() {
  const repository = newRepository();
  const valerie = await repository.createUser("user-valerie", "Valerie");
  const mia = await repository.createUser("user-mia", "Mia");
  const { group } = await repository.createGroup("Chicago trip", valerie);
  await repository.joinGroup(group.inviteCode, mia);
  const valerieSession = (await repository.sessionFor(valerie.id, group.id))!;
  const miaSession = (await repository.sessionFor(mia.id, group.id))!;
  return { repository, group, valerie, mia, valerieSession, miaSession };
}

/** A member from before accounts existed: joined with only a name, so no account owns them yet. */
async function addMemberWithoutAccount(groupId: string, name: string) {
  const member = { id: `member-${name}`, name };
  const token = `old-token-${name}`;
  await database.query("INSERT INTO members (id, group_id, name, token, created_at) VALUES ($1, $2, $3, $4, $5)", [
    member.id,
    groupId,
    name,
    token,
    new Date().toISOString(),
  ]);
  return { member, token };
}

describe("accounts", () => {
  it("keeps you signed in with a sign-in token until you log out", async () => {
    const repository = newRepository();
    const valerie = await repository.createUser("user-valerie", " Valerie ");
    const token = await repository.startUserSession(valerie.id);
    expect(await repository.userForToken(token)).toEqual({ id: "user-valerie", name: "Valerie" });
    await repository.endUserSession(token);
    expect(await repository.userForToken(token)).toBeUndefined();
  });

  it("rejects an empty name", async () => {
    await expect(newRepository().createUser("user-x", "  ")).rejects.toThrow(InputError);
  });

  it("lists every group of an account, on any device, and no one else's", async () => {
    const { repository, valerie, mia } = await setup();
    await repository.createGroup("Roommates", valerie);
    expect((await repository.groupsForUser(valerie.id)).map((group) => [group.name, group.memberCount])).toEqual([
      ["Chicago trip", 2],
      ["Roommates", 1],
    ]);
    expect((await repository.groupsForUser(mia.id)).map((group) => group.name)).toEqual(["Chicago trip"]);
  });

  it("opens a group only for its members", async () => {
    const { repository, group, valerie } = await setup();
    expect((await repository.sessionFor(valerie.id, group.id))!.members.map((member) => member.name)).toEqual(["Valerie", "Mia"]);
    const stranger = await repository.createUser("user-sam", "Sam");
    expect(await repository.sessionFor(stranger.id, group.id)).toBeUndefined();
  });
});

describe("profile", () => {
  it("saves a new name and avatar, and shows them to the group", async () => {
    const { repository, group, valerie } = await setup();
    const { user, keptOldName } = await repository.updateProfile(valerie.id, { name: "Val", avatar: "sticker:bubble_tea" });
    expect(user).toEqual({ id: valerie.id, name: "Val", avatar: "sticker:bubble_tea" });
    expect(keptOldName).toEqual([]);
    const session = (await repository.sessionFor(valerie.id, group.id))!;
    expect(session.member).toEqual({ id: session.member.id, name: "Val", avatar: "sticker:bubble_tea" });
    expect(session.members.map((member) => member.name)).toEqual(["Val", "Mia"]);
  });

  it("shows the avatar on that person's ratings", async () => {
    const { repository, group, valerie, valerieSession } = await setup();
    await repository.updateProfile(valerie.id, { name: "Valerie", avatar: "color:sage" });
    await repository.addEntry({ groupId: group.id, memberId: valerieSession.member.id, place: girlAndGoat, rating: 9, note: "" });
    expect((await repository.listEntries(group.id))[0].member).toMatchObject({ name: "Valerie", avatar: "color:sage" });
  });

  it("keeps the old name in a group where someone else already has the new one", async () => {
    const { repository, group, valerie } = await setup();
    await repository.createGroup("Roommates", valerie);
    const { keptOldName } = await repository.updateProfile(valerie.id, { name: "mia", avatar: null });
    expect(keptOldName).toEqual(["Chicago trip"]);
    expect((await repository.sessionFor(valerie.id, group.id))!.member.name).toBe("Valerie");
    expect((await repository.findUser(valerie.id))!.name).toBe("mia");
  });

  it("rejects an empty name and an avatar that is not offered", async () => {
    const { repository, valerie } = await setup();
    await expect(repository.updateProfile(valerie.id, { name: " ", avatar: null })).rejects.toThrow(InputError);
    await expect(repository.updateProfile(valerie.id, { name: "Val", avatar: "sticker:skull" })).rejects.toThrow(InputError);
  });
});

describe("group management", () => {
  it("makes whoever started the group its owner, who alone can rename it", async () => {
    const { repository, group, valerie, valerieSession, miaSession } = await setup();
    expect(valerieSession.ownerMemberId).toBe(valerieSession.member.id);
    await repository.renameGroup(group.id, valerieSession.member.id, "Chicago in December");
    expect((await repository.groupsForUser(valerie.id)).map((listed) => listed.name)).toEqual(["Chicago in December"]);
    await expect(repository.renameGroup(group.id, miaSession.member.id, "Mia's group")).rejects.toThrow(InputError);
    await expect(repository.renameGroup(group.id, valerieSession.member.id, "  ")).rejects.toThrow(InputError);
  });

  it("lets you leave a group: it disappears from your list, and your ratings stay for the others", async () => {
    const { repository, group, mia, miaSession, valerie } = await setup();
    await repository.addEntry({ groupId: group.id, memberId: miaSession.member.id, place: girlAndGoat, rating: 8, note: "" });
    await repository.leaveGroup(group.id, miaSession.member.id);
    expect(await repository.groupsForUser(mia.id)).toEqual([]);
    expect(await repository.sessionFor(mia.id, group.id)).toBeUndefined();
    const valerieView = (await repository.sessionFor(valerie.id, group.id))!;
    expect(valerieView.members.map((member) => member.name)).toEqual(["Valerie"]);
    expect((await repository.listEntries(group.id))[0].member.name).toBe("Mia");
  });

  it("brings you back as the same member, with your ratings, when you rejoin from the invite", async () => {
    const { repository, group, mia, miaSession } = await setup();
    await repository.leaveGroup(group.id, miaSession.member.id);
    await repository.joinGroup(group.inviteCode, mia);
    expect((await repository.sessionFor(mia.id, group.id))!.member.id).toBe(miaSession.member.id);
  });

  it("passes ownership to the next person who joined when the owner leaves", async () => {
    const { repository, group, mia, valerieSession, miaSession } = await setup();
    await repository.leaveGroup(group.id, valerieSession.member.id);
    expect((await repository.sessionFor(mia.id, group.id))!.ownerMemberId).toBe(miaSession.member.id);
  });

  it("lets only the owner remove someone else", async () => {
    const { repository, group, mia, valerieSession, miaSession } = await setup();
    await expect(repository.removeMember(group.id, miaSession.member.id, valerieSession.member.id)).rejects.toThrow(InputError);
    await expect(repository.removeMember(group.id, valerieSession.member.id, valerieSession.member.id)).rejects.toThrow(InputError);
    await repository.removeMember(group.id, valerieSession.member.id, miaSession.member.id);
    expect(await repository.sessionFor(mia.id, group.id)).toBeUndefined();
  });

  it("lets the owner replace the invite link, so the old one stops working", async () => {
    const { repository, group, valerieSession, miaSession } = await setup();
    await expect(repository.newInviteCode(group.id, miaSession.member.id)).rejects.toThrow(InputError);
    const code = await repository.newInviteCode(group.id, valerieSession.member.id);
    expect(code).not.toBe(group.inviteCode);
    expect(await repository.previewInvite(group.inviteCode)).toBeUndefined();
    expect((await repository.previewInvite(code))!.groupName).toBe("Chicago trip");
  });
});

describe("groups and invites", () => {
  it("describes the group for an invite link's preview: who is in it, how many places, and its newest photo", async () => {
    const { repository, group, valerieSession, miaSession } = await setup();
    const empty = (await repository.previewInvite(group.inviteCode))!;
    expect(empty.placeCount).toBe(0);
    expect(empty.coverPhotoUrl).toBeUndefined();

    await repository.addEntry({ groupId: group.id, memberId: valerieSession.member.id, place: girlAndGoat, rating: 9, note: "", photoFiles: ["old.jpg"] });
    await repository.addEntry({ groupId: group.id, memberId: miaSession.member.id, place: girlAndGoat, rating: 8, note: "" });
    const preview = (await repository.previewInvite(group.inviteCode))!;
    expect(preview.memberNames).toEqual(["Valerie", "Mia"]);
    expect(preview.placeCount).toBe(1);
    expect(preview.coverPhotoUrl).toBe("https://photos.test/old.jpg");
  });

  it("lets a friend join with the invite code under their account name", async () => {
    const { miaSession } = await setup();
    expect(miaSession.group.name).toBe("Chicago trip");
    expect(miaSession.member.name).toBe("Mia");
  });

  it("joining a group you are already in just opens it", async () => {
    const { repository, group, mia } = await setup();
    expect((await repository.joinGroup(group.inviteCode, mia))!.group.id).toBe(group.id);
    expect((await repository.sessionFor(mia.id, group.id))!.members).toHaveLength(2);
  });

  it("rejects an unknown invite code and a name someone else's account already uses", async () => {
    const { repository, group } = await setup();
    const otherMia = await repository.createUser("user-mia-2", "mia");
    expect(await repository.joinGroup("nope", otherMia)).toBeUndefined();
    await expect(repository.joinGroup(group.inviteCode, otherMia)).rejects.toThrow(NameTakenError);
  });

  it("lets a friend from before accounts claim their old name, keeping their ratings", async () => {
    const { repository, group } = await setup();
    const { member: oldMember } = await addMemberWithoutAccount(group.id, "Ana");
    await repository.addEntry({ groupId: group.id, memberId: oldMember.id, place: girlAndGoat, rating: 9, note: "" });
    expect((await repository.previewInvite(group.inviteCode))!.unclaimedNames).toEqual(["Ana"]);

    const ana = await repository.createUser("user-ana", "Ana Lopez");
    await repository.claimMember(group.inviteCode, ana, "ana");
    const session = (await repository.sessionFor(ana.id, group.id))!;
    expect(session.member).toEqual(oldMember);
    expect((await repository.listEntries(group.id))[0].member.name).toBe("Ana");
    expect((await repository.previewInvite(group.inviteCode))!.unclaimedNames).toEqual([]);
    await expect(repository.claimMember(group.inviteCode, ana, "Valerie")).rejects.toThrow(InputError);
  });

  it("joining with the same name as an unclaimed old member claims that member", async () => {
    const { repository, group } = await setup();
    const { member: oldMember } = await addMemberWithoutAccount(group.id, "Ana");
    const ana = await repository.createUser("user-ana", "ANA");
    await repository.joinGroup(group.inviteCode, ana);
    expect((await repository.sessionFor(ana.id, group.id))!.member).toEqual(oldMember);
  });

  it("attaches the groups a browser remembered to the account that logs in there", async () => {
    const repository = newRepository();
    const firstGroup = (await repository.createGroup("Chicago trip", await repository.createUser("user-valerie", "Valerie"))).group;
    const old = await addMemberWithoutAccount(firstGroup.id, "Mia");
    const mia = await repository.createUser("user-mia", "Mia");
    expect(await repository.claimMemberTokens(mia, [old.token, "not-a-token"])).toBe(1);
    expect((await repository.groupsForUser(mia.id)).map((group) => group.name)).toEqual(["Chicago trip"]);
    const someoneElse = await repository.createUser("user-sam", "Sam");
    expect(await repository.claimMemberTokens(someoneElse, [old.token])).toBe(0);
  });

  it("rejects an empty group name without leaving an empty group behind", async () => {
    const repository = newRepository();
    const valerie = await repository.createUser("user-valerie", "Valerie");
    await expect(repository.createGroup("  ", valerie)).rejects.toThrow(InputError);
    expect(await repository.touch()).toBe(0);
  });
});

describe("entries", () => {
  it("shows a friend's entry, with its photo address, to everyone in the group", async () => {
    const { repository, valerieSession: valerie, miaSession: friendSession } = await setup();
    await repository.addEntry({
      groupId: valerie.group.id,
      memberId: valerie.member.id,
      place: girlAndGoat,
      rating: 9,
      note: "Get the goat empanadas",
      photoFiles: ["abc.jpg"],
    });
    const seenByFriend = await repository.listEntries(friendSession.group.id);
    expect(seenByFriend).toHaveLength(1);
    expect(seenByFriend[0]).toMatchObject({
      rating: 9,
      photoUrls: ["https://photos.test/abc.jpg"],
      place: { name: "Girl & The Goat" },
      member: { name: "Valerie" },
    });
  });

  it("keeps other groups' entries private", async () => {
    const { repository, valerieSession: valerie } = await setup();
    await repository.addEntry({ groupId: valerie.group.id, memberId: valerie.member.id, place: girlAndGoat, rating: 8, note: "" });
    const stranger = await repository.createGroup("Other friends", await repository.createUser("user-sam", "Sam"));
    expect(await repository.listEntries(stranger.group.id)).toEqual([]);
  });

  it("reuses one place when two friends rate the same restaurant", async () => {
    const { repository, valerieSession: valerie, miaSession: friendSession } = await setup();
    await repository.addEntry({ groupId: valerie.group.id, memberId: valerie.member.id, place: girlAndGoat, rating: 9, note: "" });
    await repository.addEntry({ groupId: valerie.group.id, memberId: friendSession.member.id, place: girlAndGoat, rating: 6, note: "" });
    const [first, second] = await repository.listEntries(valerie.group.id);
    expect(first.place.id).toBe(second.place.id);
  });

  it("rejects a score outside 1 to 10", async () => {
    const { repository, valerieSession: valerie } = await setup();
    for (const rating of [0, 11, 7.5, "9"]) {
      await expect(
        repository.addEntry({ groupId: valerie.group.id, memberId: valerie.member.id, place: girlAndGoat, rating, note: "" }),
      ).rejects.toThrow(InputError);
    }
  });

  it("lets only the author delete an entry", async () => {
    const { repository, valerieSession: valerie, miaSession: friendSession } = await setup();
    const entry = await repository.addEntry({
      groupId: valerie.group.id,
      memberId: valerie.member.id,
      place: girlAndGoat,
      rating: 9,
      note: "",
    });
    expect((await repository.deleteEntry(entry.id, friendSession.member.id)).deleted).toBe(false);
    expect((await repository.deleteEntry(entry.id, valerie.member.id)).deleted).toBe(true);
    expect(await repository.listEntries(valerie.group.id)).toEqual([]);
  });

  it("lets the author change their score and note, keeping the entry, its time and its photo", async () => {
    const { repository, valerieSession: valerie, miaSession: friendSession } = await setup();
    const entry = await repository.addEntry({
      groupId: valerie.group.id,
      memberId: valerie.member.id,
      place: girlAndGoat,
      rating: 7,
      note: "Fine",
      photoFiles: ["abc.jpg"],
    });
    const edited = await repository.updateEntry(entry.id, valerie.member.id, { rating: 9, note: "Better the second time" });
    expect(edited).toMatchObject({
      id: entry.id,
      createdAt: entry.createdAt,
      rating: 9,
      note: "Better the second time",
      photoUrls: ["https://photos.test/abc.jpg"],
    });
    expect(edited?.editedAt).toBeDefined();
    const seenByFriend = await repository.listEntries(friendSession.group.id);
    expect(seenByFriend).toHaveLength(1);
    expect(seenByFriend[0]).toMatchObject({ rating: 9, note: "Better the second time" });
  });

  it("lets only the author edit an entry", async () => {
    const { repository, valerieSession: valerie, miaSession: friendSession } = await setup();
    const entry = await repository.addEntry({ groupId: valerie.group.id, memberId: valerie.member.id, place: girlAndGoat, rating: 7, note: "" });
    expect(await repository.updateEntry(entry.id, friendSession.member.id, { rating: 1, note: "" })).toBeUndefined();
    const [unchanged] = await repository.listEntries(valerie.group.id);
    expect(unchanged.rating).toBe(7);
    expect(unchanged.editedAt).toBeUndefined();
  });

  it("rejects an edit with a score outside 1 to 10, and clears an emptied note", async () => {
    const { repository, valerieSession: valerie } = await setup();
    const entry = await repository.addEntry({ groupId: valerie.group.id, memberId: valerie.member.id, place: girlAndGoat, rating: 7, note: "Fine" });
    for (const rating of [0, 11, 7.5, "9"]) {
      await expect(repository.updateEntry(entry.id, valerie.member.id, { rating, note: "" })).rejects.toThrow(InputError);
    }
    expect((await repository.updateEntry(entry.id, valerie.member.id, { rating: 8, note: "   " }))?.note).toBeUndefined();
  });

  it("keeps the price and whether you would go again, and leaves them out when skipped", async () => {
    const { repository, valerieSession: valerie, miaSession: friendSession } = await setup();
    const base = { groupId: valerie.group.id, place: girlAndGoat, rating: 8, note: "" };
    await repository.addEntry({ ...base, memberId: valerie.member.id, price: 2, wouldReturn: true });
    await repository.addEntry({ ...base, memberId: friendSession.member.id });
    const [skipped, answered] = await repository.listEntries(valerie.group.id);
    expect(answered).toMatchObject({ price: 2, wouldReturn: true });
    expect(skipped.price).toBeUndefined();
    expect(skipped.wouldReturn).toBeUndefined();
  });

  it("rejects a price outside $ to $$$$, and a go-again answer that is not yes or no", async () => {
    const { repository, valerieSession: valerie } = await setup();
    const base = { groupId: valerie.group.id, memberId: valerie.member.id, place: girlAndGoat, rating: 8, note: "" };
    for (const price of [0, 5, 2.5, "2"]) {
      await expect(repository.addEntry({ ...base, price })).rejects.toThrow(InputError);
    }
    await expect(repository.addEntry({ ...base, wouldReturn: "yes" })).rejects.toThrow(InputError);
  });

  it("keeps a typed price and works out its level, whatever level came with it", async () => {
    const { repository, valerieSession: valerie } = await setup();
    const base = { groupId: valerie.group.id, memberId: valerie.member.id, place: girlAndGoat, rating: 8, note: "" };
    const entry = await repository.addEntry({ ...base, price: 1, priceAmount: 45 });
    expect(entry).toMatchObject({ price: 3, priceAmount: 45 });
    const picked = await repository.updateEntry(entry.id, valerie.member.id, { rating: 8, note: "", price: 2, priceAmount: null });
    expect(picked).toMatchObject({ price: 2 });
    expect(picked?.priceAmount).toBeUndefined();
    for (const priceAmount of [0, 1000, 12.5, "12"]) {
      await expect(repository.addEntry({ ...base, priceAmount })).rejects.toThrow(InputError);
    }
  });

  it("changes or clears the price and go-again answer when editing", async () => {
    const { repository, valerieSession: valerie } = await setup();
    const entry = await repository.addEntry({
      groupId: valerie.group.id,
      memberId: valerie.member.id,
      place: girlAndGoat,
      rating: 8,
      note: "",
      price: 1,
      wouldReturn: true,
    });
    const changed = await repository.updateEntry(entry.id, valerie.member.id, { rating: 8, note: "", price: 3, wouldReturn: false });
    expect(changed).toMatchObject({ price: 3, wouldReturn: false });
    const cleared = await repository.updateEntry(entry.id, valerie.member.id, { rating: 8, note: "", price: null, wouldReturn: null });
    expect(cleared?.price).toBeUndefined();
    expect(cleared?.wouldReturn).toBeUndefined();
  });

  it("keeps the dishes of a rating, each with its own score, in the order given", async () => {
    const { repository, valerieSession: valerie, miaSession: friendSession } = await setup();
    await repository.addEntry({
      groupId: valerie.group.id,
      memberId: valerie.member.id,
      place: girlAndGoat,
      rating: 8,
      note: "",
      dishes: [
        { name: "  Goat empanadas ", rating: 9 },
        { name: "Wood oven pig face", rating: 7 },
      ],
    });
    await repository.addEntry({ groupId: valerie.group.id, memberId: friendSession.member.id, place: girlAndGoat, rating: 6, note: "" });
    const [withoutDishes, withDishes] = await repository.listEntries(valerie.group.id);
    expect(withDishes.dishes).toEqual([
      { name: "Goat empanadas", rating: 9 },
      { name: "Wood oven pig face", rating: 7 },
    ]);
    expect(withoutDishes.dishes).toEqual([]);
  });

  it("rejects a dish with no name, a score outside 1 to 10, or too many dishes", async () => {
    const { repository, valerieSession: valerie } = await setup();
    const add = (dishes: unknown) =>
      repository.addEntry({ groupId: valerie.group.id, memberId: valerie.member.id, place: girlAndGoat, rating: 8, note: "", dishes });
    await expect(add([{ name: "  ", rating: 8 }])).rejects.toThrow(InputError);
    await expect(add([{ name: "Fries", rating: 11 }])).rejects.toThrow(InputError);
    await expect(add([{ name: "Fries" }])).rejects.toThrow(InputError);
    await expect(add("Fries")).rejects.toThrow(InputError);
    await expect(add(Array.from({ length: 21 }, (_, index) => ({ name: `Dish ${index}`, rating: 5 })))).rejects.toThrow(InputError);
    expect(await repository.listEntries(valerie.group.id)).toEqual([]);
  });

  it("replaces the dishes when editing, and keeps them when an edit leaves dishes out", async () => {
    const { repository, valerieSession: valerie } = await setup();
    const entry = await repository.addEntry({
      groupId: valerie.group.id,
      memberId: valerie.member.id,
      place: girlAndGoat,
      rating: 8,
      note: "",
      dishes: [{ name: "Fries", rating: 6 }],
    });
    const kept = await repository.updateEntry(entry.id, valerie.member.id, { rating: 9, note: "" });
    expect(kept?.dishes).toEqual([{ name: "Fries", rating: 6 }]);
    const replaced = await repository.updateEntry(entry.id, valerie.member.id, { rating: 9, note: "", dishes: [{ name: "Pie", rating: 10 }] });
    expect(replaced?.dishes).toEqual([{ name: "Pie", rating: 10 }]);
    const cleared = await repository.updateEntry(entry.id, valerie.member.id, { rating: 9, note: "", dishes: [] });
    expect(cleared?.dishes).toEqual([]);
  });

  it("deletes a rating together with its dishes", async () => {
    const { repository, valerieSession: valerie } = await setup();
    const entry = await repository.addEntry({
      groupId: valerie.group.id,
      memberId: valerie.member.id,
      place: girlAndGoat,
      rating: 8,
      note: "",
      dishes: [{ name: "Fries", rating: 6 }],
    });
    expect((await repository.deleteEntry(entry.id, valerie.member.id)).deleted).toBe(true);
    expect(await database.query("SELECT * FROM dishes", [])).toEqual([]);
  });

  it("keeps up to four photos of a rating, in order, and refuses a fifth", async () => {
    const { repository, valerieSession: valerie } = await setup();
    const base = { groupId: valerie.group.id, memberId: valerie.member.id, place: girlAndGoat, rating: 8, note: "" };
    const entry = await repository.addEntry({ ...base, photoFiles: ["1.jpg", "2.jpg", "3.jpg"] });
    expect(entry.photoUrls).toEqual(["https://photos.test/1.jpg", "https://photos.test/2.jpg", "https://photos.test/3.jpg"]);
    await expect(repository.addEntry({ ...base, photoFiles: ["a", "b", "c", "d", "e"] })).rejects.toThrow(InputError);
    expect(await repository.listEntries(valerie.group.id)).toHaveLength(1);
  });

  it("keeps the photos you chose when editing, adds new ones after them, and says which were removed", async () => {
    const { repository, valerieSession: valerie, miaSession: friendSession } = await setup();
    const entry = await repository.addEntry({
      groupId: valerie.group.id,
      memberId: valerie.member.id,
      place: girlAndGoat,
      rating: 8,
      note: "",
      photoFiles: ["1.jpg", "2.jpg", "3.jpg"],
    });
    expect(await repository.setPhotos(entry.id, friendSession.member.id, [], [])).toBeUndefined();
    const result = await repository.setPhotos(
      entry.id,
      valerie.member.id,
      ["https://photos.test/3.jpg", "https://photos.test/1.jpg"],
      ["4.jpg"],
    );
    expect(result?.entry.photoUrls).toEqual(["https://photos.test/3.jpg", "https://photos.test/1.jpg", "https://photos.test/4.jpg"]);
    expect(result?.removedPhotoFiles).toEqual(["2.jpg"]);
    await expect(
      repository.setPhotos(entry.id, valerie.member.id, result!.entry.photoUrls, ["5.jpg", "6.jpg"]),
    ).rejects.toThrow(InputError);
    const cleared = await repository.setPhotos(entry.id, valerie.member.id, [], []);
    expect(cleared?.entry.photoUrls).toEqual([]);
    expect(cleared?.removedPhotoFiles).toEqual(["3.jpg", "1.jpg", "4.jpg"]);
  });

  it("gives back every photo file of a deleted rating, so they can be removed from storage", async () => {
    const { repository, valerieSession: valerie } = await setup();
    const entry = await repository.addEntry({
      groupId: valerie.group.id,
      memberId: valerie.member.id,
      place: girlAndGoat,
      rating: 8,
      note: "",
      photoFiles: ["1.jpg", "2.jpg"],
    });
    expect(await repository.deleteEntry(entry.id, valerie.member.id)).toEqual({ deleted: true, photoFiles: ["1.jpg", "2.jpg"] });
    expect(await database.query("SELECT * FROM entry_photos", [])).toEqual([]);
  });

  it("remembers the cuisine picked for a place, and the newest pick wins", async () => {
    const { repository, valerieSession: valerie, miaSession: friendSession } = await setup();
    const add = (memberId: string, cuisine?: string) =>
      repository.addEntry({ groupId: valerie.group.id, memberId, place: girlAndGoat, rating: 8, note: "", cuisine });
    expect((await add(valerie.member.id, "italian")).place.cuisine).toBe("italian");
    expect((await add(friendSession.member.id)).place.cuisine).toBe("italian");
    expect((await add(friendSession.member.id, "american")).place.cuisine).toBe("american");
    await expect(add(valerie.member.id, "martian")).rejects.toThrow(InputError);
  });

  it("lets the group add a cuisine to a place rated before cuisines existed", async () => {
    const { repository, valerieSession: valerie } = await setup();
    const entry = await repository.addEntry({ groupId: valerie.group.id, memberId: valerie.member.id, place: girlAndGoat, rating: 9, note: "" });
    expect(entry.place.cuisine).toBeUndefined();
    expect(await repository.setCuisine(valerie.group.id, entry.place.id, "american")).toBe(true);
    expect((await repository.listEntries(valerie.group.id))[0].place.cuisine).toBe("american");
    const stranger = await repository.createGroup("Other friends", await repository.createUser("user-sam", "Sam"));
    expect(await repository.setCuisine(stranger.group.id, entry.place.id, "chinese")).toBe(false);
  });

  it("adds a review to a place the group already has, by its id", async () => {
    const { repository, valerieSession: valerie, miaSession: mia } = await setup();
    const first = await repository.addEntry({ groupId: valerie.group.id, memberId: valerie.member.id, place: girlAndGoat, rating: 9, note: "" });
    const again = await repository.addEntry({
      groupId: mia.group.id,
      memberId: mia.member.id,
      place: { id: first.place.id, name: first.place.name },
      rating: 7,
      note: "",
    });
    expect(again.place).toEqual(first.place);
  });

  it("accepts a place typed by hand with no coordinates", async () => {
    const { repository, valerieSession: valerie } = await setup();
    const entry = await repository.addEntry({
      groupId: valerie.group.id,
      memberId: valerie.member.id,
      place: { name: "Zorba's", city: "Champaign" },
      rating: 7,
      note: "",
    });
    expect(entry.place).toMatchObject({ name: "Zorba's", city: "Champaign" });
    expect(entry.place.lat).toBeUndefined();
  });
});

describe("want to go", () => {
  async function ratedPlace() {
    const context = await setup();
    const { repository, valerieSession: valerie } = context;
    const entry = await repository.addEntry({ groupId: valerie.group.id, memberId: valerie.member.id, place: girlAndGoat, rating: 9, note: "" });
    return { ...context, placeId: entry.place.id };
  }

  it("saves a place the group rated, once, and the whole group sees who wants to go", async () => {
    const { repository, valerieSession: valerie, miaSession: mia, placeId } = await ratedPlace();
    expect(await repository.savePlaceFor(mia.group.id, mia.member.id, placeId)).toBe(true);
    expect(await repository.savePlaceFor(mia.group.id, mia.member.id, placeId)).toBe(true);
    const saved = await repository.listSaved(valerie.group.id);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ placeId, memberId: mia.member.id });
  });

  it("only saves places this group has rated", async () => {
    const { repository, valerieSession: valerie, placeId } = await ratedPlace();
    expect(await repository.savePlaceFor(valerie.group.id, valerie.member.id, "no-such-place")).toBe(false);
    const sam = await repository.createUser("user-sam", "Sam");
    const stranger = await repository.createGroup("Other friends", sam);
    const samSession = (await repository.sessionFor(sam.id, stranger.group.id))!;
    expect(await repository.savePlaceFor(stranger.group.id, samSession.member.id, placeId)).toBe(false);
    expect(await repository.listSaved(stranger.group.id)).toEqual([]);
  });

  it("removes a place only from your own list", async () => {
    const { repository, valerieSession: valerie, miaSession: mia, placeId } = await ratedPlace();
    await repository.savePlaceFor(valerie.group.id, valerie.member.id, placeId);
    await repository.savePlaceFor(mia.group.id, mia.member.id, placeId);
    await repository.unsavePlaceFor(mia.member.id, placeId);
    expect((await repository.listSaved(valerie.group.id)).map((saved) => saved.memberId)).toEqual([valerie.member.id]);
  });

  it("stops listing someone who left the group", async () => {
    const { repository, valerieSession: valerie, miaSession: mia, placeId } = await ratedPlace();
    await repository.savePlaceFor(mia.group.id, mia.member.id, placeId);
    await repository.leaveGroup(mia.group.id, mia.member.id);
    expect(await repository.listSaved(valerie.group.id)).toEqual([]);
  });
});

describe("reactions", () => {
  async function valeriesRating() {
    const context = await setup();
    const { repository, valerieSession: valerie } = context;
    const entry = await repository.addEntry({ groupId: valerie.group.id, memberId: valerie.member.id, place: girlAndGoat, rating: 9, note: "" });
    return { ...context, entry };
  }

  async function reactionsOn(repository: Awaited<ReturnType<typeof setup>>["repository"], groupId: string, entryId: string) {
    const entries = await repository.listEntries(groupId);
    return entries.find((entry) => entry.id === entryId)!.reactions.map((item) => [item.reaction, item.member.name]);
  }

  it("lets a friend add several different reactions, once each, and everyone sees them with names", async () => {
    const { repository, valerieSession: valerie, miaSession: mia, entry } = await valeriesRating();
    expect(await repository.react(mia.group.id, mia.member.id, entry.id, "yum")).toBe("added");
    expect(await repository.react(mia.group.id, mia.member.id, entry.id, "yum")).toBe("already");
    expect(await repository.react(mia.group.id, mia.member.id, entry.id, "fire")).toBe("added");
    expect(await reactionsOn(repository, valerie.group.id, entry.id)).toEqual([
      ["yum", "Mia"],
      ["fire", "Mia"],
    ]);
  });

  it("takes back only the reaction you tap again", async () => {
    const { repository, valerieSession: valerie, miaSession: mia, entry } = await valeriesRating();
    await repository.react(mia.group.id, mia.member.id, entry.id, "yum");
    await repository.react(mia.group.id, mia.member.id, entry.id, "fire");
    await repository.unreact(mia.member.id, entry.id, "yum");
    expect(await reactionsOn(repository, valerie.group.id, entry.id)).toEqual([["fire", "Mia"]]);
  });

  it("refuses reactions to your own rating and reactions that are not on the list", async () => {
    const { repository, valerieSession: valerie, miaSession: mia, entry } = await valeriesRating();
    await expect(repository.react(valerie.group.id, valerie.member.id, entry.id, "yum")).rejects.toThrow(InputError);
    await expect(repository.react(mia.group.id, mia.member.id, entry.id, "thumbs_down")).rejects.toThrow(InputError);
    expect(await reactionsOn(repository, valerie.group.id, entry.id)).toEqual([]);
  });

  it("only reacts to ratings in your own group", async () => {
    const { repository, entry } = await valeriesRating();
    const sam = await repository.createUser("user-sam", "Sam");
    const stranger = await repository.createGroup("Other friends", sam);
    const samSession = (await repository.sessionFor(sam.id, stranger.group.id))!;
    expect(await repository.react(stranger.group.id, samSession.member.id, entry.id, "yum")).toBe(false);
    expect(await repository.react(stranger.group.id, samSession.member.id, "no-such-entry", "yum")).toBe(false);
  });

  it("deletes a rating's reactions with it", async () => {
    const { repository, valerieSession: valerie, miaSession: mia, entry } = await valeriesRating();
    await repository.react(mia.group.id, mia.member.id, entry.id, "love");
    expect((await repository.deleteEntry(entry.id, valerie.member.id)).deleted).toBe(true);
    expect(await database.query("SELECT 1 FROM reactions")).toEqual([]);
  });
});

describe("activity", () => {
  it("dates each reaction, so Activity can sort them", async () => {
    const { repository, valerieSession: valerie, miaSession: mia } = await setup();
    const entry = await repository.addEntry({ groupId: valerie.group.id, memberId: valerie.member.id, place: girlAndGoat, rating: 9, note: "" });
    await repository.react(mia.group.id, mia.member.id, entry.id, "yum");
    const [reaction] = (await repository.listEntries(valerie.group.id))[0].reactions;
    expect(Date.parse(reaction.createdAt)).not.toBeNaN();
  });

  it("remembers when you last opened Activity, for you only, on every device", async () => {
    const { repository, group, valerie, mia, valerieSession } = await setup();
    expect(valerieSession.activitySeenAt).toBeUndefined();
    const seenAt = await repository.markActivitySeen(valerieSession.member.id);
    expect((await repository.sessionFor(valerie.id, group.id))!.activitySeenAt).toBe(seenAt);
    expect((await repository.sessionFor(mia.id, group.id))!.activitySeenAt).toBeUndefined();
  });
});

describe("notifications", () => {
  const device = (name: string) => ({ endpoint: `https://push.test/${name}`, keys: { p256dh: `key-${name}`, auth: `auth-${name}` } });
  const endpoints = (devices: { endpoint: string }[]) => devices.map((each) => each.endpoint).sort();

  it("turns both kinds on by default and saves the switches", async () => {
    const { repository, valerie } = await setup();
    expect(await repository.notificationSettings(valerie.id)).toEqual({ newReviews: true, reactions: true });
    await repository.saveNotificationSettings(valerie.id, { newReviews: false, reactions: true });
    expect(await repository.notificationSettings(valerie.id)).toEqual({ newReviews: false, reactions: true });
    await expect(repository.saveNotificationSettings(valerie.id, { newReviews: "yes", reactions: true })).rejects.toThrow(InputError);
  });

  it("tells everyone else in the group about a new rating, on each of their devices, but not the author", async () => {
    const { repository, valerie, mia, valerieSession } = await setup();
    await repository.addPushSubscription(valerie.id, device("valerie-phone"));
    await repository.addPushSubscription(mia.id, device("mia-phone"));
    await repository.addPushSubscription(mia.id, device("mia-laptop"));
    expect(endpoints(await repository.devicesForNewRating(valerieSession.group.id, valerieSession.member.id))).toEqual([
      "https://push.test/mia-laptop",
      "https://push.test/mia-phone",
    ]);
  });

  it("skips people who turned new reviews off or left the group", async () => {
    const { repository, group, mia, valerieSession } = await setup();
    await repository.addPushSubscription(mia.id, device("mia-phone"));
    await repository.saveNotificationSettings(mia.id, { newReviews: false, reactions: true });
    expect(await repository.devicesForNewRating(group.id, valerieSession.member.id)).toEqual([]);
    await repository.saveNotificationSettings(mia.id, { newReviews: true, reactions: true });
    const miaSession = (await repository.sessionFor(mia.id, group.id))!;
    await repository.leaveGroup(group.id, miaSession.member.id);
    expect(await repository.devicesForNewRating(group.id, valerieSession.member.id)).toEqual([]);
  });

  it("tells only the rating's author about a reaction, unless they turned reactions off", async () => {
    const { repository, valerie, mia, valerieSession } = await setup();
    const entry = await repository.addEntry({ groupId: valerieSession.group.id, memberId: valerieSession.member.id, place: girlAndGoat, rating: 9, note: "" });
    await repository.addPushSubscription(valerie.id, device("valerie-phone"));
    await repository.addPushSubscription(mia.id, device("mia-phone"));
    expect(endpoints(await repository.devicesForReaction(entry.id))).toEqual(["https://push.test/valerie-phone"]);
    await repository.saveNotificationSettings(valerie.id, { newReviews: true, reactions: false });
    expect(await repository.devicesForReaction(entry.id)).toEqual([]);
  });

  it("forgets a device that was turned off, moved to another account, or no longer exists", async () => {
    const { repository, valerie, mia, valerieSession } = await setup();
    await repository.addPushSubscription(mia.id, device("shared-phone"));
    await repository.addPushSubscription(valerie.id, device("shared-phone"));
    expect(await repository.devicesForNewRating(valerieSession.group.id, valerieSession.member.id)).toEqual([]);
    await repository.addPushSubscription(mia.id, device("mia-phone"));
    await repository.removePushSubscription(valerie.id, "https://push.test/mia-phone");
    expect(await repository.devicesForNewRating(valerieSession.group.id, valerieSession.member.id)).toHaveLength(1);
    await repository.forgetPushSubscriptions(["https://push.test/mia-phone"]);
    expect(await repository.devicesForNewRating(valerieSession.group.id, valerieSession.member.id)).toEqual([]);
  });

  it("refuses a device address that is not https", async () => {
    const { repository, valerie } = await setup();
    await expect(repository.addPushSubscription(valerie.id, { ...device("x"), endpoint: "http://push.test/x" })).rejects.toThrow(InputError);
    await expect(repository.addPushSubscription(valerie.id, { endpoint: "https://push.test/x" })).rejects.toThrow(InputError);
  });
});

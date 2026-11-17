import type { StickerId } from "../shared/avatars.js";
import { REACTIONS } from "../shared/reactions.js";
import type { ReactionId } from "../shared/reactions.js";
import type { Member, Reaction } from "../shared/types.js";

export interface ReactionGroup {
  id: ReactionId;
  sticker: StickerId;
  label: string;
  members: Member[];
  mine: boolean;
}

/** Every reaction in the menu's order, with the people who left it (oldest first) and whether you are one of them. */
export function groupReactions(reactions: Reaction[], myMemberId: string): ReactionGroup[] {
  return REACTIONS.map((option) => {
    const members = reactions.filter((item) => item.reaction === option.id).map((item) => item.member);
    return { ...option, members, mine: members.some((member) => member.id === myMemberId) };
  });
}

/** Who reacted, each once: "You, Ana and Ben". */
export function reactorNames(reactions: Reaction[], myMemberId: string): string {
  const people = new Map<string, string>();
  for (const { member } of reactions) people.set(member.id, member.name);
  const names = [...people.entries()]
    .sort(([first], [second]) => Number(second === myMemberId) - Number(first === myMemberId))
    .map(([id, name]) => (id === myMemberId ? "You" : name));
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

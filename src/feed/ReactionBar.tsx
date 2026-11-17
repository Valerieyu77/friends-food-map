import { useState } from "react";
import { stickerUrl } from "../../shared/avatars.js";
import type { Entry } from "../../shared/types.js";
import { useGroupData } from "../groupData.js";
import { groupReactions, reactorNames } from "../reactionSummary.js";
import { Avatar } from "../screens/Avatar.js";

const FACES = 3;

/**
 * Friends' reactions to a rating. On a friend's rating every reaction is a button to add or take back;
 * on your own you only see the ones friends left. Tapping who reacted lists the names under each one.
 */
export function ReactionBar({ entry }: { entry: Entry }) {
  const { session, toggleReaction } = useGroupData();
  const [showNames, setShowNames] = useState(false);
  const myId = session.member.id;
  const isMine = entry.member.id === myId;
  const groups = groupReactions(entry.reactions, myId);
  const shown = isMine ? groups.filter((group) => group.members.length > 0) : groups;
  if (shown.length === 0) return null;
  const people = [...new Map(entry.reactions.map((item) => [item.member.id, item.member])).values()];

  return (
    <div className="reactions">
      <div className="reaction-row" role="group" aria-label="Reactions">
        {shown.map((group) => {
          const count = group.members.length;
          const content = (
            <>
              <img src={stickerUrl(group.sticker)} alt="" width={22} height={22} />
              {count > 0 && <span>{count}</span>}
            </>
          );
          const label = `${group.label}${count > 0 ? `, ${count}` : ""}`;
          return isMine ? (
            <span key={group.id} className="reaction" aria-label={label} title={group.label}>{content}</span>
          ) : (
            <button
              key={group.id}
              type="button"
              className={group.mine ? "reaction mine" : "reaction"}
              aria-pressed={group.mine}
              aria-label={label}
              title={group.label}
              onClick={() => toggleReaction(entry, group.id)}
            >
              {content}
            </button>
          );
        })}
      </div>
      {people.length > 0 && (
        <button type="button" className="reactors" aria-expanded={showNames} onClick={() => setShowNames((open) => !open)}>
          <span className="reactor-faces" aria-hidden="true">
            {people.slice(0, FACES).map((member) => (
              <Avatar key={member.id} name={member.name} avatar={member.avatar} size={20} />
            ))}
          </span>
          {reactorNames(entry.reactions, myId)} reacted
        </button>
      )}
      {showNames && (
        <ul className="reactor-list">
          {groups
            .filter((group) => group.members.length > 0)
            .map((group) => (
              <li key={group.id}>
                <img src={stickerUrl(group.sticker)} alt={group.label} width={18} height={18} />
                {group.members.map((member) => (member.id === myId ? "You" : member.name)).join(", ")}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

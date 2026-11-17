import { Link, useNavigate } from "react-router";
import { useGroupData } from "../groupData.js";
import { friendBubbles } from "../homeGrid.js";
import { Avatar } from "../screens/Avatar.js";
import { shareInvite } from "../share.js";
import { Icon } from "../shell/Icon.js";

/** The row of friends' faces at the top of Home; a coral ring means they rated something this week. Invite opens the share sheet. */
export function FriendsRow() {
  const { session, entries } = useGroupData();
  const navigate = useNavigate();

  async function invite() {
    // Without a share sheet (most laptops), the group page shows the link to copy.
    if ((await shareInvite(session.group.name, session.group.inviteCode)) === "unsupported") navigate("/group");
  }

  const bubbles = friendBubbles(session.members, entries ?? [], session.member.id);
  return (
    <nav className="friends-row" aria-label="Friends">
      {bubbles.map(({ member, postedRecently }) => (
        <Link
          key={member.id}
          to={`/friends/${member.id}`}
          className="friend-bubble"
          aria-label={postedRecently ? `${member.name}, rated something this week` : member.name}
        >
          <span className={postedRecently ? "bubble-ring recent" : "bubble-ring"}>
            <Avatar name={member.name} avatar={member.avatar} size={50} />
          </span>
          <span className="bubble-name">{member.name}</span>
        </Link>
      ))}
      <button type="button" className="friend-bubble invite-bubble" onClick={() => void invite()}>
        <span className="bubble-ring invite"><Icon name="plus" size={22} /></span>
        <span className="bubble-name">Invite</span>
      </button>
    </nav>
  );
}

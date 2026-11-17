import { useNavigate, useSearchParams } from "react-router";
import { useGroupData } from "../groupData.js";
import { searchCenter } from "../places.js";
import { AddEntry } from "../screens/AddEntry.js";
import { GroupSettings } from "../screens/GroupSettings.js";
import { Profile } from "../screens/Profile.js";
import { Rankings } from "../screens/Rankings.js";

/**
 * `/add?place=<id>` starts with that place chosen, and goes back to its page after posting.
 * With `&from=saved` (I went on the Saved page) it goes back to Saved, where the place is now under Been there.
 */
export function AddReviewPage() {
  const { pins, places, addEntry, notify } = useGroupData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startPlace = places.find((summary) => summary.place.id === searchParams.get("place"))?.place;
  const fromSaved = searchParams.get("from") === "saved";
  return (
    <div className="page-narrow">
      <AddEntry
        // The group's places may arrive after the form opens; starting over then picks the place.
        key={startPlace?.id ?? "new"}
        searchAround={searchCenter(pins)}
        startPlace={startPlace}
        onCancel={() => navigate(-1)}
        onPosted={(entry) => {
          addEntry(entry);
          if (fromSaved) {
            notify(`Posted ${entry.place.name}. It moved to Been there.`);
            navigate("/saved", { replace: true });
            return;
          }
          notify(`Posted ${entry.place.name}. Your friends can see it now.`);
          navigate(startPlace ? `/places/${startPlace.id}` : "/", { replace: Boolean(startPlace) });
        }}
      />
    </div>
  );
}

export function RankingsPage() {
  const { places } = useGroupData();
  const navigate = useNavigate();
  return (
    <div className="page-narrow">
      <Rankings places={places} onOpen={(placeId) => navigate(`/places/${placeId}`)} />
    </div>
  );
}

export function ProfilePage() {
  const { account, reloadAccount, logOut } = useGroupData();
  const navigate = useNavigate();
  return (
    <div className="page-narrow">
      <Profile user={account.user} onSaved={reloadAccount} onClose={() => navigate(-1)} onLogOut={logOut} />
    </div>
  );
}

export function GroupPage() {
  const { session, reloadAccount, leftGroup } = useGroupData();
  const navigate = useNavigate();
  return (
    <div className="page-narrow">
      <GroupSettings session={session} onClose={() => navigate(-1)} onChanged={reloadAccount} onLeft={leftGroup} />
    </div>
  );
}

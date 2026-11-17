import { useState } from "react";
import { useNavigate } from "react-router";
import type { CuisineId } from "../../shared/cuisines.js";
import type { PlaceInput } from "../../shared/types.js";
import * as api from "../api.js";
import { useGroupData } from "../groupData.js";
import { searchCenter } from "../places.js";
import { QUICK_START_PLACES, dismissQuickStart } from "../quickStart.js";
import { CuisinePicker } from "../screens/CuisinePicker.js";
import { PlaceSearch, describePlace } from "../screens/PlaceSearch.js";
import { ScorePicker } from "../screens/ScorePicker.js";

/**
 * "Rate 3 places you love": one place at a time, just the place, its kind of food and a score, so a new
 * member's taste shows up in the group within a minute. Photos and notes can be added later from the place's page.
 */
export function QuickRatePage() {
  const { pins, session, addEntry, notify } = useGroupData();
  const navigate = useNavigate();
  const [posted, setPosted] = useState<{ name: string; rating: number }[]>([]);
  const [place, setPlace] = useState<PlaceInput | null>(null);
  const [cuisine, setCuisine] = useState<CuisineId | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const step = posted.length + 1;
  const isLast = step === QUICK_START_PLACES;

  function finish(count: number) {
    dismissQuickStart(session.group.id);
    if (count > 0) notify(`Posted ${count} ${count === 1 ? "place" : "places"}. Your friends can see them now.`);
    navigate("/", { replace: true });
  }

  function choose(chosen: PlaceInput) {
    setPlace(chosen);
    setCuisine(null);
    setRating(null);
    setError(null);
  }

  async function post() {
    if (!place) return;
    if (cuisine === null) {
      setError("Pick the kind of food.");
      return;
    }
    if (rating === null) {
      setError("Pick a score from 1 to 10.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const entry = await api.addEntry({ place, cuisine, rating, note: "", price: null, priceAmount: null, wouldReturn: null, dishes: [], photos: [] });
      addEntry(entry);
      const done = [...posted, { name: entry.place.name, rating }];
      if (done.length >= QUICK_START_PLACES) {
        finish(done.length);
        return;
      }
      setPosted(done);
      setPlace(null);
      setCuisine(null);
      setRating(null);
      // The next search box is at the top; the Post button was at the bottom.
      window.scrollTo(0, 0);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not post. Try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="page-narrow">
      <div className="page quick-rate">
        <header className="top">
          <h1 className="display">Rate {QUICK_START_PLACES} places you love</h1>
          <button type="button" className="link" onClick={() => finish(posted.length)}>
            {posted.length > 0 ? "Finish" : "Not now"}
          </button>
        </header>
        <p className="lead">Just a score for now. You can add photos and notes later from each place's page.</p>

        <ol className="quick-progress" aria-label={`Place ${step} of ${QUICK_START_PLACES}`}>
          {Array.from({ length: QUICK_START_PLACES }, (_, index) => (
            <li key={index} className={index < posted.length ? "done" : index === posted.length ? "current" : undefined} />
          ))}
        </ol>

        {posted.length > 0 && (
          <ul className="quick-posted">
            {posted.map((item) => <li key={item.name}>✓ {item.name} · {item.rating}/10</li>)}
          </ul>
        )}

        <div className="stack">
          <p className="quick-step">Place {step} of {QUICK_START_PLACES}</p>
          {place ? (
            <>
              <div className="chosen">
                <div>
                  <strong>{place.name}</strong>
                  <p className="where">{describePlace(place)}</p>
                </div>
                <button type="button" className="link" onClick={() => setPlace(null)}>Change</button>
              </div>
              <fieldset>
                <legend>Kind of food</legend>
                <CuisinePicker value={cuisine} onChange={setCuisine} />
              </fieldset>
              <fieldset>
                <legend>Your score</legend>
                <ScorePicker value={rating} onChange={setRating} />
              </fieldset>
              {error && <p className="error" role="alert">{error}</p>}
              <button type="button" className="dark" disabled={posting} onClick={() => void post()}>
                {posting ? "Posting…" : isLast ? "Post and finish" : "Post and next"}
              </button>
            </>
          ) : (
            <PlaceSearch key={step} searchAround={searchCenter(pins)} onPick={choose} label="Search a place you love" />
          )}
        </div>
      </div>
    </div>
  );
}

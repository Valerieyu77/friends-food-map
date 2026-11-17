import { useState } from "react";
import type { FormEvent } from "react";
import type { CuisineId } from "../../shared/cuisines.js";
import type { Coordinates } from "../../shared/distance.js";
import type { Entry, Place, PlaceInput } from "../../shared/types.js";
import * as api from "../api.js";
import { CuisinePicker } from "./CuisinePicker.js";
import { DishesEditor, finishDishes } from "./DishesEditor.js";
import type { DishDraft } from "./DishesEditor.js";
import { PhotoPicker, photoPayload } from "./PhotoPicker.js";
import type { PhotoItem } from "./PhotoPicker.js";
import { PlaceSearch, describePlace } from "./PlaceSearch.js";
import { PriceAndReturnPicker } from "./PriceAndReturnPicker.js";
import { ScorePicker } from "./ScorePicker.js";

interface AddEntryProps {
  /** Where to search when the phone's location is off. */
  searchAround: Coordinates;
  /** A place already in the app, chosen before the form opens (from that place's page). */
  startPlace?: Place;
  onCancel: () => void;
  onPosted: (entry: Entry) => void;
}

export function AddEntry({ searchAround, startPlace, onCancel, onPosted }: AddEntryProps) {
  const [place, setPlace] = useState<PlaceInput | null>(startPlace ?? null);
  const [typingByHand, setTypingByHand] = useState(false);
  const [handName, setHandName] = useState("");
  const [handCity, setHandCity] = useState("");
  const [cuisine, setCuisine] = useState<CuisineId | null>(startPlace?.cuisine ?? null);
  const [rating, setRating] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [priceAmount, setPriceAmount] = useState<number | null>(null);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);
  const [dishDrafts, setDishDrafts] = useState<DishDraft[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const chosen = typingByHand ? { name: handName.trim(), city: handCity.trim() || undefined } : place;
    if (!chosen?.name) {
      setError("Choose a place first.");
      return;
    }
    if (cuisine === null) {
      setError("Pick the kind of food.");
      return;
    }
    if (rating === null) {
      setError("Pick a score from 1 to 10.");
      return;
    }
    let dishes;
    let upload;
    try {
      dishes = finishDishes(dishDrafts);
      upload = photoPayload(photos);
    } catch (problem) {
      setError((problem as Error).message);
      return;
    }
    setPosting(true);
    setError(null);
    try {
      onPosted(await api.addEntry({ place: chosen, cuisine, rating, note, price, priceAmount, wouldReturn, dishes, photos: upload.photos }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not post. Try again.");
      setPosting(false);
    }
  }

  return (
    <div className="page">
      <header className="top">
        <h1>Add a place</h1>
        <button type="button" className="link" onClick={onCancel}>Cancel</button>
      </header>
      <form onSubmit={submit} className="stack">
        {place && !typingByHand ? (
          <div className="chosen">
            <div>
              <strong>{place.name}</strong>
              <p className="where">{describePlace(place)}</p>
            </div>
            <button type="button" className="link" onClick={() => setPlace(null)}>Change</button>
          </div>
        ) : typingByHand ? (
          <>
            <label>
              Place name
              <input value={handName} onChange={(event) => setHandName(event.target.value)} maxLength={120} />
            </label>
            <label>
              <span>City <span className="optional">optional</span></span>
              <input value={handCity} onChange={(event) => setHandCity(event.target.value)} maxLength={80} />
            </label>
            <button type="button" className="link" onClick={() => setTypingByHand(false)}>Search for it instead</button>
          </>
        ) : (
          <PlaceSearch
            searchAround={searchAround}
            onPick={setPlace}
            onTypeByHand={(typed) => {
              setTypingByHand(true);
              setHandName(typed);
            }}
          />
        )}

        <fieldset>
          <legend>Kind of food</legend>
          <CuisinePicker value={cuisine} onChange={setCuisine} />
        </fieldset>

        <fieldset>
          <legend>Your score</legend>
          <ScorePicker value={rating} onChange={setRating} />
        </fieldset>

        <PriceAndReturnPicker
          price={price}
          priceAmount={priceAmount}
          onPrice={(level, amount) => {
            setPrice(level);
            setPriceAmount(amount);
          }}
          wouldReturn={wouldReturn}
          onWouldReturn={setWouldReturn}
        />

        <DishesEditor drafts={dishDrafts} onChange={setDishDrafts} />

        <PhotoPicker items={photos} onChange={setPhotos} onError={setError} />

        <label>
          <span>A note <span className="optional">optional</span></span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={500} placeholder="What did you eat? Anything to order or skip?" />
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={posting}>{posting ? "Posting…" : "Post"}</button>
      </form>
    </div>
  );
}

import { useState } from "react";
import type { FormEvent } from "react";
import type { Entry } from "../../shared/types.js";
import { useGroupData } from "../groupData.js";
import { DishesEditor, draftsFrom, finishDishes } from "../screens/DishesEditor.js";
import { PhotoPicker, photoPayload } from "../screens/PhotoPicker.js";
import type { PhotoItem } from "../screens/PhotoPicker.js";
import { PriceAndReturnPicker } from "../screens/PriceAndReturnPicker.js";
import { ScorePicker } from "../screens/ScorePicker.js";

/** Changes your own review in place on its card: everything but the place and its time. */
export function EditEntryForm({ entry, onDone }: { entry: Entry; onDone: () => void }) {
  const { editEntry, notify } = useGroupData();
  const [rating, setRating] = useState(entry.rating);
  const [note, setNote] = useState(entry.note ?? "");
  const [price, setPrice] = useState<number | null>(entry.price ?? null);
  const [priceAmount, setPriceAmount] = useState<number | null>(entry.priceAmount ?? null);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(entry.wouldReturn ?? null);
  const [dishDrafts, setDishDrafts] = useState(() => draftsFrom(entry.dishes));
  const [photos, setPhotos] = useState<PhotoItem[]>(() => entry.photoUrls.map((url) => ({ kind: "kept", url })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    let dishes;
    let upload;
    try {
      dishes = finishDishes(dishDrafts);
      upload = photoPayload(photos);
    } catch (problem) {
      setError((problem as Error).message);
      return;
    }
    setSaving(true);
    try {
      await editEntry(entry, { rating, note, price, priceAmount, wouldReturn, dishes, ...upload });
      notify("Your review is updated.");
      onDone();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save your changes. Try again.");
      setSaving(false);
    }
  }

  return (
    <form className="edit-entry" onSubmit={(event) => void save(event)} aria-label={`Edit your review of ${entry.place.name}`}>
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
        Your note
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={500} placeholder="What did you eat? Anything to order or skip?" />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="edit-entry-actions">
        <button type="button" className="button secondary small" onClick={onDone} disabled={saving}>Cancel</button>
        <button type="submit" className="button primary small" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

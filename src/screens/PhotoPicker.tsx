import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { MAX_PHOTOS } from "../../shared/types.js";
import { preparePhoto } from "../image.js";
import { Icon } from "../shell/Icon.js";

/** A photo in the form: one already saved (kept unless removed), or one just picked from the phone. */
export type PhotoItem = { kind: "kept"; url: string } | { kind: "new"; dataUrl: string };

// The host refuses requests over about 4.5 MB, so all new photos together must stay under this.
const MAX_UPLOAD_CHARACTERS = 4_000_000;

const sourceOf = (item: PhotoItem) => (item.kind === "kept" ? item.url : item.dataUrl);

/** What to send: the saved photos to keep, in order, and the new ones. Throws a message when they are too big together. */
export function photoPayload(items: PhotoItem[]): { keepPhotos: string[]; photos: string[] } {
  const photos = items.flatMap((item) => (item.kind === "new" ? [item.dataUrl] : []));
  if (photos.reduce((total, photo) => total + photo.length, 0) > MAX_UPLOAD_CHARACTERS) {
    throw new Error("These photos are too large to send together. Remove one and try again.");
  }
  return { keepPhotos: items.flatMap((item) => (item.kind === "kept" ? [item.url] : [])), photos };
}

interface PhotoPickerProps {
  items: PhotoItem[];
  onChange: (items: PhotoItem[]) => void;
  onError: (message: string) => void;
}

/** Up to four photos as thumbnails, each with a remove button, and a button to add more from the phone. */
export function PhotoPicker({ items, onChange, onError }: PhotoPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const room = MAX_PHOTOS - items.length;

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (files.length === 0) return;
    setPreparing(true);
    try {
      const added: PhotoItem[] = [];
      for (const file of files.slice(0, room)) added.push({ kind: "new", dataUrl: await preparePhoto(file) });
      onChange([...items, ...added]);
      if (files.length > room) onError(`A review holds ${MAX_PHOTOS} photos, so only the first ${room} were added.`);
    } catch (failure) {
      onError(failure instanceof Error ? failure.message : "Could not use that photo.");
    } finally {
      setPreparing(false);
    }
  }

  return (
    <fieldset>
      <legend>Photos <span className="optional">up to {MAX_PHOTOS}</span></legend>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(event) => void choose(event)} />
      <div className="photo-picker">
        {items.map((item, index) => (
          <div key={sourceOf(item)} className="photo-thumb">
            <img src={sourceOf(item)} alt={`Photo ${index + 1}`} />
            <button type="button" className="icon-button" aria-label={`Remove photo ${index + 1}`} onClick={() => onChange(items.filter((other) => other !== item))}>
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
        {room > 0 && (
          <button type="button" className="photo-add" onClick={() => input.current?.click()} disabled={preparing}>
            <Icon name="plus" size={20} />
            {preparing ? "Adding…" : items.length === 0 ? "Add photos" : "Add"}
          </button>
        )}
      </div>
    </fieldset>
  );
}

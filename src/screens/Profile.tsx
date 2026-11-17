import { useState } from "react";
import type { FormEvent } from "react";
import { AVATAR_COLORS, STICKER_GROUPS, avatarText, parseAvatar, stickerUrl } from "../../shared/avatars.js";
import type { Avatar as AvatarChoice } from "../../shared/avatars.js";
import type { User } from "../../shared/types.js";
import * as api from "../api.js";
import { Avatar } from "./Avatar.js";
import { NotificationsSection } from "./NotificationsSection.js";

interface ProfileProps {
  user: User;
  onSaved: (message: string) => void;
  onClose: () => void;
  onLogOut: () => void;
}

export function Profile({ user, onSaved, onClose, onLogOut }: ProfileProps) {
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState<AvatarChoice | undefined>(() => parseAvatar(user.avatar));
  const [style, setStyle] = useState<AvatarChoice["kind"]>(avatar?.kind ?? "sticker");
  const [stickerGroup, setStickerGroup] = useState<(typeof STICKER_GROUPS)[number]["id"]>(STICKER_GROUPS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownStickers = STICKER_GROUPS.find((group) => group.id === stickerGroup)!.stickers;

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { keptOldName } = await api.updateProfile({ name, avatar: avatar ? avatarText(avatar) : null });
      onSaved(
        keptOldName.length > 0
          ? `Saved. Someone in ${keptOldName.join(", ")} already uses that name, so your old name stays there.`
          : "Profile saved.",
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save your profile.");
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="top">
        <h1 className="display">Profile</h1>
        <button type="button" className="secondary" onClick={onClose}>Done</button>
      </header>
      <form onSubmit={save} className="stack">
        <div className="profile-preview">
          <Avatar name={name || user.name} avatar={avatar && avatarText(avatar)} size={104} />
        </div>
        <label>
          Your name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} autoComplete="nickname" />
        </label>

        <fieldset>
          <legend>Avatar</legend>
          <div className="filter-chips" role="group" aria-label="Avatar style">
            <button type="button" className={style === "sticker" ? "filter-chip selected" : "filter-chip"} aria-pressed={style === "sticker"} onClick={() => setStyle("sticker")}>
              Sticker
            </button>
            <button type="button" className={style === "color" ? "filter-chip selected" : "filter-chip"} aria-pressed={style === "color"} onClick={() => setStyle("color")}>
              Name and color
            </button>
          </div>

          {style === "sticker" ? (
            <>
              <div className="filter-chips" role="group" aria-label="Sticker kind">
                {STICKER_GROUPS.map((group) => (
                  <button key={group.id} type="button" className={group.id === stickerGroup ? "filter-chip selected" : "filter-chip"} aria-pressed={group.id === stickerGroup} onClick={() => setStickerGroup(group.id)}>
                    {group.label}
                  </button>
                ))}
              </div>
              <div className="sticker-grid">
                {shownStickers.map((sticker) => {
                  const selected = avatar?.kind === "sticker" && avatar.sticker === sticker;
                  return (
                    <button key={sticker} type="button" className={selected ? "sticker-option selected" : "sticker-option"} aria-pressed={selected} aria-label={sticker.replaceAll("_", " ")} onClick={() => setAvatar({ kind: "sticker", sticker })}>
                      <img src={stickerUrl(sticker)} alt="" width={44} height={44} loading="lazy" />
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="color-grid">
              {AVATAR_COLORS.map((color) => {
                const selected = avatar?.kind === "color" && avatar.color === color.id;
                return (
                  <button key={color.id} type="button" className={selected ? "color-option selected" : "color-option"} aria-pressed={selected} aria-label={color.id} onClick={() => setAvatar({ kind: "color", color: color.id })}>
                    <Avatar name={name || user.name} avatar={`color:${color.id}`} size={48} />
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="dark" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </form>
      <NotificationsSection />
      <button type="button" className="link log-out" onClick={onLogOut}>Log out</button>
    </div>
  );
}

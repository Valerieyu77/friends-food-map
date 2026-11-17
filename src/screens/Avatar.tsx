import { AVATAR_COLORS, colorHex, parseAvatar, stickerUrl } from "../../shared/avatars.js";
import type { AvatarColorId } from "../../shared/avatars.js";

/** The background of a letter avatar: the color they chose, or one picked from their name. */
function letterBackground(name: string, color: AvatarColorId | undefined): string {
  if (color) return colorHex(color);
  return AVATAR_COLORS[[...name].reduce((total, letter) => total + letter.codePointAt(0)!, 0) % AVATAR_COLORS.length].hex;
}

function initial(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? "?";
}

/** The same avatar as `Avatar`, as a plain element, for map pins drawn outside React. */
export function avatarElement(name: string, avatar: string | undefined, size: number): HTMLElement {
  const chosen = parseAvatar(avatar);
  if (chosen?.kind === "sticker") {
    const image = document.createElement("img");
    image.className = "avatar";
    image.src = stickerUrl(chosen.sticker);
    image.alt = "";
    image.width = size;
    image.height = size;
    return image;
  }
  const letter = document.createElement("span");
  letter.className = "avatar avatar-letter";
  letter.setAttribute("aria-hidden", "true");
  Object.assign(letter.style, {
    width: `${size}px`,
    height: `${size}px`,
    background: letterBackground(name, chosen?.color),
    fontSize: `${size * 0.45}px`,
  });
  letter.textContent = initial(name);
  return letter;
}

/** A person's sticker, or the first letter of their name on their color (a color picked from the name if they chose none). */
export function Avatar({ name, avatar, size = 32 }: { name: string; avatar?: string; size?: number }) {
  const chosen = parseAvatar(avatar);
  if (chosen?.kind === "sticker") {
    return <img className="avatar" src={stickerUrl(chosen.sticker)} alt="" width={size} height={size} />;
  }
  const background = letterBackground(name, chosen?.color);
  return (
    <span className="avatar avatar-letter" aria-hidden="true" style={{ width: size, height: size, background, fontSize: size * 0.45 }}>
      {initial(name)}
    </span>
  );
}

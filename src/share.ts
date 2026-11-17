/** The link that lets a friend join a group. */
export function inviteUrl(inviteCode: string): string {
  return `${window.location.origin}/join/${inviteCode}`;
}

export function canShare(): boolean {
  return typeof navigator.share === "function";
}

/**
 * Opens the phone's share sheet (Messages, WeChat, and so on) with the group's invite link.
 * Says "unsupported" where there is no share sheet, so the caller can show the link to copy instead.
 */
export async function shareInvite(groupName: string, inviteCode: string): Promise<"shared" | "cancelled" | "unsupported"> {
  if (!canShare()) return "unsupported";
  try {
    await navigator.share({ title: `Join ${groupName} on Food Map`, text: `Join ${groupName} on Food Map`, url: inviteUrl(inviteCode) });
    return "shared";
  } catch (error) {
    // Closing the share sheet counts as an error too; anything else means it could not open.
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    return "unsupported";
  }
}

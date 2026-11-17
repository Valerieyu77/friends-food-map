import { useRef, useState } from "react";
import { canShare, inviteUrl, shareInvite } from "../share.js";

const LINK_COPIED_MILLISECONDS = 3000;

/** A group's invite link with a Copy button, and Share where the device has a share sheet. */
export function InviteLink({ inviteCode, groupName }: { inviteCode: string; groupName: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const link = inviteUrl(inviteCode);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), LINK_COPIED_MILLISECONDS);
    } catch {
      // Copying can be blocked; selecting the link lets the person copy it themselves.
      field.current?.select();
      setCopyFailed(true);
    }
  }

  return (
    <>
      <div className="invite-row">
        <input ref={field} readOnly value={link} aria-label="Invite link" onFocus={(event) => event.target.select()} />
        <button type="button" className={canShare() ? "secondary" : "dark"} onClick={() => void copy()}>{copied ? "Copied ✓" : "Copy"}</button>
        {canShare() && <button type="button" className="dark" onClick={() => void shareInvite(groupName, inviteCode)}>Share</button>}
      </div>
      {copyFailed && <p className="hint">Could not copy automatically. Press and hold the link to copy it.</p>}
    </>
  );
}

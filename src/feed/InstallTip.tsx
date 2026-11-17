import { useEffect, useState } from "react";
import { currentSituation, installPrompt, installTipKind, onInstallPromptChange, rememberDismissed } from "../installTip.js";
import { Icon } from "../shell/Icon.js";

/** The iPhone Share icon, drawn so the steps match what is on screen. */
function ShareIcon() {
  return (
    <svg className="share-icon" viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15V3M8 7l4-4 4 4M7 10H5.5a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-10a.5.5 0 0 0-.5-.5H17" />
    </svg>
  );
}

/** A one-time card on phones suggesting the app be added to the home screen, until it is or the card is closed. */
export function InstallTip() {
  const [kind, setKind] = useState(() => installTipKind(currentSituation()));
  useEffect(() => onInstallPromptChange(() => setKind(installTipKind(currentSituation()))), []);
  if (!kind) return null;

  function close() {
    rememberDismissed();
    setKind(null);
  }

  async function install() {
    const prompt = installPrompt();
    if (!prompt) return;
    await prompt.prompt();
    if ((await prompt.userChoice).outcome === "accepted") setKind(null);
  }

  return (
    <aside className="install-tip" aria-label="Add to Home Screen">
      <img src="/icons/apple-touch-icon.png" alt="" width={44} height={44} />
      <div className="install-tip-text">
        <strong>Add Food Map to your Home Screen</strong>
        {kind === "ios" ? (
          <span>
            Tap <ShareIcon /> Share, then <b>Add to Home Screen</b>. It opens full screen, like an app.
          </span>
        ) : (
          <span>It opens full screen, like an app.</span>
        )}
        {kind === "android" && (
          <button type="button" className="button primary small" onClick={() => void install()}>Install app</button>
        )}
      </div>
      <button type="button" className="icon-button install-tip-close" aria-label="Close" onClick={close}>
        <Icon name="close" size={18} />
      </button>
    </aside>
  );
}

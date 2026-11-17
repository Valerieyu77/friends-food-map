import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import type { Account, Session } from "../shared/types.js";
import * as api from "./api.js";
import { turnOffHere } from "./push.js";
import { GroupDataProvider } from "./groupData.js";
import { ActivityPage } from "./pages/ActivityPage.js";
import { ExplorePage } from "./pages/ExplorePage.js";
import { FriendPage } from "./pages/FriendPage.js";
import { HomePage } from "./pages/HomePage.js";
import { PlaceDetailPage } from "./pages/PlaceDetailPage.js";
import { QuickRatePage } from "./pages/QuickRatePage.js";
import { SavedPage } from "./pages/SavedPage.js";
import { AddReviewPage, GroupPage, ProfilePage, RankingsPage } from "./pages/SimplePages.js";
import { AuthScreen } from "./screens/AuthScreen.js";
import { JoinGroup } from "./screens/JoinGroup.js";
import { ResetPassword } from "./screens/ResetPassword.js";
import { Welcome } from "./screens/Welcome.js";
import { clearOldSignIns, loadAccountToken, loadOpenGroup, saveAccountToken, saveOpenGroup } from "./session.js";
import { AppShell } from "./shell/AppShell.js";

type View =
  | { kind: "loading" }
  | { kind: "auth"; joiningGroupName?: string }
  | { kind: "reset" }
  | { kind: "join"; code: string; account: Account }
  | { kind: "new-group"; account: Account; canCancel: boolean }
  | { kind: "home"; account: Account; session: Session; notice?: string };

function inviteCodeFromPath(): string | null {
  return /^\/join\/([a-z0-9]+)$/i.exec(window.location.pathname)?.[1] ?? null;
}

const isNotSignedIn = (error: unknown) => error instanceof api.ApiError && error.status === 401;

export function App() {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [startError, setStartError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function start(notice?: string) {
    setStartError(null);
    if (window.location.pathname === "/reset-password") {
      setView({ kind: "reset" });
      return;
    }
    const code = inviteCodeFromPath();
    try {
      if (!loadAccountToken()) {
        const joiningGroupName = code ? (await api.previewInvite(code).catch(() => null))?.groupName : undefined;
        setView({ kind: "auth", joiningGroupName });
        return;
      }
      const account = await api.fetchAccount();
      if (code) {
        setView({ kind: "join", code, account });
        return;
      }
      // Open the group a notification points to (?group=), else the one from last time, else the first one;
      // with none yet, start one.
      const linkedGroup = new URLSearchParams(window.location.search).get("group");
      const openGroup =
        account.groups.find((group) => group.id === linkedGroup) ??
        account.groups.find((group) => group.id === loadOpenGroup()) ??
        account.groups[0];
      if (!openGroup) {
        setView({ kind: "new-group", account, canCancel: false });
        return;
      }
      saveOpenGroup(openGroup.id);
      setView({ kind: "home", account, session: await api.fetchSession(), notice });
    } catch (error) {
      if (isNotSignedIn(error)) {
        saveAccountToken(null);
        setView({ kind: "auth" });
      } else {
        setStartError(error instanceof Error ? error.message : "Could not load.");
      }
    }
  }
  useEffect(() => void start(), []);

  function restart(path = window.location.pathname, notice?: string) {
    navigate(path, { replace: true });
    setView({ kind: "loading" });
    void start(notice);
  }

  function signedIn(token: string) {
    saveAccountToken(token);
    // The server has taken over this browser's sign-ins from before accounts.
    clearOldSignIns();
    restart();
  }

  function openGroup(groupId: string) {
    saveOpenGroup(groupId);
    restart("/");
  }

  async function logOut() {
    // A device that logged out should not keep getting this account's notifications.
    await turnOffHere().catch(() => undefined);
    await api.logOut().catch(() => undefined);
    saveAccountToken(null);
    saveOpenGroup(null);
    restart("/");
  }

  if (startError) {
    return (
      <main className="page">
        <p className="error">{startError}</p>
        <button type="button" onClick={() => void start()}>Try again</button>
      </main>
    );
  }
  switch (view.kind) {
    case "loading":
      return <main className="page"><p>Loading…</p></main>;
    case "auth":
      return <AuthScreen onSignedIn={signedIn} joiningGroupName={view.joiningGroupName} />;
    case "reset":
      return <ResetPassword onDone={() => restart("/")} />;
    case "join":
      return <JoinGroup code={view.code} user={view.account.user} onJoined={openGroup} />;
    case "new-group":
      return (
        <Welcome
          onCreated={openGroup}
          onCancel={view.canCancel ? () => restart("/") : undefined}
          onLogOut={() => void logOut()}
        />
      );
    case "home":
      return (
        <GroupDataProvider
          key={view.session.group.id}
          account={view.account}
          session={view.session}
          startNotice={view.notice}
          switchGroup={openGroup}
          newGroup={() => setView({ kind: "new-group", account: view.account, canCancel: true })}
          logOut={() => void logOut()}
          reloadAccount={(notice) => restart(window.location.pathname, notice)}
          leftGroup={(notice) => {
            // Opens the first group still on the list, or the New group page.
            saveOpenGroup(null);
            restart("/", notice);
          }}
        >
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="explore" element={<ExplorePage />} />
              <Route path="places/:placeId" element={<PlaceDetailPage />} />
              <Route path="saved" element={<SavedPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="friends/:memberId" element={<FriendPage />} />
              <Route path="rankings" element={<RankingsPage />} />
              <Route path="add" element={<AddReviewPage />} />
              <Route path="quick-rate" element={<QuickRatePage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="group" element={<GroupPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </GroupDataProvider>
      );
  }
}

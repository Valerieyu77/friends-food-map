// Friends Food Map's background script: shows phone notifications and opens the right page when one is tapped.
// It does not cache anything, so the app always loads fresh from the server.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  const message = event.data ? event.data.json() : { title: "Friends Food Map", body: "", url: "/" };
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: "/icons/icon-192.png",
      data: { url: message.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const [openWindow] = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (openWindow) {
        try {
          await openWindow.focus();
          await openWindow.navigate(url);
          return;
        } catch {
          // A window this script does not control cannot be sent elsewhere; open a new one instead.
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

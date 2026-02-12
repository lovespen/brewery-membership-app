/* Push notification service worker */
self.addEventListener("push", (event) => {
  let data = { title: "Notification", body: "" };
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }
  const options = {
    body: data.body || "",
    tag: data.id || "brewery-push",
    renotify: true
  };
  event.waitUntil(
    self.registration.showNotification(data.title || "Sapwood Cellars", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0 && "focus" in clientList[0]) {
        clientList[0].focus();
      } else if (self.clients.openWindow) {
        self.clients.openWindow("/");
      }
    })
  );
});

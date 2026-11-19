// 只负责通知：不缓存页面，发布新版本时不会卡在旧资源上。
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let m = {};
  try {
    m = e.data ? e.data.json() : {};
  } catch {}
  e.waitUntil(
    self.registration.showNotification(m.title || "二人世界", {
      body: m.body || "",
      tag: m.tag,
      icon: "icons/icon-192.png",
      data: { url: new URL(m.url || "./", self.registration.scope).href },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || self.registration.scope;
  e.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const same = open.find((c) => c.url === url) || open[0];
      if (same) {
        if (same.url !== url && "navigate" in same)
          await same.navigate(url).catch(() => {});
        return same.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});

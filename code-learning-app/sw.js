// 功能：Service Worker 缓存策略，实现静态资源离线缓存和请求回退。
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('message', function (event) {
  if (!event.data || event.data.type !== 'show-notification') {
    return;
  }

  const payload = event.data.payload || {};
  const title = payload.title || 'Daily Practice Reminder';
  const body = payload.body || 'Time for your coding practice. Open the app to continue.';
  const options = {
    body,
    tag: 'daily-practice-reminder',
    renotify: true,
    data: payload.data || { url: '/pages/task/task' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

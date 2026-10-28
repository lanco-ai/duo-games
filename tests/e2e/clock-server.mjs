// Isolated Playwright process only. The production bundle has no clock-control route.
import { createServer } from "node:http";
import { createApp } from "../../dist/server.js";
const realNow = Date.now.bind(Date);
let offset = 0;
Date.now = () => realNow() + offset;
const app = createApp({ creationLimit: 100 });
await app.listen();
const clock = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/advance") {
    res.writeHead(404).end();
    return;
  }
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 256) {
      res.writeHead(413).end();
      return;
    }
  }
  try {
    const { ms } = JSON.parse(body);
    if (!Number.isSafeInteger(ms) || ms < 0 || ms > 300000) throw Error();
    offset += ms;
    app.manager.tickExtras();
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ now: Date.now() }));
  } catch {
    res.writeHead(400).end();
  }
});
await new Promise((resolve) => clock.listen(8792, "127.0.0.1", resolve));
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    clock.close();
    void app.close().then(() => process.exit(0));
  });

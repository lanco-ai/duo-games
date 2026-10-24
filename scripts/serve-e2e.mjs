// Isolated test server only: raises room creation capacity without changing production defaults.
import { createApp } from "../dist/server.js";
const app = createApp({ creationLimit: 100 });
await app.listen();
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => void app.close().then(() => process.exit(0)));

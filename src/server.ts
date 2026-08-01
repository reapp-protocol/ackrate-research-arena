import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 3000);
const app = createApp();

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`ackrate research arena listening on http://0.0.0.0:${port}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received; draining server`);
  server.close((error) => {
    if (error) {
      console.error("server shutdown failed", error.message);
      process.exitCode = 1;
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

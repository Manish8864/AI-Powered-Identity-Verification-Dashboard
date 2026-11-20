import mongoose from "mongoose";
import app from "./app.js";
import { env } from "./config/env.js";

async function start() {
  await mongoose.connect(env.MONGO_URI);
  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received; closing API`);
    server.close(async (error) => {
      if (error) {
        console.error("API shutdown failed", error);
        process.exitCode = 1;
      }
      await mongoose.disconnect();
    });
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

start().catch((error: unknown) => {
  console.error("API startup failed", error);
  process.exitCode = 1;
});

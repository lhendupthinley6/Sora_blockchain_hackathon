import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootEnv = path.resolve(currentDir, "../../../.env");

dotenv.config({ path: repoRootEnv });

const config = loadConfig();
const { app } = createApp(config);

app.listen(config.port, () => {
  console.log(
    `Sora API listening on http://localhost:${config.port} in ${config.mode} mode using ${config.ndiTransport} transport`,
  );
});

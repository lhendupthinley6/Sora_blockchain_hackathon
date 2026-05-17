import { createApp } from "../apps/api/dist/app.js";
import { loadConfig } from "../apps/api/dist/config.js";

const { app } = createApp(loadConfig());

export default function handler(req, res) {
  return app(req, res);
}

import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port });
console.log(`mt-workbench app service listening on :${port}`);

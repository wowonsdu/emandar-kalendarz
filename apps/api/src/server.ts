import { buildApp } from "./app.js";
import { readConfig } from "./config.js";
import { createAuthStoreFromConfig, createStoreFromConfig } from "./runtime.js";

const config = readConfig();
const store = await createStoreFromConfig(config);
const authStore = createAuthStoreFromConfig(config);
const app = await buildApp({ config, store, authStore });

await app.listen({
  host: config.host,
  port: config.port,
});

console.log(`Emandar API listening on http://${config.host}:${config.port}${config.basePath}/api`);

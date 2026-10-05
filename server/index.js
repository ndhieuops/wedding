import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();

const logger = {
  level: config.logLevel,
  ...(config.prettyLogs ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } } : {}),
};

let app;
try {
  app = await buildApp(config, { logger });
} catch (err) {
  console.error('❌ Không khởi động được ứng dụng:', err.message);
  process.exit(1);
}

for (const warning of config.warnings) app.log.warn(warning);
const { errors } = app.registry;
for (const e of errors) app.log.warn(`Template "${e.id}" bị bỏ qua: ${e.error}`);

try {
  await app.listen({ host: config.host, port: config.port });
  app.log.info(`💍 Wedding Studio đang chạy tại ${config.baseUrl} (templates: ${app.registry.list({ includeHidden: true }).length})`);
} catch (err) {
  app.log.error(err, 'Không mở được cổng HTTP');
  process.exit(1);
}

// Graceful shutdown: finish in-flight requests, close the DB cleanly (docker stop sends SIGTERM).
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    if (closing) return;
    closing = true;
    app.log.info(`${signal} received — shutting down`);
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  });
}

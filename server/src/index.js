import app from './app.js';

const port = process.env.PORT || 3000;
const server = app.listen(port, '0.0.0.0', () => console.log(`Sahod server running on http://0.0.0.0:${port}`));

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => { console.error('Uncaught exception:', err); shutdown('uncaughtException'); });
process.on('unhandledRejection', (reason) => { console.error('Unhandled rejection:', reason); });
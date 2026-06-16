/* Logger — thin wrapper that silences debug logs in production builds.
   Use `log.debug(...)` for ephemeral noise; `log.error(...)` always flushes
   (kept for monitoring tools like Sentry). */
const isDev = typeof process !== "undefined" && process.env?.NODE_ENV !== "production";

const log = {
  debug: (...args) => { if (isDev) console.debug(...args); },
  error: (...args) => { console.error(...args); },
  warn: (...args) => { console.warn(...args); },
};

export default log;

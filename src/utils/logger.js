// src/utils/logger.js
const isDev = process.env.NODE_ENV !== "production";

const logger = {
  info: (...args) => {
    if (isDev) console.log(...args);
  },
  warn: (...args) => {
    console.warn(...args);
  },
  error: (message, error) => {
    console.error(message);
    if (isDev && error) console.error(error);
  },
};

module.exports = logger;
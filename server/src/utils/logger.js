function stamp(level) {
  return `${new Date().toISOString()} [${level}]`;
}

export const logger = {
  info: (...args) => console.log(stamp('INFO'), ...args),
  warn: (...args) => console.warn(stamp('WARN'), ...args),
  error: (...args) => console.error(stamp('ERROR'), ...args),
};

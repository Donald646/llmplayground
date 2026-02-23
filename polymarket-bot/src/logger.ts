type LogLevel = "info" | "warn" | "error" | "trade" | "signal";

const LEVEL_PREFIX: Record<LogLevel, string> = {
  info: "[INFO]",
  warn: "[WARN]",
  error: "[ERROR]",
  trade: "[TRADE]",
  signal: "[SIGNAL]",
};

function timestamp(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  const prefix = `${timestamp()} ${LEVEL_PREFIX[level]}`;
  if (data) {
    console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export const logger = {
  info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
  trade: (msg: string, data?: Record<string, unknown>) => log("trade", msg, data),
  signal: (msg: string, data?: Record<string, unknown>) => log("signal", msg, data),
};

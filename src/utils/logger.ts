import { config } from '../config/env.js';

/**
 * Simple structured logger
 */
class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = config.server.isDevelopment;
  }

  private log(level: string, message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(meta && { meta }),
    };

    if (this.isDevelopment) {
      // Pretty print in development
      console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
      if (meta) {
        console.log(JSON.stringify(meta, null, 2));
      }
    } else {
      // JSON in production
      console.log(JSON.stringify(logEntry));
    }
  }

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }

  error(message: string, meta?: any) {
    this.log('error', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }

  debug(message: string, meta?: any) {
    if (this.isDevelopment) {
      this.log('debug', message, meta);
    }
  }
}

export const logger = new Logger();


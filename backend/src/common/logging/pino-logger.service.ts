import { Injectable, LoggerService } from '@nestjs/common';
import pino, { Logger } from 'pino';

@Injectable()
export class PinoLoggerService implements LoggerService {
  private readonly logger: Logger;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  log(message: unknown, context?: string) {
    this.logger.info({ context }, this.toMessage(message));
  }

  error(message: unknown, trace?: string, context?: string) {
    this.logger.error({ context, trace }, this.toMessage(message));
  }

  warn(message: unknown, context?: string) {
    this.logger.warn({ context }, this.toMessage(message));
  }

  debug(message: unknown, context?: string) {
    this.logger.debug({ context }, this.toMessage(message));
  }

  verbose(message: unknown, context?: string) {
    this.logger.trace({ context }, this.toMessage(message));
  }

  private toMessage(message: unknown) {
    return typeof message === 'string' ? message : JSON.stringify(message);
  }
}

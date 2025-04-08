import { getConfig } from './config';

// 日志级别定义
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 日志级别映射到数字，用于比较
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// 日志颜色
const LOG_COLORS = {
  debug: '\x1b[36m', // 青色
  info: '\x1b[32m',  // 绿色
  warn: '\x1b[33m',  // 黄色
  error: '\x1b[31m', // 红色
  reset: '\x1b[0m'   // 重置
};

class Logger {
  private level: LogLevel;

  constructor() {
    try {
      this.level = getConfig().logLevel as LogLevel || 'info';
      if (!Object.keys(LOG_LEVELS).includes(this.level)) {
        console.warn(`无效的日志级别: ${this.level}，使用默认级别 'info'`);
        this.level = 'info';
      }
    } catch (error) {
      console.warn('配置加载失败，使用默认日志级别 "info"');
      this.level = 'info';
    }
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (LOG_LEVELS[level] >= LOG_LEVELS[this.level]) {
      const timestamp = new Date().toISOString();
      const color = LOG_COLORS[level];
      const reset = LOG_COLORS.reset;
      
      console.log(`${color}[${timestamp}] [${level.toUpperCase()}]${reset}`, message, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }
}

// 导出单例
export const logger = new Logger(); 
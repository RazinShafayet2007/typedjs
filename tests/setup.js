/**
 * Jest Setup File
 */

if (process.env.DEBUG !== 'true') {
  global.console = {
    ...console,
    log: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  };
}

process.env.NODE_ENV = 'test';

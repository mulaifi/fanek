import pino from 'pino';
const redactPaths = [
  'req.headers.authorization', 'req.headers.cookie',
  'password', 'passwordHash', 'secret', 'token', 'clientSecret',
];
const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino/file', options: { destination: 1 } },
  }),
});
export default logger;

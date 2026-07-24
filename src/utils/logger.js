export const logger = {
  info: (msg) => console.log(`   [INFO] ${msg}`),
  success: (msg) => console.log(`   [SUCCESS] ${msg}`),
  warn: (msg) => console.warn(`   [WARNING] ${msg}`),
  error: (msg) => console.error(`   [ERROR] ${msg}`),
  step: (stepNum, msg) => console.log(`\n[${stepNum} [INFO] ${msg}`),
  blank: (msg = '') => console.log(msg)
};

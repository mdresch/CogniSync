"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogger = getLogger;
const tslib_1 = require("tslib");
const pino_1 = tslib_1.__importDefault(require("pino"));
const logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard',
        },
    },
});
function getLogger(serviceName) {
    return logger.child({ service: serviceName });
}
//# sourceMappingURL=logger.js.map
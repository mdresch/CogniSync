"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMetrics = getMetrics;
const logger_1 = require("./logger");
const logger = (0, logger_1.getLogger)('Metrics');
const metricsClient = {
    increment: (metricName) => {
        logger.info({ metric: metricName, msg: `Metric incremented: ${metricName}` });
    },
};
function getMetrics() {
    return {
        incrementEventsReceived: () => {
            metricsClient.increment('events_received_total');
        },
        incrementEventsSucceeded: () => {
            metricsClient.increment('events_succeeded_total');
        },
        incrementEventsRetried: () => {
            metricsClient.increment('events_retried_total');
        },
        incrementEventsDlq: () => {
            metricsClient.increment('events_dlq_total');
        },
    };
}
//# sourceMappingURL=metrics.js.map
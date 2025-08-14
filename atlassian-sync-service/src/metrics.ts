// atlassian-sync-service/src/metrics.ts

import { getLogger } from './logger';

const logger = getLogger('Metrics');

// This is a mock/placeholder metrics implementation.
// In a production system, this would be replaced with a real Prometheus client.
const metricsClient = {
  increment: (metricName: string) => {
    // In a real system, this would increment a Prometheus counter.
    // For now, we log it for visibility.
    logger.info({ metric: metricName, msg: `Metric incremented: ${metricName}` });
  },
};

/**
 * Returns a metrics utility object that conforms to the interface our service expects.
 */
export function getMetrics() {
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

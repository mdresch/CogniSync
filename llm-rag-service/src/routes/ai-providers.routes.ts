import { Router } from 'express';
import { AIProviderService } from '../services/AIProviderService';
import { logger } from '../utils/logger';

const router = Router();
const aiProviderService = new AIProviderService();

/**
 * GET /api/ai-providers/health
 * Get health status of all AI providers
 */
router.get('/health', async (req, res) => {
  try {
    const healthStatus = aiProviderService.getProviderHealth();
    
    const overallHealth = {
      status: healthStatus.some(p => p.status === 'healthy') ? 'healthy' : 
              healthStatus.some(p => p.status === 'degraded') ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      providers: healthStatus,
      summary: {
        total: healthStatus.length,
        healthy: healthStatus.filter(p => p.status === 'healthy').length,
        degraded: healthStatus.filter(p => p.status === 'degraded').length,
        unhealthy: healthStatus.filter(p => p.status === 'unhealthy').length
      }
    };

    res.json(overallHealth);
  } catch (error) {
    logger.error({ error }, 'Error getting AI provider health');
    res.status(500).json({
      error: 'Failed to get AI provider health',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ai-providers/config
 * Get AI provider configurations (without sensitive data)
 */
router.get('/config', async (req, res) => {
  try {
    const configurations = aiProviderService.getProviderConfigurations();
    
    res.json({
      providers: configurations,
      total: configurations.length,
      enabled: configurations.filter(p => p.enabled).length
    });
  } catch (error) {
    logger.error({ error }, 'Error getting AI provider configurations');
    res.status(500).json({
      error: 'Failed to get AI provider configurations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ai-providers/health/check
 * Trigger manual health check for all providers
 */
router.post('/health/check', async (req, res) => {
  try {
    await aiProviderService.triggerHealthCheck();
    
    // Wait a moment for health checks to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const healthStatus = aiProviderService.getProviderHealth();
    
    res.json({
      message: 'Health check triggered successfully',
      timestamp: new Date().toISOString(),
      providers: healthStatus
    });
  } catch (error) {
    logger.error({ error }, 'Error triggering AI provider health check');
    res.status(500).json({
      error: 'Failed to trigger health check',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/ai-providers/:providerName/enabled
 * Enable or disable a specific provider
 */
router.put('/:providerName/enabled', async (req, res) => {
  try {
    const { providerName } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'enabled field must be a boolean'
      });
    }

    const success = aiProviderService.setProviderEnabled(providerName, enabled);
    
    if (!success) {
      return res.status(404).json({
        error: 'Provider not found',
        message: `Provider ${providerName} not found`
      });
    }

    res.json({
      message: `Provider ${providerName} ${enabled ? 'enabled' : 'disabled'} successfully`,
      providerName,
      enabled
    });
  } catch (error) {
    logger.error({ error }, 'Error updating provider status');
    res.status(500).json({
      error: 'Failed to update provider status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ai-providers/test/completion
 * Test chat completion with fallback
 */
router.post('/test/completion', async (req, res) => {
  try {
    const { message = 'Hello, this is a test message.' } = req.body;

    const response = await aiProviderService.createChatCompletion({
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Respond briefly to test messages.' },
        { role: 'user', content: message }
      ]
    });

    if (!response.success) {
      return res.status(503).json({
        error: 'AI provider test failed',
        message: response.error,
        provider: response.provider,
        retryCount: response.retryCount
      });
    }

    res.json({
      success: true,
      message: 'AI provider test completed successfully',
      provider: response.provider,
      responseTime: response.responseTime,
      retryCount: response.retryCount,
      response: response.data.choices[0].message.content,
      usage: response.data.usage
    });
  } catch (error) {
    logger.error({ error }, 'Error testing AI provider completion');
    res.status(500).json({
      error: 'Failed to test AI provider',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ai-providers/test/embedding
 * Test embedding creation with fallback
 */
router.post('/test/embedding', async (req, res) => {
  try {
    const { text = 'This is a test text for embedding creation.' } = req.body;

    const response = await aiProviderService.createEmbedding({
      input: text
    });

    if (!response.success) {
      return res.status(503).json({
        error: 'AI provider embedding test failed',
        message: response.error,
        provider: response.provider,
        retryCount: response.retryCount
      });
    }

    res.json({
      success: true,
      message: 'AI provider embedding test completed successfully',
      provider: response.provider,
      responseTime: response.responseTime,
      retryCount: response.retryCount,
      embeddingLength: response.data.data[0].embedding.length,
      usage: response.data.usage
    });
  } catch (error) {
    logger.error({ error }, 'Error testing AI provider embedding');
    res.status(500).json({
      error: 'Failed to test AI provider embedding',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
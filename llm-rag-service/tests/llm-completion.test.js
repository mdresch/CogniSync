// tests/llm-completion.test.js
// Test for /api/llm/completion endpoint

const request = require('supertest');
const app = require('../src/server');

describe('/api/llm/completion', () => {
  it('should return a completion for a valid prompt', async () => {
    const res = await request(app)
      .post('/api/llm/completion')
      .send({ prompt: 'Hello, world!' })
      .set('Accept', 'application/json');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('completion');
    expect(typeof res.body.completion).toBe('string');
  });

  it('should return 400 for missing prompt', async () => {
    const res = await request(app)
      .post('/api/llm/completion')
      .send({})
      .set('Accept', 'application/json');
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should handle internal errors gracefully', async () => {
    // Simulate error by sending a prompt that triggers an error in the service
    const res = await request(app)
      .post('/api/llm/completion')
      .send({ prompt: '__TRIGGER_ERROR__' })
      .set('Accept', 'application/json');
    // Accept either 500 or 400 depending on implementation
    expect([400, 500]).toContain(res.statusCode);
    expect(res.body).toHaveProperty('error');
  });
});

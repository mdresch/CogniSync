# LLM/RAG Service Test Suite

This directory contains comprehensive tests for the LLM/RAG service, designed to validate all major functionality and easily clean up test data.

## Test Files

### Core Tests
- **`health-check.test.js`** - Tests service health and status endpoints
- **`embeddings.test.js`** - Tests Azure OpenAI embedding functionality
- **`llm-query.test.js`** - Tests LLM query processing and chat completions  
- **`analytics.test.js`** - Tests analytics collection and reporting

### Utilities
- **`run-tests.js`** - Master test runner that executes all tests
- **`cleanup.js`** - Cleans up test data and resets the environment

## Usage

### Prerequisites
Make sure the LLM/RAG service is running:
```bash
cd D:\Source\Repos\API-Management-Platform\cogni-sync-platform\llm-rag-service
npm start
```

### Running All Tests
```bash
# From the llm-rag-service directory
node tests/run-tests.js
```

### Running Individual Tests
```bash
# Health check only
node tests/run-tests.js health

# Embeddings tests only  
node tests/run-tests.js embeddings

# LLM query tests only
node tests/run-tests.js llm

# Analytics tests only
node tests/run-tests.js analytics
```

### Running Individual Test Files Directly
```bash
# Direct execution of specific test files
node tests/health-check.test.js
node tests/embeddings.test.js
node tests/llm-query.test.js
node tests/analytics.test.js
```

### Cleaning Up Test Data
```bash
# Clean up all test data
node tests/cleanup.js

# Clean up and verify system is working
node tests/cleanup.js --verify
```

## Test Coverage

### Health Check Tests
- ✅ Service availability and response time
- ✅ Database connectivity status
- ✅ AI service health (embeddings, LLM, vectorDB)
- ✅ Memory usage and uptime metrics

### Embeddings Tests  
- ✅ Create single text embeddings
- ✅ Process document with chunking
- ✅ Search embeddings by similarity
- ✅ Azure OpenAI integration validation

### LLM Query Tests
- ✅ Simple question answering
- ✅ Contextual queries with metadata
- ✅ Analytics-focused queries
- ✅ Intent recognition and entity extraction

### Analytics Tests
- ✅ Metrics collection and retrieval
- ✅ Usage statistics over time
- ✅ Event creation and tracking
- ✅ Popular query analysis

## Test Data

All tests use isolated tenant IDs to prevent conflicts:
- `test-tenant-embeddings` - Embedding tests
- `test-tenant-llm` - LLM query tests  
- `test-tenant-analytics` - Analytics tests
- `test-tenant` - General/health tests

## Output Format

Tests provide detailed output with:
- ✅/❌ Status indicators
- 📊 Metrics and measurements
- 📝 Response previews
- ⏱️ Performance timings
- 🎯 Quality indicators (confidence, similarity scores)

## Troubleshooting

### Service Not Responding
```bash
# Check if service is running
curl -X GET http://localhost:3003/health

# Restart service if needed
npm start
```

### Azure OpenAI Errors
Check your `.env` file has correct Azure OpenAI configuration:
```env
AI_PROVIDER=azure
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4
```

### Database Issues
```bash
# Reset database if needed
npm run db:reset
```

### Test Data Conflicts
```bash
# Clean up all test data
node tests/cleanup.js
```

## Adding New Tests

To add new tests:
1. Create a new `.test.js` file following the existing pattern
2. Export test functions for individual execution
3. Add the test to `run-tests.js` in the master suite
4. Update test tenants in `cleanup.js` if needed

## Dependencies

Tests use:
- `axios` for HTTP requests
- Node.js built-in modules (no additional test framework required)
- Colorful console output with emojis for readability

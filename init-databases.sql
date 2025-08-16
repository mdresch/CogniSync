-- Initialize databases for CogniSync services
-- This script creates separate databases for each service

-- Create databases
CREATE DATABASE IF NOT EXISTS atlassian_sync;
CREATE DATABASE IF NOT EXISTS knowledge_graph;
CREATE DATABASE IF NOT EXISTS llm_rag;

-- Grant permissions to the cogni_sync user
GRANT ALL PRIVILEGES ON DATABASE atlassian_sync TO cogni_sync;
GRANT ALL PRIVILEGES ON DATABASE knowledge_graph TO cogni_sync;
GRANT ALL PRIVILEGES ON DATABASE llm_rag TO cogni_sync;
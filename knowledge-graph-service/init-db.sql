-- Initialize CogniSync Knowledge Graph Database

-- Create database if not exists (handled by Docker Compose environment)

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schemas for multi-tenant support (optional)
-- CREATE SCHEMA IF NOT EXISTS tenant_default;
-- CREATE SCHEMA IF NOT EXISTS tenant_example;

-- Set default search path
-- SET search_path TO tenant_default, public;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE knowledge_graph TO cogni_sync;
GRANT ALL ON SCHEMA public TO cogni_sync;

-- The actual tables will be created by Prisma migrations

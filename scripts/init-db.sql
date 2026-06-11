-- VrdCapital - Initial Database Setup
-- This script runs once when PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas for microservices
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS clients;
CREATE SCHEMA IF NOT EXISTS portfolio;
CREATE SCHEMA IF NOT EXISTS orders;
CREATE SCHEMA IF NOT EXISTS reports;
CREATE SCHEMA IF NOT EXISTS audit;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE vrdcapital TO vrdcapital;
GRANT ALL ON SCHEMA auth TO vrdcapital;
GRANT ALL ON SCHEMA clients TO vrdcapital;
GRANT ALL ON SCHEMA portfolio TO vrdcapital;
GRANT ALL ON SCHEMA orders TO vrdcapital;
GRANT ALL ON SCHEMA reports TO vrdcapital;
GRANT ALL ON SCHEMA audit TO vrdcapital;

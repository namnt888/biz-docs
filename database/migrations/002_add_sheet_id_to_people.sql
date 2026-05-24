-- Migration: Add sheet_id to people table
-- Run this in Supabase Dashboard -> SQL Editor

ALTER TABLE people ADD COLUMN IF NOT EXISTS sheet_id TEXT;
COMMENT ON COLUMN people.sheet_id IS 'Google Sheet ID for n8n sync per person';

-- Also add metadata column for future extensibility
ALTER TABLE people ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
COMMENT ON COLUMN people.metadata IS 'Flexible metadata storage (e.g. sheet_id, aliases, notes)';

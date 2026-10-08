CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general','preference','project','workflow','technical')),
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user','assistant','model','workflow')),
  confidence DOUBLE PRECISION NOT NULL DEFAULT 1 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_memories_user_updated_idx ON agent_memories(user_id, updated_at DESC);

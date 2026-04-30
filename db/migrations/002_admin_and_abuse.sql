CREATE TABLE IF NOT EXISTS tenant_settings (
	tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
	connector_platform TEXT NOT NULL DEFAULT 'custom-feed',
	product_api_url TEXT,
	product_feed_url TEXT,
	shoptet_premium BOOLEAN NOT NULL DEFAULT FALSE,
	llm_provider TEXT NOT NULL DEFAULT 'openai',
	llm_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
	llm_api_key_alias TEXT NOT NULL DEFAULT 'default-key',
	abuse_protection_enabled BOOLEAN NOT NULL DEFAULT TRUE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
	id UUID PRIMARY KEY,
	tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
	file_name TEXT NOT NULL,
	content_type TEXT NOT NULL,
	size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
	ingestion_status TEXT NOT NULL DEFAULT 'queued',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_documents_tenant_idx ON knowledge_documents (tenant_id);

CREATE TABLE IF NOT EXISTS abuse_policies (
	tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
	soft_daily_token_limit INTEGER NOT NULL,
	hard_daily_token_limit INTEGER NOT NULL,
	hourly_message_limit_per_ip INTEGER NOT NULL,
	hourly_message_limit_per_tenant INTEGER NOT NULL,
	max_input_chars INTEGER NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS abuse_events (
	id UUID PRIMARY KEY,
	tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
	event_type TEXT NOT NULL,
	severity TEXT NOT NULL,
	details JSONB NOT NULL DEFAULT '{}'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS abuse_events_tenant_created_idx ON abuse_events (tenant_id, created_at DESC);

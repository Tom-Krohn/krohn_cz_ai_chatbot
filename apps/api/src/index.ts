import { serve } from '@hono/node-server';

import { app } from './app.js';
import { envConfig } from './lib/env.js';

serve(
	{
		fetch: app.fetch,
		port: envConfig.API_PORT,
	},
	(info) => {
		console.log(`API listening on http://localhost:${info.port}`);
	},
);

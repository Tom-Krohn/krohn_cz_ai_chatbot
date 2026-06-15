import pg from 'pg';
import { envConfig } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
	connectionString: envConfig.DATABASE_URL,
});

export async function query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
	return pool.query<T>(text, params);
}

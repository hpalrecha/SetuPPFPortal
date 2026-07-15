import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import 'dotenv/config';

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const targets = [
  { id: 'ced851ab-1c4f-40bc-8620-9f1d6b9aad15', name: 'tytfyhhfhy' },
  { id: '30b6446a-0de3-4121-8ccd-f2df987199a4', name: 'dummy' },
  { id: 'fb8b5571-93f4-4a35-b660-c05bd5596a35', name: 'dummy test' },
  { id: '12687355-915a-4cb6-9bb8-6349d59d877c', name: 'test' },
  { id: '5e8313f2-e0fe-44ca-9cec-584a38afc96f', name: 'test jaggi' },
];

for (const t of targets) {
  try {
    const r = await pool.query('DELETE FROM users WHERE id = $1', [t.id]);
    console.log(`DELETED: ${t.name} (${t.id}) - rows affected: ${r.rowCount}`);
  } catch (e) {
    console.log(`FAILED: ${t.name} (${t.id}) - ${e.message}`);
  }
}

await pool.end();

import dotenv from 'dotenv';
import { loadConfig } from '../server/config';
import { openDb } from '../server/db';
import { seedDemo } from '../server/seed';

dotenv.config();
const config = loadConfig();
const db = openDb(config.databasePath);
await seedDemo(db, config);
console.log(`Demo data present in ${config.databasePath}`);

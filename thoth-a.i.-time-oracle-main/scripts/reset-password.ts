import dotenv from 'dotenv';
import { loadConfig } from '../server/config';
import { openDb } from '../server/db';
import { hashPassword, validatePasswordStrength } from '../server/security';

dotenv.config();
const [email, password] = process.argv.slice(2);
if (!email || !password) { console.error('Usage: npm run admin:reset-password -- <email> <new-password>'); process.exit(1); }
const weak = validatePasswordStrength(password);
if (weak) { console.error(weak); process.exit(1); }
const db = openDb(loadConfig().databasePath);
const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase()) as { id: string } | undefined;
if (!user) { console.error('No such user'); process.exit(1); }
const now = new Date().toISOString();
db.prepare('UPDATE users SET password_hash = ?, password_updated_at = ? WHERE id = ?').run(await hashPassword(password), now, user.id);
db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
console.log('Password reset; existing sessions revoked.');

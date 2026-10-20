import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const k = trimmed.slice(0, eq).trim();
        let v = trimmed.slice(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        process.env[k] = v;
      }
    }
  } catch {}
}

// Check root .env, server/.env, and cwd .env
loadFile(path.resolve(__dirname, '../../../.env'));
loadFile(path.resolve(__dirname, '../../.env'));
loadFile(path.resolve(process.cwd(), '.env'));

// Purge any revoked/exposed secret keys from container environment
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.ZITE_API_KEY;

const TARGET_SUPABASE_URL = 'https://xurvumenaszahorrxhxf.supabase.co';
const TARGET_PUBLISHABLE_KEY = 'sb_publishable_0uYtc2gANKbcM2trdrO8zA_DINcfSiZ';

// Clean placeholder or truncated keys provided by host container
if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project') || process.env.SUPABASE_URL.includes('placeholder')) {
  process.env.SUPABASE_URL = TARGET_SUPABASE_URL;
}
if (!process.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL.includes('your-project') || process.env.VITE_SUPABASE_URL.includes('placeholder')) {
  process.env.VITE_SUPABASE_URL = TARGET_SUPABASE_URL;
}
if (!process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY.endsWith('...') || process.env.SUPABASE_PUBLISHABLE_KEY.length < 25) {
  process.env.SUPABASE_PUBLISHABLE_KEY = TARGET_PUBLISHABLE_KEY;
}
if (!process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY.endsWith('...') || process.env.VITE_SUPABASE_ANON_KEY.length < 25) {
  process.env.VITE_SUPABASE_ANON_KEY = TARGET_PUBLISHABLE_KEY;
}

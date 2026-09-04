import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

/** Always load server/.env, even if the process was started from the repo root. */
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') });

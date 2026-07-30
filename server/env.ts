import dotenv from 'dotenv';

// Imported for its side effect, by every module that reads process.env at load
// time. ESM evaluates imports in order, so importing this first is what
// guarantees the variables exist before anything reads them — on Vercel the
// platform injects them and both calls are harmless no-ops.
dotenv.config(); // loads .env
dotenv.config({ path: '.env.local', override: true }); // overrides with .env.local

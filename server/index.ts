import { config } from 'dotenv';
config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRouter } from './routes.js';
import { syncIndex } from './indexer.js';

const app = express();
const port = process.env.PORT || 9498;

app.use(express.json());
app.use(createRouter());

if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log('Starting initial index sync...');
  const result = syncIndex();
  console.log(`Sync complete: ${result.indexed} indexed, ${result.skipped} skipped, ${result.errors} errors (${result.duration}ms)`);
});

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(
  express.json({
    limit: '1mb',
  })
);
app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

if (process.env.NODE_ENV === 'production') {
  const candidates = [
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(__dirname, '../../frontend/dist'),
  ];
  const frontendDist = candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')));
  if (frontendDist) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/health') {
        return next();
      }
      res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
        if (err) next(err);
      });
    });
  } else {
    console.warn('frontend/dist not found — API only mode');
  }
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

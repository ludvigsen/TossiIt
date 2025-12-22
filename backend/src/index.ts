import express from 'express';
import path from 'path';
import { config } from './config';
import dumpRoutes from './routes/dump';
import inboxRoutes from './routes/inbox';
import authRoutes from './routes/auth';
import eventRoutes from './routes/events';
import summaryRoutes from './routes/summary';

const app = express();

app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/', (req, res) => {
  res.send('AI Life OS Backend is running');
});

// Routes
app.use('/api/dump', dumpRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/summary', summaryRoutes);

const start = async () => {
  try {
    app.listen(config.port, () => {
      console.log(`Server is running on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();


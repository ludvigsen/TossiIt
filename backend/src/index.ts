import express from 'express';
import path from 'path';
import { config } from './config';
import dumpRoutes from './routes/dump';
import inboxRoutes from './routes/inbox';
import authRoutes from './routes/auth';
import eventRoutes from './routes/events';
import summaryRoutes from './routes/summary';
import * as functions from 'firebase-functions';

const app = express();

app.use(express.json());

// Serve uploaded files statically (Only works for local/filesystem, not recommended for serverless)
// In production, we should use S3/Storage URLs directly.
if (process.env.NODE_ENV !== 'production') {
    app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
}

app.get('/', (req, res) => {
  res.send('AI Life OS Backend is running');
});

// Routes
app.use('/api/dump', dumpRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/summary', summaryRoutes);

// Export for Firebase Functions
export const api = functions.https.onRequest(app);

// Local Start
if (require.main === module) {
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
}


import express from 'express';
import path from 'path';
import { config } from './config';
import dumpRoutes from './routes/dump';
import inboxRoutes from './routes/inbox';
import authRoutes from './routes/auth';
import eventRoutes from './routes/events';
import summaryRoutes from './routes/summary';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import dotenv from 'dotenv';
import * as admin from 'firebase-admin';

dotenv.config();

// Initialize Firebase Admin (Required for Storage/Auth)
admin.initializeApp();

// Set global options for Gen 2 functions
setGlobalOptions({ maxInstances: 10 });

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

// Export for Firebase Functions (Gen 2)
// We declare which secrets this function needs access to.
// Note: Ensure these secrets are set using `firebase functions:secrets:set SECRET_NAME`
// invoker: 'public' allows unauthenticated calls (needed for auth/sync-token)
export const api = onRequest({ 
    secrets: ["GEMINI_API_KEY", "DATABASE_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    region: "us-central1",
    invoker: "public",
}, app);

// Local Start (for direct node/ts-node, not Cloud Run)
if (process.env.RUN_LOCAL === 'true' || require.main === module) {
    const start = async () => {
        try {
            app.listen(config.port, () => {
                console.log(`(local) Server is running on port ${config.port}`);
            });
        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    };
    start();
}


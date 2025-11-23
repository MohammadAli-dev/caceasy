import express from 'express';
import cors from 'cors';
import { config } from './config';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import batchRoutes from './routes/batches';
import couponRoutes from './routes/coupons';
import scanRoutes from './routes/scan';
import userRoutes from './routes/users';
import adminRoutes from './routes/admin';
import adminAnalyticsRoutes from './routes/adminAnalytics';

import dealerRoutes from './routes/dealer';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/', healthRoutes);
app.use('/auth', authRoutes);
app.use('/batches', batchRoutes);
app.use('/coupons', couponRoutes);
app.use('/scan', scanRoutes);
app.use('/users', userRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/analytics', adminAnalyticsRoutes);
app.use('/dealer', dealerRoutes);

if (require.main === module) {
    app.listen(config.port, () => {
        console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });
}

export default app;

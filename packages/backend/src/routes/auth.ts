import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { config } from '../config';

const router = Router();

// In-memory rate limiting (simple implementation)
const otpRateLimits = new Map<string, number>();

// POST /auth/otp
router.post('/otp',
    [
        body('phone').matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number'),
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { phone } = req.body;

        // Simple rate limiting: 1 OTP per phone per minute
        const now = Date.now();
        const lastRequest = otpRateLimits.get(phone);
        if (lastRequest && now - lastRequest < 60000) {
            return res.status(429).json({ error: 'Too many requests', message: 'Please wait before requesting another OTP' });
        }

        try {
            // Generate 6-digit OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            console.log(`[OTP] Phone: ${phone}, OTP: ${otp}`); // Log instead of sending SMS

            //Hash the OTP
            const otpHash = await bcrypt.hash(otp, 10);

            // Store OTP with 5-minute expiry
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
            await query(
                'INSERT INTO otps (phone, otp_hash, expires_at) VALUES ($1, $2, $3)',
                [phone, otpHash, expiresAt]
            );

            otpRateLimits.set(phone, now);

            res.status(202).json({ message: 'OTP sent' });
        } catch (error) {
            console.error('Error generating OTP:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// POST /auth/verify
router.post('/verify',
    [
        body('phone').isString().notEmpty(),
        body('otp').matches(/^\d{6}$/).withMessage('OTP must be 6 digits'),
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { phone, otp } = req.body;

        try {
            // Get most recent non-verified OTP for this phone
            const otpRes = await query(
                `SELECT * FROM otps 
         WHERE phone = $1 AND verified = false AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
                [phone]
            );

            if (otpRes.rowCount === 0) {
                return res.status(401).json({ error: 'Invalid OTP', message: 'OTP not found or expired' });
            }

            const otpRecord = otpRes.rows[0];

            // Verify OTP
            const isValid = await bcrypt.compare(otp, otpRecord.otp_hash);
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid OTP', message: 'Incorrect OTP' });
            }

            // Mark OTP as verified
            await query('UPDATE otps SET verified = true WHERE id = $1', [otpRecord.id]);

            // Check if phone belongs to a dealer
            const dealerRes = await query('SELECT * FROM dealers WHERE phone = $1', [phone]);
            let entity;
            let role = 'user';

            if ((dealerRes.rowCount || 0) > 0) {
                entity = dealerRes.rows[0];
                role = 'dealer';
            } else {
                // Find or create user
                let userRes = await query('SELECT * FROM users WHERE phone = $1', [phone]);

                if (userRes.rowCount === 0) {
                    // Create new user
                    userRes = await query(
                        'INSERT INTO users (phone) VALUES ($1) RETURNING *',
                        [phone]
                    );
                    entity = userRes.rows[0];
                } else {
                    entity = userRes.rows[0];
                }
            }

            // Generate JWT
            const token = jwt.sign(
                { sub: entity.id, phone: phone, role },
                config.jwtSecret,
                { expiresIn: '7d' }
            );

            res.json({
                token,
                user: {
                    id: entity.id,
                    phone: phone,
                    name: entity.name, // dealers have name, users might not initially
                    role,
                    created_at: entity.created_at,
                },
            });
        } catch (error) {
            console.error('Error verifying OTP:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

export default router;

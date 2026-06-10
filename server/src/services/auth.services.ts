import { pool } from '../config/db';
import { env } from '../config/env';
import { log } from './audit.services';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export const registerUser = async (name: string, email: string, password: string) => {
    const client = await pool.connect();
    try {
        const emailCheck = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (emailCheck.rows.length > 0) {
            throw new Error('Email is already registered');
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const { rows } = await client.query(
            'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at', 
            [email, passwordHash, name]
        );

        const user = rows[0];

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            env.jwt.secret,
            { expiresIn: env.jwt.expiresIn as any }
        );

        await log({
            entity_type: user,
            entity_id: user.id,
            action: 'USER_REGISTERED',
            new_data: { email: user.email, name: user.name },
            ip_address: '127.0.0.1'
        });

        return { user, token };

    } finally {
        client.release();
    }
};
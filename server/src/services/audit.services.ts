import { pool } from '../config/db.js';
import type { AuditLog } from '../types/index.js'

export const log = async ({
    entity_type, 
    entity_id, 
    action, 
    old_data = null, 
    new_data = null, 
    ip_address
} : Partial<AuditLog>) => {
    try {
        const client = new pool.connect();
        try {
            await client.query(
                `INSERT INTO audit_log (entity_type, entity_id, action, old_data, new_data, ip_address) 
                VALUES ($1, $2, $3, $4, $5, $6)`, [
                    entity_type, 
                    entity_id, 
                    action, 
                    old_data, 
                    new_data, 
                    ip_address
                ]
            );
        } finally {
            client.release();
        }
    } catch(err) {
        console.error('Audit log failure (logged but not thrown):', err);
    }
import { Request, Response, NextFunction } from "express";
import { loginUser, registerUser } from "../services/auth.services.js";

export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password, name } = req.body;
        const ipAddress = req.ip || '127.0.0.1';
        const { user, token } = await registerUser(name, email, password, ipAddress);

        res.status(201).json({
            status: 'success',
            data: { user, token }
        });
    } catch (error) {
        next(error);
    }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;
        const ipAddress = req.ip || '127.0.0.1';
        const { user, token } = await loginUser(email, password, ipAddress);

        res.status(200).json({
            status: 'success',
            data: { user, token }
        });
    } catch (error) {
        next(error);
    }
};
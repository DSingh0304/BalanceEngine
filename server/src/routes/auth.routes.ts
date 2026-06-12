import { Router } from "express";
import validate from "../middleware/validate.js";
import { loginSchema, registerSchema } from "../validators/index.js";
import { login, register } from "../controllers/auth.controllers.js";

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);

export default router;
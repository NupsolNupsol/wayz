import { Router } from "express";
import { authenticate, requireAgent } from "../middlewares/auth.js";
import { otpController } from "../controllers/otp.controller.js";

const router = Router();
router.use(authenticate, requireAgent);

router.post("/send", otpController.send);
router.post("/verify", otpController.verify);
router.post("/peek", otpController.peek);

export default router;

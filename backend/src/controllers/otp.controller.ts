import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { peekOtp, sendOtp, verifyOtp } from "../services/otp.service.js";

const intent = z.enum(["VERIFY_PHONE", "HANDOVER_BAG"]);
const channel = z.enum(["WHATSAPP", "EMAIL"]).default("WHATSAPP");

export const otpController = {
  send: asyncHandler(async (req, res) => {
    const body = z.object({ phone: z.string().min(3), intent, channel }).parse(req.body);
    res.json({
      success: true,
      data: await sendOtp(body.phone, body.intent, { channel: body.channel }),
    });
  }),

  verify: asyncHandler(async (req, res) => {
    const body = z
      .object({ phone: z.string().min(3), intent, code: z.string().min(1) })
      .parse(req.body);
    res.json({
      success: true,
      data: { verified: verifyOtp(body.phone, body.intent, body.code) },
    });
  }),

  peek: asyncHandler(async (req, res) => {
    if (!env.OTP_TEST_PEEK) throw ApiError.forbidden("OTP peek is disabled.");
    const body = z.object({ phone: z.string().min(3), intent }).parse(req.body);
    res.json({
      success: true,
      data: { code: peekOtp(body.phone, body.intent) },
    });
  }),
};

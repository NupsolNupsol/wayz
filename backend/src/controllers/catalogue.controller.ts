import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { scopeFromReq } from "../utils/scope.js";
import {
  listAssetTypes,
  listProducts,
  listUnits,
} from "../services/catalogue.service.js";
import { suggestPacking } from "../services/packing.service.js";
import type { EngineKind } from "../domain/types.js";

const suggestSchema = z.object({
  bags: z
    .array(
      z.object({
        category: z.enum(["SOFT", "HARD", "OVERSIZE", "FRAGILE"]).optional(),
        dimensions: z
          .object({ w: z.number(), h: z.number(), d: z.number() })
          .optional(),
        weight: z.number().optional(),
      }),
    )
    .min(1),
});

export const catalogueController = {
  products: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req);
    res.json({
      success: true,
      data: await listProducts(s.tenantId, req.query.engineKind as EngineKind | undefined, s),
    });
  }),

  assetTypes: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req);
    res.json({
      success: true,
      data: await listAssetTypes(s.tenantId, req.query.engineKind as EngineKind | undefined, s),
    });
  }),

  units: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req);
    res.json({ success: true, data: await listUnits(s.tenantId, s.stationId, s) });
  }),

  packingSuggestions: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req);
    const { bags } = suggestSchema.parse(req.body);
    res.json({
      success: true,
      data: await suggestPacking(s.tenantId, s.stationId, bags),
    });
  }),
};

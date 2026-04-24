/**
 * OptiAsset Backend — Dashboard Routes (RBAC-Protected)
 */

const express = require("express");
const router = express.Router();
const supabase = require("../database");
const { authenticateToken, requirePrivilege } = require("../middleware/auth");

/**
 * GET /dashboard/stats
 * Returns dashboard statistics scoped to the user's role.
 * Admin sees everything; Employee sees only their own data.
 */
router.get(
  "/stats",
  authenticateToken,
  requirePrivilege("view:dashboard"),
  async (req, res) => {
    try {
      if (req.user.permissions.includes("view:all_assets")) {
        // ── Admin Dashboard Stats ─────────────────────────────
        const { data: assets } = await supabase
          .from("assets")
          .select("status");

        const allAssets = assets || [];
        const total = allAssets.length;
        const assigned = allAssets.filter((a) => a.status === "assigned").length;
        const inStock = allAssets.filter((a) => a.status === "in_stock").length;
        const inRepair = allAssets.filter((a) => a.status === "in_repair").length;
        const retired = allAssets.filter((a) => a.status === "retired").length;
        const lost = allAssets.filter((a) => a.status === "lost").length;

        // Total employees
        const { count: totalEmployees } = await supabase
          .from("employees")
          .select("id", { count: "exact", head: true });

        // Recent assignments
        const { data: recent } = await supabase
          .from("assets")
          .select("asset_tag, name, status, updated_at, profiles!assigned_to(full_name)")
          .eq("status", "assigned")
          .order("updated_at", { ascending: false })
          .limit(10);

        const formattedRecent = (recent || []).map(r => ({
          asset_tag: r.asset_tag,
          name: r.name,
          assigned_to: r.profiles?.full_name || "Unknown",
          date: new Date(r.updated_at || r.created_at).toISOString().split('T')[0]
        }));

        res.json({
          total_assets: total,
          assigned_assets: assigned,
          in_stock_assets: inStock,
          in_repair_assets: inRepair,
          retired_assets: retired,
          lost_assets: lost,
          total_employees: totalEmployees || 0,
          recent_assignments: formattedRecent,
        });
      } else {
        // ── Employee Dashboard Stats ──────────────────────────
        const { data: myAssets } = await supabase
          .from("assets")
          .select("*")
          .eq("assigned_to", req.user.id);

        const assets = myAssets || [];

        res.json({
          total_assets: assets.length,
          assigned_assets: assets.length,
          in_stock_assets: 0,
          in_repair_assets: 0,
          retired_assets: 0,
          lost_assets: 0,
          total_employees: 0,
          recent_assignments: [],
        });
      }
    } catch (err) {
      res.status(500).json({ error: "Internal server error." });
    }
  }
);

module.exports = router;

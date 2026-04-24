/**
 * OptiAsset Backend — Asset Routes (RBAC-Protected)
 *
 * Every route uses requirePrivilege to enforce API-level access control.
 * Even if a frontend button is hidden, direct API calls are still blocked.
 *
 * GET    /assets          → requirePrivilege("view:all_assets")
 * GET    /assets/my       → requirePrivilege("view:my_gear")
 * GET    /assets/:id      → requirePrivilege("view:all_assets")
 * POST   /assets          → requirePrivilege("manage:assets")
 * PUT    /assets/:id      → requirePrivilege("manage:assets")
 * DELETE /assets/:id      → requirePrivilege("delete:asset")
 */

const express = require("express");
const router = express.Router();
const supabase = require("../database");
const { authenticateToken, requirePrivilege } = require("../middleware/auth");

// All asset routes require authentication
router.use(authenticateToken);

/**
 * GET /assets
 * List all assets with optional filters. Requires 'view:all_assets'.
 */
router.get("/", requirePrivilege("view:all_assets"), async (req, res) => {
  try {
    const {
      status: statusFilter,
      category,
      location,
      search,
      page = 1,
      per_page = 20,
    } = req.query;

    let query = supabase.from("assets").select("*, profiles!assigned_to(full_name)", { count: "exact" });

    if (statusFilter) query = query.eq("status", statusFilter);
    if (category) query = query.eq("category", category);
    if (location) query = query.eq("location", location);
    if (search) {
      query = query.or(
        `asset_tag.ilike.%${search}%,name.ilike.%${search}%,serial_number.ilike.%${search}%`
      );
    }

    const offset = (parseInt(page) - 1) * parseInt(per_page);
    query = query
      .range(offset, offset + parseInt(per_page) - 1)
      .order("created_at", { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: "Failed to fetch assets." });
    }

    res.json({
      data,
      total: count,
      page: parseInt(page),
      per_page: parseInt(per_page),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * GET /assets/my
 * Get assets assigned to the current user. Requires 'view:my_gear'.
 */
router.get("/my", requirePrivilege("view:my_gear"), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("assigned_to", req.user.id)
      .eq("status", "assigned");

    if (error) {
      return res.status(500).json({ error: "Failed to fetch your assets." });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * GET /assets/:id
 * Get a single asset by ID. Requires 'view:all_assets'.
 */
router.get("/:id", requirePrivilege("view:all_assets"), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Asset not found." });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * POST /assets
 * Create a new asset. Requires 'manage:assets'.
 */
router.post("/", requirePrivilege("manage:assets"), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("assets")
      .insert(req.body)
      .select()
      .single();

    if (error) {
      return res
        .status(400)
        .json({ error: "Failed to create asset.", detail: error.message });
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * PUT /assets/:id
 * Update an asset. Requires 'manage:assets'.
 */
router.put("/:id", requirePrivilege("manage:assets"), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("assets")
      .update(req.body)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Asset not found." });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * DELETE /assets/:id
 * Delete an asset. Requires 'delete:asset'.
 *
 * This is the example from the assignment brief:
 *   requirePrivilege("delete:asset")
 */
router.delete("/:id", requirePrivilege("delete:asset"), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("assets")
      .delete()
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Asset not found." });
    }

    res.json({ message: "Asset deleted successfully.", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;

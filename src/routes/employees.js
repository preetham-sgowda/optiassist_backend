/**
 * OptiAsset Backend — Employee Routes (RBAC-Protected)
 */

const express = require("express");
const router = express.Router();
const supabase = require("../database");
const { authenticateToken, requirePrivilege } = require("../middleware/auth");

// All employee routes require authentication
router.use(authenticateToken);

/**
 * GET /employees
 * List all employees. Requires 'view:all_employees'.
 */
router.get("/", requirePrivilege("view:all_employees"), async (req, res) => {
  try {
    const {
      department,
      location,
      status: statusFilter,
      search,
      page = 1,
      per_page = 20,
    } = req.query;

    let query = supabase.from("employees").select("*", { count: "exact" });

    if (department) query = query.eq("department", department);
    if (location) query = query.eq("location", location);
    if (statusFilter) query = query.eq("status", statusFilter);
    if (search) {
      query = query.or(
        `employee_code.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const offset = (parseInt(page) - 1) * parseInt(per_page);
    query = query
      .range(offset, offset + parseInt(per_page) - 1)
      .order("created_at", { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: "Failed to fetch employees." });
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
 * GET /employees/:id
 * Get a single employee. Requires 'view:all_employees'.
 */
router.get("/:id", requirePrivilege("view:all_employees"), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Employee not found." });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * POST /employees
 * Create a new employee. Requires 'manage:employees'.
 */
router.post("/", requirePrivilege("manage:employees"), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("employees")
      .insert(req.body)
      .select()
      .single();

    if (error) {
      return res
        .status(400)
        .json({ error: "Failed to create employee.", detail: error.message });
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * PUT /employees/:id
 * Update an employee. Requires 'manage:employees'.
 */
router.put("/:id", requirePrivilege("manage:employees"), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("employees")
      .update(req.body)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Employee not found." });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * DELETE /employees/:id
 * Delete an employee. Requires 'manage:employees'.
 */
router.delete("/:id", requirePrivilege("manage:employees"), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("employees")
      .delete()
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Employee not found." });
    }

    res.json({ message: "Employee deleted successfully.", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;

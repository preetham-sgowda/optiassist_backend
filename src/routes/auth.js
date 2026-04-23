/**
 * OptiAsset Backend — Auth Routes
 *
 * GET  /auth/me       → Returns current user profile + role + permissions
 * POST /auth/register → Admin-only: create a new user account
 * GET  /auth/roles    → Admin-only: list all roles
 */

const express = require("express");
const router = express.Router();
const supabase = require("../database");
const { authenticateToken, requirePrivilege } = require("../middleware/auth");

/**
 * GET /auth/me
 * Returns the authenticated user's profile, role, and permissions.
 * Called by the frontend on app load to build the RBAC context.
 */
router.get("/me", authenticateToken, async (req, res) => {
  try {
    // Fetch the full role object
    const { data: roleData, error } = await supabase
      .from("roles")
      .select("*")
      .eq("id", req.user.roleId)
      .single();

    if (error) {
      return res.status(500).json({ error: "Failed to fetch role data." });
    }

    res.json({
      user: {
        id: req.user.id,
        full_name: req.user.fullName,
        email: req.user.email,
        role_id: req.user.roleId,
        department: req.user.department,
        role: roleData,
      },
      role: roleData || { id: "", name: "unknown", permissions: [] },
      permissions: req.user.permissions,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * POST /auth/register
 * Admin-only: Register a new user.
 * Creates the user in Supabase Auth and their profile in the profiles table.
 */
router.post(
  "/register",
  authenticateToken,
  requirePrivilege("manage:users"),
  async (req, res) => {
    const { email, password, full_name, role_id, department } = req.body;

    if (!email || !password || !full_name || !role_id) {
      return res.status(400).json({
        error: "Missing required fields: email, password, full_name, role_id",
      });
    }

    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (authError) {
        return res.status(400).json({
          error: "Failed to create user.",
          detail: authError.message,
        });
      }

      // Create profile in profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: authData.user.id,
          full_name,
          email,
          role_id,
          department: department || null,
        });

      if (profileError) {
        return res.status(400).json({
          error: "User created but profile failed.",
          detail: profileError.message,
        });
      }

      res.status(201).json({
        message: "User registered successfully.",
        user_id: authData.user.id,
      });
    } catch (err) {
      res.status(500).json({ error: "Registration failed." });
    }
  }
);

/**
 * GET /auth/roles
 * Admin-only: List all available roles.
 */
router.get(
  "/roles",
  authenticateToken,
  requirePrivilege("manage:users"),
  async (req, res) => {
    try {
      const { data, error } = await supabase.from("roles").select("*");
      if (error) {
        return res.status(500).json({ error: "Failed to fetch roles." });
      }
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Internal server error." });
    }
  }
);

module.exports = router;

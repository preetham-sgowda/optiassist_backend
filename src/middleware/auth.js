/**
 * OptiAsset Backend — Authentication & RBAC Middleware
 *
 * Contains:
 * - authenticateToken: Verifies JWT from Authorization header, fetches user profile + role.
 * - requirePrivilege(privilege): Returns middleware that checks if user has the required permission.
 *
 * Usage:
 *   router.delete("/assets/:id", authenticateToken, requirePrivilege("delete:asset"), handler);
 */

const jwt = require("jsonwebtoken");
const config = require("../config");
const supabase = require("../database");

/**
 * Middleware: Authenticate the JWT token.
 * Decodes the Bearer token, fetches the user's profile and role from Supabase,
 * and attaches the enriched user object to req.user.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      detail: "Missing or invalid Authorization header. Expected: Bearer <token>",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Step 1: Verify the token with Supabase
    // This is more robust as it handles HS256, ES256, and EdDSA automatically.
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }

    const userId = authUser.id;

    // Step 2: Fetch user profile + role from Supabase
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*, roles(*)")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      return res.status(401).json({
        error: "Unauthorized",
        detail: "User profile not found.",
      });
    }

    // Step 3: Build enriched user object and attach to request
    const roleData = profile.roles || {};

    req.user = {
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      roleId: profile.role_id,
      department: profile.department,
      roleName: roleData.name || "",
      permissions: roleData.permissions || [],
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired." });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token." });
    }
    return res.status(401).json({ error: "Authentication failed." });
  }
}

/**
 * Middleware Factory: Require a specific privilege.
 *
 * This is the core RBAC enforcement mechanism.
 * It checks that the authenticated user's role includes the required privilege.
 * If not, returns HTTP 403 Forbidden.
 *
 * Usage:
 *   router.delete(
 *     "/assets/:id",
 *     authenticateToken,
 *     requirePrivilege("delete:asset"),
 *     deleteAssetHandler
 *   );
 *
 * The code never checks `if (user === 'Ben')`.
 * It checks `if (user.permissions.includes('delete:asset'))`.
 * If HR changes Ben to Admin tomorrow, no code changes needed.
 */
function requirePrivilege(privilege) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    if (!req.user.permissions.includes(privilege)) {
      return res.status(403).json({
        error: "Forbidden",
        detail: `Insufficient privileges. Required: '${privilege}'. Your role '${req.user.roleName}' does not have this permission.`,
      });
    }

    next();
  };
}

module.exports = { authenticateToken, requirePrivilege };

-- ============================================================
-- OptiAsset — RBAC Database Schema Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. ROLES TABLE
-- Stores role definitions with an array of permission strings.
-- This is the simplified RBAC model: no junction table needed.
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    permissions TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────
-- 2. PROFILES TABLE
-- Extends Supabase Auth users with app-specific data.
-- Every auth.users row gets a corresponding profiles row.
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    department TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────
-- 3. ASSETS TABLE
-- Core asset inventory table.
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_tag TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    serial_number TEXT,
    model TEXT,
    category TEXT,
    vendor TEXT,
    location TEXT,
    purchase_date DATE,
    purchase_cost NUMERIC(12,2),
    warranty_expiry DATE,
    condition TEXT DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'poor')),
    status TEXT DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'assigned', 'in_repair', 'retired', 'lost')),
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────
-- 4. EMPLOYEES TABLE
-- Employee directory (separate from auth users).
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_code TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    job_title TEXT,
    department TEXT,
    location TEXT,
    hire_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────
-- 5. SEED DATA — Roles with Permission Arrays
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.roles (name, description, permissions) VALUES
(
    'admin',
    'IT Administrator — Full access to all features',
    ARRAY[
        'manage:assets',
        'manage:employees',
        'manage:assignments',
        'manage:maintenance',
        'manage:settings',
        'manage:users',
        'view:dashboard',
        'view:all_assets',
        'view:all_employees',
        'delete:asset',
        'view:my_gear',
        'view:my_history',
        'create:issue_report'
    ]
),
(
    'manager',
    'Department Manager — Department-scoped access with request capabilities',
    ARRAY[
        'view:dashboard',
        'view:department_assets',
        'view:department_employees',
        'create:request',
        'view:my_gear',
        'view:my_history',
        'create:issue_report'
    ]
),
(
    'employee',
    'Standard Employee — View own assets and report issues',
    ARRAY[
        'view:my_gear',
        'view:my_history',
        'create:issue_report'
    ]
)
ON CONFLICT (name) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 6. AUTO-CREATE PROFILE ON SIGNUP
-- Trigger: when a new user signs up via Supabase Auth,
-- automatically create a profiles row with 'employee' role.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_role_id UUID;
BEGIN
    -- Get the 'employee' role ID as the default
    SELECT id INTO default_role_id FROM public.roles WHERE name = 'employee' LIMIT 1;

    INSERT INTO public.profiles (id, full_name, email, role_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.email, ''),
        default_role_id
    );
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ──────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY (RLS)
-- ──────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own profile; service role can read all
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Service role full access to profiles"
    ON public.profiles FOR ALL
    USING (auth.role() = 'service_role');

-- Roles: anyone authenticated can read roles
CREATE POLICY "Authenticated users can view roles"
    ON public.roles FOR SELECT
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Service role full access to roles"
    ON public.roles FOR ALL
    USING (auth.role() = 'service_role');

-- Assets: service role has full access (backend handles RBAC)
CREATE POLICY "Service role full access to assets"
    ON public.assets FOR ALL
    USING (auth.role() = 'service_role');

-- Allow authenticated users to read assets assigned to them
CREATE POLICY "Users can view own assigned assets"
    ON public.assets FOR SELECT
    USING (auth.uid() = assigned_to OR auth.role() = 'service_role');

-- Employees: service role has full access (backend handles RBAC)
CREATE POLICY "Service role full access to employees"
    ON public.employees FOR ALL
    USING (auth.role() = 'service_role');

-- ──────────────────────────────────────────────────────────────
-- 8. INDEXES
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to ON public.assets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category);
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);

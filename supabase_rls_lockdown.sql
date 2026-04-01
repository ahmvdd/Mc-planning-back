-- ============================================================
-- SUPABASE RLS LOCKDOWN — Shiftly / MCPlanning Manager
--
-- But : bloquer l'accès PostgREST public (rôle anon/authenticated)
-- sans impacter Prisma (connecté en postgres superuser, bypass RLS)
--
-- COMMENT L'EXÉCUTER :
--   Supabase Dashboard → SQL Editor → coller ce fichier → Run
-- ============================================================

-- 1. Activer RLS sur toutes les tables
ALTER TABLE "Employee"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Planning"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlanningEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Request"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RequestLog"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation"    ENABLE ROW LEVEL SECURITY;

-- 2. Aucune politique = deny all par défaut (comportement PostgreSQL standard)
--    Le rôle "anon" et "authenticated" de Supabase ne peuvent plus rien faire.
--    Le rôle "postgres" (Prisma) contourne RLS → ton backend continue de fonctionner.

-- 3. Vérification : lister les tables avec RLS activé
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

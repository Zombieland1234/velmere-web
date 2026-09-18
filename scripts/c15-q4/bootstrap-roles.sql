-- Disposable database ONLY. Role attributes model service-role SQL authority,
-- not GoTrue authentication, JWT verification or PostgREST routing.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

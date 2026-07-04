-- Extensions required across the Apex schema.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
-- pgcrypto: gen_random_bytes() for channel stream keys.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- btree_gist: lets the schedule EXCLUDE constraint combine uuid '=' with tstzrange '&&'.
CREATE EXTENSION IF NOT EXISTS btree_gist;

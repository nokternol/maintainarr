-- Drop orphaned tables that are no longer used.
-- rules must be dropped before groups due to the FK constraint.
DROP TABLE IF EXISTS rules;
DROP TABLE IF EXISTS groups;

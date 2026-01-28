-- Migration: Rename customers table to users and add is_admin field
-- Also updates all foreign key references

-- First, rename the customers table to users
ALTER TABLE customers RENAME TO users;

-- Rename the primary key constraint
ALTER TABLE users RENAME CONSTRAINT customers_pkey TO users_pkey;

-- Rename indexes
ALTER INDEX IF EXISTS customers_email_idx RENAME TO users_email_idx;
ALTER INDEX IF EXISTS customers_workos_user_id_idx RENAME TO users_workos_user_id_idx;

-- Add is_admin field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Update foreign key references in requests table
ALTER TABLE requests 
  DROP CONSTRAINT IF EXISTS requests_customer_id_fkey,
  ADD CONSTRAINT requests_user_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT;

-- Note: The column name in requests remains 'customer_id' for backwards compatibility
-- but references the users table

-- Create index for is_admin lookups
CREATE INDEX IF NOT EXISTS users_is_admin_idx ON users(is_admin) WHERE is_admin = true;

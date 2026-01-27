#!/bin/bash

# PostgreSQL Database Setup Script for orgbackend
# This script creates the database, user, and grants necessary permissions

set -e

# Configuration - adjust these values as needed
DB_NAME="orgdb_dev"
DB_USER="app_orgbackend_dev"
DB_PASSWORD="password"
DB_HOST="localhost"
DB_PORT="5432"

# PostgreSQL superuser (usually 'postgres' or your current user)
POSTGRES_USER="postgres"

echo "======================================"
echo "PostgreSQL Database Setup for orgbackend"
echo "======================================"
echo ""
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Host: $DB_HOST:$DB_PORT"
echo ""

# Function to execute SQL commands
execute_sql() {
    local sql="$1"
    if command -v psql &> /dev/null; then
        psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -c "$sql"
    else
        echo "Error: psql command not found. Please install PostgreSQL client."
        exit 1
    fi
}

# Check if we can connect to PostgreSQL
echo "Checking PostgreSQL connection..."
if ! psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -c "SELECT 1;" &> /dev/null; then
    echo "Error: Cannot connect to PostgreSQL as user '$POSTGRES_USER'"
    echo "Please ensure PostgreSQL is running and the user has proper permissions."
    echo ""
    echo "You may need to:"
    echo "  1. Start PostgreSQL: sudo systemctl start postgresql"
    echo "  2. Switch to postgres user: sudo -u postgres psql"
    echo "  3. Or set up proper pg_hba.conf authentication"
    exit 1
fi

echo "Connection successful!"
echo ""

# Check if database already exists
echo "Checking if database '$DB_NAME' exists..."
DB_EXISTS=$(psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME';" 2>/dev/null || echo "0")

if [ "$DB_EXISTS" = "1" ]; then
    echo "Database '$DB_NAME' already exists."
    read -p "Do you want to drop and recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Dropping database '$DB_NAME'..."
        psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -c "DROP DATABASE IF EXISTS $DB_NAME;"
        DB_EXISTS="0"
    fi
fi

# Create database if it doesn't exist
if [ "$DB_EXISTS" != "1" ]; then
    echo "Creating database '$DB_NAME'..."
    psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -c "CREATE DATABASE $DB_NAME;"
    echo "Database created successfully!"
fi

echo ""

# Check if user already exists
echo "Checking if user '$DB_USER' exists..."
USER_EXISTS=$(psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER';" 2>/dev/null || echo "0")

if [ "$USER_EXISTS" = "1" ]; then
    echo "User '$DB_USER' already exists. Updating password..."
    psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
else
    echo "Creating user '$DB_USER'..."
    psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    echo "User created successfully!"
fi

echo ""

# Grant permissions
echo "Granting permissions to user '$DB_USER' on database '$DB_NAME'..."

# Grant connect permission on database
psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -c "GRANT CONNECT ON DATABASE $DB_NAME TO $DB_USER;"

# Grant usage and create on schema public
psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -c "GRANT USAGE, CREATE ON SCHEMA public TO $DB_USER;"

# Grant all privileges on all tables in public schema
psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"

# Grant all privileges on all sequences in public schema
psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"

# Set default privileges for future tables
psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;"
psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;"

# Grant permission to create extensions (needed for pgcrypto)
psql -U "$POSTGRES_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -c "ALTER USER $DB_USER WITH SUPERUSER;"

echo "Permissions granted successfully!"
echo ""

# Test connection with the new user
echo "Testing connection with user '$DB_USER'..."
if PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
    echo "Connection test successful!"
else
    echo "Warning: Could not connect with the new user. You may need to check pg_hba.conf settings."
fi

echo ""
echo "======================================"
echo "Database setup complete!"
echo "======================================"
echo ""
echo "Connection details:"
echo "  Database URL: postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=disable"
echo ""
echo "You can now:"
echo "  1. Run migrations: cd organization_backend && go run cmd/server/main.go"
echo "  2. Or use: make migrate (if you have a Makefile target for migrations)"
echo ""

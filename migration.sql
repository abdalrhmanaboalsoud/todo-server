-- Drop existing columns if they exist to ensure clean migration
ALTER TABLE users 
DROP COLUMN IF EXISTS google_id,
DROP COLUMN IF EXISTS profile_picture,
DROP COLUMN IF EXISTS auth_provider,
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS first_name,
DROP COLUMN IF EXISTS last_name;

-- Add Google OAuth related columns to users table
ALTER TABLE users 
ADD COLUMN google_id VARCHAR(255) UNIQUE,
ADD COLUMN profile_picture VARCHAR(255),
ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'local',
ADD COLUMN email VARCHAR(255) UNIQUE,
ADD COLUMN first_name VARCHAR(50),
ADD COLUMN last_name VARCHAR(50);

-- Make username and password nullable for Google users
ALTER TABLE users 
ALTER COLUMN username DROP NOT NULL,
ALTER COLUMN password DROP NOT NULL;

-- Create index on google_id for better performance
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Create index on email for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Verify the columns exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'email'
    ) THEN
        RAISE EXCEPTION 'Email column was not created successfully';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'first_name'
    ) THEN
        RAISE EXCEPTION 'First name column was not created successfully';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'last_name'
    ) THEN
        RAISE EXCEPTION 'Last name column was not created successfully';
    END IF;
END $$;

-- Add user_id column to todo table if it does not exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='todo' AND column_name='user_id'
    ) THEN
        ALTER TABLE todo ADD COLUMN user_id INT REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Drop user_todo table if it exists
DROP TABLE IF EXISTS user_todo;

-- Create the session table for production session storage
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- Create an index on the expire column for better performance
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire"); 
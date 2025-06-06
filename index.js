console.log("🟢 index.js is running");

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Client } = require("pg");
const axios = require("axios");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
require("dotenv").config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const app = express();
const port = process.env.PORT || 5000;
const url = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; // Make sure to set this in your .env file

// Add this near the top of your file, after require statements
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'FRONTEND_URL'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

// Add this after other environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Session configuration
app.use(session({
  store: new pgSession({
    pool: client, // Use the same pool as your database connection
    tableName: 'session' // Use a different table name if you prefer
  }),
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// CORS configuration
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'https://todos-ivory-six.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback",
    proxy: true
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists
      const result = await client.query(
        'SELECT * FROM users WHERE google_id = $1 OR email = $2',
        [profile.id, profile.emails[0].value]
      );

      if (result.rows.length > 0) {
        // User exists, update last login
        await client.query(
          'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
          [result.rows[0].id]
        );
        return done(null, result.rows[0]);
      }

      // Create new user
      const newUser = await client.query(
        `INSERT INTO users (
          google_id, 
          email, 
          first_name, 
          last_name, 
          profile_picture, 
          auth_provider
        ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          profile.id,
          profile.emails[0].value,
          profile.name.givenName,
          profile.name.familyName,
          profile.photos[0].value,
          'google'
        ]
      );

      return done(null, newUser.rows[0]);
    } catch (error) {
      return done(error, null);
    }
  }
));

// Serialize user for the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
  try {
    const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  console.log("authenticateToken called");
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.error("No token provided");
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error("Invalid or expired token");
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Add this after the authenticateToken middleware and before the routes
app.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    // Get user data from database
    const result = await client.query(
      'SELECT id, username, email, first_name, last_name, auth_provider, profile_picture FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json(user);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function readTodosFile() {
  const rawData = fs.readFileSync("./todos.json");
  return JSON.parse(rawData);
}
app.get("/test", (req, res) => {
  console.log("✅ /test route hit");
  res.status(200).json({ message: "Test route working" });
});

// Add this test route before other routes
app.get('/auth/google/test', (req, res) => {
  const config = {
    message: 'Google OAuth Configuration Status',
    clientId: {
      status: process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing',
      value: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 10) + '...' : 'Not found'
    },
    clientSecret: {
      status: process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing',
      value: process.env.GOOGLE_CLIENT_SECRET ? process.env.GOOGLE_CLIENT_SECRET.substring(0, 10) + '...' : 'Not found'
    },
    frontendUrl: {
      status: process.env.FRONTEND_URL ? '✅ Set' : '❌ Missing',
      value: process.env.FRONTEND_URL
    },
    callbackUrl: {
      status: '✅ Configured',
      value: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/auth/google/callback'
    },
    redirectUri: {
      status: '✅ Configured',
      value: 'http://localhost:5000/auth/google'
    }
  };
  
  res.json(config);
});

// Routes
app.post("/addtodo", authenticateToken, addTodoHandler);
app.get("/todos", authenticateToken, getTodosHandler);
app.delete("/dtodo/:id", authenticateToken, deleteTodoHandler);
app.patch("/utodo/:id", authenticateToken, updateTodoHandler);
app.get("/todo/api", apiHandler);
app.get("/local-todos", localApiHandler);
app.get("/spesific-todo/:id", authenticateToken, specificTodoHandler);
app.get("/todos/completed", authenticateToken, completedHandler);

// Add this with your other routes
app.get("/", (req, res) => {
  res.status(200).json({ message: "Todo API Server Running" });
});

// Authentication routes
app.post("/register", async (req, res) => {
  const { username, password, email, first_name, last_name } = req.body;
  
  if (!username || !password || !email) {
    return res.status(400).json({ error: 'Username, password, and email are required' });
  }

  try {
    // Check if user already exists (check both username and email)
    const checkUser = await client.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (checkUser.rows.length > 0) {
      // Check which field caused the conflict
      if (checkUser.rows[0].username === username) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      if (checkUser.rows[0].email === email) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user with additional fields
    const result = await client.query(
      `INSERT INTO users (
        username, 
        password, 
        email, 
        first_name, 
        last_name, 
        auth_provider
      ) VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING id, username, email, first_name, last_name`,
      [username, hashedPassword, email, first_name, last_name, 'local']
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: result.rows[0].id, 
        username: result.rows[0].username,
        email: result.rows[0].email 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { 
        id: result.rows[0].id, 
        username: result.rows[0].username,
        email: result.rows[0].email,
        first_name: result.rows[0].first_name,
        last_name: result.rows[0].last_name
      }
    });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Find user
    const result = await client.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google OAuth routes
app.get('/auth/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account',
    accessType: 'offline'
  })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/login',
    session: false 
  }),
  async (req, res) => {
    try {
      // Generate JWT token
      const token = jwt.sign(
        { 
          id: req.user.id, 
          email: req.user.email,
          auth_provider: req.user.auth_provider 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Update last login
      await client.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [req.user.id]
      );

      // Set secure cookie with the token
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Redirect to frontend with token
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/auth/callback?token=${token}`);
    } catch (err) {
      console.error('Error in Google callback:', err);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/login?error=auth_failed`);
    }
  }
);

// Logout route
app.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.status(200).json({ message: 'Logged out successfully' });
});

// User profile management endpoints
app.patch('/api/profile', authenticateToken, async (req, res) => {
  const { first_name, last_name } = req.body;
  const userId = req.user.id;

  try {
    const result = await client.query(
      'UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name) WHERE id = $3 RETURNING id, first_name, last_name, email, profile_picture',
      [first_name, last_name, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/profile/password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  try {
    // Get user's current password
    const userResult = await client.query(
      'SELECT password FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const storedPassword = userResult.rows[0].password;

    // Verify current password
    try {
      const validPassword = await bcrypt.compare(currentPassword.toString(), storedPassword);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    } catch (compareError) {
      console.error('Error comparing passwords:', compareError);
      return res.status(500).json({ error: 'Error verifying current password' });
    }

    // Hash new password
    try {
      const hashedPassword = await bcrypt.hash(newPassword.toString(), 10);

      // Update password
      await client.query(
        'UPDATE users SET password = $1 WHERE id = $2',
        [hashedPassword, userId]
      );

      res.json({ message: 'Password updated successfully' });
    } catch (hashError) {
      console.error('Error hashing new password:', hashError);
      return res.status(500).json({ error: 'Error updating password' });
    }
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Replace the multer storage configuration with memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Replace the profile picture upload endpoint
app.post('/api/profile/picture', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const userId = req.user.id;

  try {
    // Get old profile picture URL
    const oldPictureResult = await client.query(
      'SELECT profile_picture FROM users WHERE id = $1',
      [userId]
    );

    // Upload new image to Cloudinary
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    
    const uploadResponse = await cloudinary.uploader.upload(dataURI, {
      folder: 'profile_pictures',
      public_id: `profile-${userId}-${Date.now()}`,
      overwrite: true,
      resource_type: 'auto'
    });

    // Delete old image from Cloudinary if it exists and is not the default
    if (oldPictureResult.rows[0]?.profile_picture && 
        !oldPictureResult.rows[0].profile_picture.includes('default-profile.png')) {
      try {
        const publicId = oldPictureResult.rows[0].profile_picture.split('/').slice(-1)[0].split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (deleteError) {
        console.error('Error deleting old profile picture:', deleteError);
        // Continue even if deletion fails
      }
    }

    // Update profile picture URL in database
    const result = await client.query(
      'UPDATE users SET profile_picture = $1 WHERE id = $2 RETURNING profile_picture',
      [uploadResponse.secure_url, userId]
    );

    res.json({ profilePicture: result.rows[0].profile_picture });
  } catch (error) {
    console.error('Error updating profile picture:', error);
    res.status(500).json({ error: 'Failed to update profile picture' });
  }
});

// Update the delete profile picture endpoint
app.delete('/api/profile/picture', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const defaultPicture = process.env.DEFAULT_PROFILE_PICTURE || 'https://res.cloudinary.com/dzh4puawn/image/upload/v1748993287/profile_pictures/default-profile.svg';

  try {
    // Get current profile picture
    const result = await client.query(
      'SELECT profile_picture FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentPicture = result.rows[0].profile_picture;

    // Delete the image from Cloudinary if it exists and is not the default
    if (currentPicture && !currentPicture.includes('default-profile.png')) {
      try {
        const publicId = currentPicture.split('/').slice(-1)[0].split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (deleteError) {
        console.error('Error deleting profile picture:', deleteError);
        // Continue even if deletion fails
      }
    }

    // Update database to use default picture
    await client.query(
      'UPDATE users SET profile_picture = $1 WHERE id = $2',
      [defaultPicture, userId]
    );

    res.json({ profilePicture: defaultPicture });
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// functions handlers
function addTodoHandler(req, res) {
  if (!req.user || !req.user.id) {
    console.error("No user found in request");
    return res.status(400).json({ error: "User not authenticated" });
  }
  if (!req.body.title) {
    console.error("No title provided");
    return res.status(400).json({ error: "Title is required" });
  }

  const { title, description, priority, due_date } = req.body;
  const userId = req.user.id; // Get user ID from the authenticated request
  
  const sql = `
    INSERT INTO todo (user_id, title, description, priority, due_date) 
    VALUES ($1, $2, $3, $4, $5) 
    RETURNING *`;
  const values = [userId, title, description, priority, due_date];

  client
    .query(sql, values)
    .then((result) => {
      console.log("Todo added:", result.rows[0]);
      res.status(201).json(result.rows[0]);
    })
    .catch((err) => {
      res.status(500).json({ error: "Internal server error" });
      console.error("Error adding todo:", err);
    });
}

async function getTodosHandler(req, res) {
  const keyword = req.query.keyword;
  let query = 'SELECT id, title, description, completed, priority, due_date FROM todo WHERE user_id = $1';
  const values = [req.user.id];

  if (keyword) {
    query += " AND title ILIKE $2";
    values.push(`%${keyword}%`);
  }
  
  client
    .query(query, values)
    .then((result) => {
      console.log("Todos retrieved:", result.rows);
      res.status(200).json(result.rows);
    })
    .catch((err) => {
      console.error("Error retrieving todos:", err);
      res.status(500).json({ error: "Internal server error" });
    });
}

function deleteTodoHandler(req, res) {
  const todoId = req.params.id;
  const userId = req.user.id; // Get user ID from the authenticated request
  
  const sql = "DELETE FROM todo WHERE id = $1 AND user_id = $2";
  const values = [todoId, userId];
  
  client
    .query(sql, values)
    .then((result) => {
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Todo not found" });
      }
      console.log("Todo deleted:", todoId);
      res.status(200).json({ message: "Todo deleted successfully" });
    })
    .catch((err) => {
      console.error("Error deleting todo:", err);
      res.status(500).json({ error: "Internal server error" });
    });
}

function updateTodoHandler(req, res) {
  const todoId = req.params.id;
  const userId = req.user.id; // Get user ID from the authenticated request
  const { title, description, completed, priority, due_date } = req.body;

  const sql = `
    UPDATE todo 
    SET title = COALESCE($1, title),
        description = COALESCE($2, description),
        completed = COALESCE($3, completed),
        priority = COALESCE($4, priority),
        due_date = COALESCE($5, due_date)
    WHERE id = $6 AND user_id = $7
    RETURNING *`;

  const values = [title, description, completed, priority, due_date, todoId, userId];

  client
    .query(sql, values)
    .then((result) => {
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Todo not found" });
      }
      res.status(200).json(result.rows[0]);
    })
    .catch((err) => {
      console.error("Error updating todo:", err);
      res.status(500).json({ error: "Internal server error" });
    });
}

function apiHandler(req, res) {
  const keyword = req.query.keyword;
  const url = `https://jsonplaceholder.typicode.com/todos?keyword= ${encodeURIComponent(keyword)}`;
  if (!keyword) {
    axios
      .get(url)
      .then((response) => {
        const todos = response.data;
        // console.log("Todos fetched from API:", todos);
        res.status(200).json(todos);
      })
      .catch((error) => {
        console.error("Error fetching todos from API:", error);
        res.status(500).json({ error: "Internal server error" });
      });
  }else{
    axios
      .get(url)
      .then((response) => {
        const todos = response.data;
        const filteredTodos = todos.filter((todo) =>
          todo.title.toLowerCase().includes(keyword.toLowerCase().trim())
        );
        // console.log("Filtered Todos:", filteredTodos);
        res.status(200).json(filteredTodos);
      })
      .catch((error) => {
        console.error("Error fetching todos from API:", error);
        res.status(500).json({ error: "Internal server error" });
      });
  }
}

function localApiHandler(req, res) {
  try {
    const data = readTodosFile();
    res.status(200).json(data.todos);
  } catch (error) {
    console.error("Error reading todos:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

function specificTodoHandler(req, res) {
  const todoId = req.params.id;
  const userId = req.user.id; // Get user ID from the authenticated request
  
  const sql = "SELECT * FROM todo WHERE id = $1 AND user_id = $2";
  const values = [todoId, userId];
  
  client
    .query(sql, values)
    .then((result) => {
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Todo not found" });
      }
      res.status(200).json(result.rows[0]);
    })
    .catch((err) => {
      console.error("Error retrieving todo:", err);
      res.status(500).json({ error: "Internal server error" });
    });
}

// GET /todos?completed=true|false (empty for all)
function completedHandler(req, res) {
  const userId = req.user.id; // Get user ID from the authenticated request
  const { completed } = req.query;
  console.log("✅ /todos/completed hit with query:", completed);

  let sql = "SELECT * FROM todo WHERE user_id = $1";
  let values = [userId];

  if (completed === 'true' || completed === 'false') {
    sql += " AND completed = $2";
    values.push(completed === 'true');
  }

  console.log("📦 Running SQL:", sql, "with values:", values);

  client
    .query(sql, values)
    .then((result) => {
      console.log("📄 Retrieved rows:", result.rows);
      res.status(200).json(result.rows);
    })
    .catch((err) => {
      console.error("❌ Error retrieving completed todos:", err);
      res.status(500).json({ error: "Internal server error" });
    });
}

app.get('/test-users', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM users LIMIT 1');
    res.json(result.rows);
  } catch (err) {
    console.error('Error querying users table:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/test-log', (req, res) => {
  console.log("test-log called");
  res.json({ ok: true });
});

app.get('/test-get', (req, res) => {
  console.log("test-get called");
  res.json({ ok: true });
});

// Add a test endpoint that returns CORS headers
app.get('/test', (req, res) => {
  res.json({
    message: 'Server is running',
    cors: {
      origin: req.headers.origin,
      allowed: true
    }
  });
});

client
  .connect()
  .then(() => {
    console.log("Connected to PostgreSQL");
    console.log("Attempting to start server...");
    app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
      console.log("Server listen callback executed.");
    });
  })
  .catch((err) => console.error("Connection error", err.stack));

console.log("DB URL:", process.env.DATABASE_URL, "PORT:", process.env.PORT);
console.log("End of startup script.");

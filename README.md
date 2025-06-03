# Todo Application with Google OAuth

A full-stack todo application built with React, Node.js, and PostgreSQL, featuring Google OAuth authentication and a modern, responsive design.

## 🌟 Features

- **Authentication**
  - Local authentication (username/password)
  - Google OAuth integration
  - JWT-based session management
  - Secure password hashing

- **Todo Management**
  - Create, read, update, and delete todos
  - Mark todos as complete/incomplete
  - Filter todos by completion status
  - Search todos by keyword
  - Priority levels for todos
  - Due dates for todos

- **User Experience**
  - Responsive design
  - Real-time updates
  - Intuitive user interface
  - Secure session management
  - Protected routes

## 🏗️ Tech Stack

### Frontend
- React.js
- React Router for navigation
- Axios for API requests
- CSS for styling
- Environment variables for configuration

### Backend
- Node.js with Express
- PostgreSQL database
- Passport.js for authentication
- Google OAuth 2.0
- JWT for session management
- Bcrypt for password hashing
- CORS enabled
- Environment variables for configuration

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL database
- Google Cloud Console account (for OAuth)
- Git

### Environment Variables

#### Backend (.env)
```env
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_secure_jwt_secret
PORT=5000
FRONTEND_URL=http://localhost:3001
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
NODE_ENV=development
```

#### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000
```

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd todo-app
   ```

2. **Backend Setup**
   ```bash
   cd server
   npm install
   # Run database migrations
   node run-migration.js
   # Start the server
   npm start
   ```

3. **Frontend Setup**
   ```bash
   cd client
   npm install
   npm start
   ```

## 📦 Database Schema

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    google_id VARCHAR(255) UNIQUE,
    profile_picture VARCHAR(255),
    auth_provider VARCHAR(20) DEFAULT 'local',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

### Todo Table
```sql
CREATE TABLE todo (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT false,
    priority VARCHAR(20),
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Session Table
```sql
CREATE TABLE session (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);
```

## 🔒 Authentication Flow

1. **Local Authentication**
   - User registers with username/password
   - Password is hashed using bcrypt
   - JWT token is generated upon successful login
   - Token is stored in localStorage/sessionStorage

2. **Google OAuth**
   - User clicks "Login with Google"
   - Redirected to Google consent screen
   - After consent, Google redirects back to our callback URL
   - Backend verifies the Google token
   - Creates/updates user in database
   - Generates JWT token
   - Redirects to frontend with token

## 🛣️ API Endpoints

### Authentication
- `POST /register` - Register new user
- `POST /login` - Login with username/password
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - Google OAuth callback
- `POST /logout` - Logout user

### Todos
- `GET /todos` - Get all todos for authenticated user
- `POST /addtodo` - Create new todo
- `PUT /todos/:id` - Update todo
- `DELETE /todos/:id` - Delete todo
- `GET /todos/completed` - Get completed/incomplete todos
- `GET /spesific-todo/:id` - Get specific todo

## 🚢 Deployment

### Frontend (Vercel)
1. Connect your GitHub repository to Vercel
2. Configure environment variables:
   ```
   REACT_APP_API_URL=https://your-render-app-name.onrender.com
   ```
3. Deploy to: https://todos-ivory-six.vercel.app

### Backend (Render)
1. Connect your GitHub repository to Render
2. Configure environment variables:
   ```
   NODE_ENV=production
   DATABASE_URL=your_production_database_url
   JWT_SECRET=your_secure_jwt_secret
   FRONTEND_URL=https://todos-ivory-six.vercel.app
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=https://your-render-app-name.onrender.com/auth/google/callback
   ```
3. Set build command: `npm install`
4. Set start command: `node index.js`
5. Deploy

### Google OAuth Setup
1. Create project in Google Cloud Console
2. Configure OAuth 2.0 credentials
3. Add authorized origins:
   - https://todos-ivory-six.vercel.app
   - http://localhost:3001 (for development)
4. Add redirect URIs:
   - https://your-render-app-name.onrender.com/auth/google/callback
   - http://localhost:5000/auth/google/callback (for development)
5. Update environment variables with credentials

## 🔍 Testing

### Local Testing
1. Start backend: `cd server && npm start`
2. Start frontend: `cd client && npm start`
3. Test all features:
   - Registration
   - Login (both local and Google)
   - Todo operations
   - Session management

### Production Testing
1. Verify all environment variables
2. Test authentication flows
3. Test todo operations
4. Verify session management
5. Check error handling

## 🔐 Security Measures

- Password hashing with bcrypt
- JWT token authentication
- CORS configuration
- Secure session management
- Environment variables for sensitive data
- SQL injection prevention
- XSS protection
- CSRF protection

## 📝 Future Improvements

- [ ] Add email verification
- [ ] Implement password reset
- [ ] Add todo categories/tags
- [ ] Implement todo sharing
- [ ] Add user profile management
- [ ] Implement real-time updates
- [ ] Add dark mode
- [ ] Implement todo search with filters
- [ ] Add todo reminders/notifications

## 👥 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👤 Author

Abdalrhman Waleed
- GitHub: Abdalrhmanaoalsoud
- LinkedIn:  linkedin.com/in/abdalrhman-aboalsoud/

## 🙏 Acknowledgments

- Google OAuth documentation
- React documentation
- Node.js documentation
- PostgreSQL documentation 
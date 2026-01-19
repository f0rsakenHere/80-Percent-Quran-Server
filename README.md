# 🌙 Ramadan Vocabulary API - Backend

Production-ready Express.js backend for the Ramadan Vocabulary App. This API helps users learn the most frequent words in the Quran through a structured learning system.

## 🚀 Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Authentication:** Firebase Authentication (Admin SDK)
- **External API:** Quran Foundation API (OAuth2 Client Credentials Flow)

## 📋 Features

- ✅ **Word Management:** Browse and search Quranic vocabulary
- ✅ **Progress Tracking:** Track learned words and learning statistics
- ✅ **Quran API Proxy:** Fetch example verses for words
- ✅ **Firebase Auth:** Secure user authentication
- ✅ **RESTful API:** Clean, well-documented endpoints
- ✅ **Security:** Helmet, CORS, Rate Limiting
- ✅ **Error Handling:** Comprehensive error management

## 📁 Project Structure

```
80-Percent-Quran-Server/
├── config/
│   ├── db.js                 # MongoDB connection
│   └── firebase.js           # Firebase Admin initialization
├── data/
│   └── quran_words.json      # Seed data for words
├── middleware/
│   ├── authMiddleware.js     # Firebase token verification
│   └── errorHandler.js       # Global error handling
├── models/
│   ├── Word.js               # Word schema
│   └── User.js               # User schema
├── routes/
│   ├── wordRoutes.js         # Word endpoints
│   ├── progressRoutes.js     # Progress tracking endpoints
│   └── quranRoutes.js        # Quran API proxy endpoints
├── services/
│   └── quranService.js       # Quran Foundation API service
├── .env.example              # Environment variables template
├── .gitignore
├── package.json
├── seed.js                   # Database seeding script
└── server.js                 # Main application entry point
```

## ⚙️ Setup Instructions

### 1. Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or Atlas)
- Firebase Project with Admin SDK
- Quran Foundation API credentials

### 2. Clone and Install

```bash
cd "d:\Codes\80 Percent Quran\80-Percent-Quran-Server"
npm install
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/ramadan_vocabulary

# Firebase (path to your service account JSON)
FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json

# Quran Foundation API
QF_CLIENT_ID=your_client_id_here
QF_CLIENT_SECRET=your_client_secret_here
QF_ENV=prelive

# Server
PORT=5000
NODE_ENV=development

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 4. Firebase Setup

1. Download your Firebase service account JSON from Firebase Console
2. Save it as `firebase-service-account.json` in the project root
3. Make sure it's in `.gitignore` (already configured)

### 5. Seed the Database

```bash
npm run seed
```

This will populate your MongoDB with words from `data/quran_words.json`.

### 6. Start the Server

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will run on `http://localhost:5000`.

## 📡 API Endpoints

### 🔓 Public Endpoints

#### Health Check
```
GET /health
```

#### Quran API Health
```
GET /api/quran/health
```

### 🔐 Word Endpoints

#### Get All Words
```
GET /api/words
Query Params: page, limit, type, minFreq, maxFreq, sortBy, order
```

#### Get Next Words to Learn
```
GET /api/words/learn
Query Params: limit
Auth: Required
```

#### Get Word by ID
```
GET /api/words/:id
```

#### Search Words
```
GET /api/words/search/:query
Query Params: limit
```

### 📊 Progress Endpoints

#### Mark Word as Learned
```
POST /api/progress
Body: { wordId: number }
Auth: Required
```

#### Get User Statistics
```
GET /api/progress/stats
Auth: Required
```

#### Get Learned Words
```
GET /api/progress/learned
Query Params: page, limit
Auth: Required
```

#### Remove Learned Word
```
DELETE /api/progress/:wordId
Auth: Required
```

#### Batch Add Words
```
POST /api/progress/batch
Body: { wordIds: number[] }
Auth: Required
```

### 📖 Quran Proxy Endpoints

#### Get Example Verses
```
GET /api/quran/examples
Query Params: word (required), size (default: 2)
```

#### Get Verse Details
```
GET /api/quran/verse/:reference
Example: /api/quran/verse/2:255
```

## 🔒 Authentication

All protected endpoints require a Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase_id_token>
```

The middleware will:
1. Verify the token with Firebase Admin SDK
2. Find or create the user in MongoDB
3. Attach the user to `req.user`

## 🛡️ Security Features

- **Helmet:** Security headers
- **CORS:** Configurable origin whitelist
- **Rate Limiting:** 100 requests per 15 minutes
- **Input Validation:** Mongoose schema validation
- **Error Handling:** No stack traces in production

## 🧪 Testing

Test the API with tools like:
- Postman
- Thunder Client (VS Code Extension)
- curl

Example curl request:
```bash
curl http://localhost:5000/api/words?limit=5
```

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_URI` | MongoDB connection string | Yes |
| `FIREBASE_SERVICE_ACCOUNT` | Path to Firebase service account JSON | Yes |
| `QF_CLIENT_ID` | Quran Foundation client ID | Yes |
| `QF_CLIENT_SECRET` | Quran Foundation client secret | Yes |
| `QF_ENV` | Quran API environment (prelive/production) | No (default: prelive) |
| `PORT` | Server port | No (default: 5000) |
| `NODE_ENV` | Environment mode | No (default: development) |
| `CORS_ORIGINS` | Comma-separated allowed origins | No |

## 🚀 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use a production MongoDB instance (MongoDB Atlas)
- [ ] Set `QF_ENV=production` for production Quran API
- [ ] Secure environment variables
- [ ] Configure proper CORS origins
- [ ] Set up process manager (PM2)
- [ ] Enable HTTPS
- [ ] Set up monitoring and logging

### PM2 Deployment Example

```bash
npm install -g pm2
pm2 start server.js --name ramadan-api
pm2 save
pm2 startup
```

## 🤝 Contributing

1. Follow the existing code structure
2. Add error handling for all operations
3. Document new endpoints
4. Test before committing

## 📄 License

MIT

## 🙏 Acknowledgments

- Quran Foundation for the API
- Firebase for authentication services
- MongoDB for the database platform

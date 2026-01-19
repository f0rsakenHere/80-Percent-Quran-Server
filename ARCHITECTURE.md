# 🏗️ Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Applications                     │
│              (Web, Mobile - Firebase Auth)                   │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS + Bearer Token
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express.js API Server                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Middleware Stack                                     │   │
│  │  - Helmet (Security Headers)                          │   │
│  │  - CORS (Cross-Origin Resource Sharing)               │   │
│  │  - Rate Limiting (100 req/15min)                      │   │
│  │  - Compression                                        │   │
│  │  - Auth Middleware (Firebase Token Verification)      │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Route Handlers                                       │   │
│  │  - /api/words (Word Management)                       │   │
│  │  - /api/progress (User Progress Tracking)             │   │
│  │  - /api/quran (Quran API Proxy)                       │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Services Layer                                       │   │
│  │  - Quran Service (OAuth2 Client Credentials)          │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────┬────────────────────────────┬─────────────────────┘
           │                            │
           ▼                            ▼
┌─────────────────────┐    ┌──────────────────────────────┐
│   MongoDB Database  │    │  Quran Foundation API        │
│  ┌───────────────┐  │    │  (OAuth2 Protected)          │
│  │ Users         │  │    │  - Search Endpoint           │
│  │ - firebaseUid │  │    │  - Verse Details             │
│  │ - learnedWords│  │    │  - Prelive/Production        │
│  │ - progress    │  │    └──────────────────────────────┘
│  └───────────────┘  │               ▲
│  ┌───────────────┐  │               │
│  │ Words         │  │               │ Server-to-Server
│  │ - arabic      │  │               │ OAuth2 Flow
│  │ - translation │  │               │
│  │ - frequency   │  │               │
│  └───────────────┘  │               │
└─────────────────────┘               │
           ▲                          │
           │                          │
           └──────────────────────────┘
              Token Cache (In-Memory)
```

## Authentication Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Client    │         │  Express    │         │  Firebase   │
│             │         │   Server    │         │   Admin     │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │ 1. Request + Token    │                       │
       │──────────────────────>│                       │
       │                       │                       │
       │                       │ 2. Verify Token       │
       │                       │──────────────────────>│
       │                       │                       │
       │                       │ 3. User Info          │
       │                       │<──────────────────────│
       │                       │                       │
       │                       │ 4. Find/Create User   │
       │                       │ (MongoDB)             │
       │                       │                       │
       │ 5. Response + Data    │                       │
       │<──────────────────────│                       │
       │                       │                       │
```

## Quran API Integration Flow

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Client     │         │   Express    │         │   Quran API  │
│              │         │   Server     │         │              │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │ 1. Get Examples        │                        │
       │───────────────────────>│                        │
       │                        │                        │
       │                        │ 2. Check Token Cache   │
       │                        │ (Valid?)               │
       │                        │                        │
       │                        │ 3. Get Access Token    │
       │                        │ (if needed)            │
       │                        │───────────────────────>│
       │                        │                        │
       │                        │ 4. Access Token        │
       │                        │<───────────────────────│
       │                        │                        │
       │                        │ 5. Search Request      │
       │                        │ (with Bearer Token)    │
       │                        │───────────────────────>│
       │                        │                        │
       │                        │ 6. Search Results      │
       │                        │<───────────────────────│
       │                        │                        │
       │ 7. Formatted Response  │                        │
       │<───────────────────────│                        │
       │                        │                        │
```

## Data Models

### User Model
```javascript
{
  firebaseUid: String,      // Unique identifier from Firebase
  email: String,             // User email
  learnedWords: [Number],    // Array of learned word IDs
  totalFrequencyKnown: Number, // Sum of frequencies
  displayName: String,       // Optional display name
  photoURL: String,          // Optional profile photo
  lastActive: Date,          // Last activity timestamp
  createdAt: Date,           // Account creation
  updatedAt: Date            // Last update
}
```

### Word Model
```javascript
{
  id: Number,                // Unique word ID
  arabic: String,            // Arabic text
  translation: String,       // English translation
  transliteration: String,   // Romanized text
  frequency: Number,         // Occurrence count in Quran
  type: String,              // Word type (Noun, Verb, etc.)
  createdAt: Date,
  updatedAt: Date
}
```

## Security Layers

### 1. Network Security
- **Helmet.js**: Sets security HTTP headers
- **CORS**: Configurable origin whitelist
- **Rate Limiting**: Prevents abuse (100 req/15min per IP)

### 2. Authentication
- **Firebase Admin SDK**: Verifies JWT tokens
- **Token Validation**: Checks expiry and revocation
- **User Auto-Creation**: Seamless onboarding

### 3. Data Security
- **Mongoose Validation**: Schema-level validation
- **Environment Variables**: Secrets in .env file
- **OAuth2 Proxy**: Hides client secrets from frontend

### 4. Error Handling
- **Global Error Handler**: Catches all errors
- **Production Mode**: No stack traces exposed
- **Specific Error Types**: Mongoose, JWT, validation errors

## Performance Optimizations

### 1. Database Indexes
```javascript
// Word indexes
{ id: 1 }                    // Unique index
{ frequency: -1, id: 1 }     // Compound index for sorting

// User indexes
{ firebaseUid: 1 }           // Unique index
{ firebaseUid: 1, learnedWords: 1 } // Compound index
```

### 2. Token Caching
- In-memory cache for Quran API access tokens
- Automatic refresh before expiry (30s buffer)
- Reduces authentication overhead

### 3. Compression
- Gzip compression for all responses
- Reduces bandwidth usage
- Faster response times

### 4. Pagination
- All list endpoints support pagination
- Configurable page size
- Prevents memory overload

## API Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [] // Optional validation errors
}
```

## Environment Configuration

### Development
- Detailed logging
- Stack traces in errors
- Quran API prelive environment
- Local MongoDB

### Production
- Minimal logging
- No stack traces
- Quran API production environment
- MongoDB Atlas
- Process manager (PM2)
- HTTPS enforced

## Scalability Considerations

### Horizontal Scaling
- Stateless design (except token cache)
- Can run multiple instances behind load balancer
- Session stored in MongoDB, not memory

### Database Scaling
- MongoDB Atlas auto-scaling
- Read replicas for high traffic
- Indexes optimized for common queries

### Caching Strategy
- In-memory token cache (per instance)
- Future: Redis for distributed caching
- CDN for static assets

## Monitoring & Logging

### Recommended Tools
- **PM2**: Process management and monitoring
- **Morgan**: HTTP request logging
- **Winston**: Application logging
- **MongoDB Atlas**: Database monitoring
- **Firebase Console**: Auth monitoring

### Key Metrics
- API response times
- Error rates (by endpoint)
- Database query performance
- Authentication success/failure
- Rate limit hits

## Deployment Architecture

```
┌─────────────────────────────────────────────┐
│           Load Balancer (Nginx)             │
└────┬─────────────┬─────────────┬────────────┘
     │             │             │
     ▼             ▼             ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│  Node   │   │  Node   │   │  Node   │
│Instance1│   │Instance2│   │Instance3│
└────┬────┘   └────┬────┘   └────┬────┘
     │             │             │
     └─────────────┴─────────────┘
                   │
                   ▼
         ┌──────────────────┐
         │  MongoDB Atlas   │
         │  (Replica Set)   │
         └──────────────────┘
```

## Future Enhancements

### Phase 2
- [ ] Redis for distributed caching
- [ ] WebSocket support for real-time updates
- [ ] Analytics and insights
- [ ] Leaderboard system

### Phase 3
- [ ] GraphQL API
- [ ] Advanced search with Elasticsearch
- [ ] Audio pronunciation integration
- [ ] Spaced repetition algorithm

## Best Practices Implemented

✅ **Separation of Concerns**: Routes → Controllers → Services → Models  
✅ **Error Handling**: Centralized error handler with specific error types  
✅ **Security**: Multiple layers (Helmet, CORS, Auth, Rate Limiting)  
✅ **Validation**: Schema-level and route-level validation  
✅ **Documentation**: Comprehensive README, comments, and API docs  
✅ **Environment Config**: All secrets in .env file  
✅ **Database Design**: Proper indexes and schema design  
✅ **API Design**: RESTful principles, consistent responses  
✅ **Code Quality**: Clean, maintainable, well-commented code  


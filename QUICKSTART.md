# 🚀 Quick Start Guide

## Step 1: Install Dependencies ✅
```bash
npm install
```

## Step 2: Configure Environment Variables

1. Copy the example file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your credentials:
```env
MONGO_URI=mongodb://localhost:27017/ramadan_vocabulary
FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json
QF_CLIENT_ID=your_quran_foundation_client_id
QF_CLIENT_SECRET=your_quran_foundation_secret
QF_ENV=prelive
```

3. Add your Firebase Service Account JSON file to the root directory

## Step 3: Start MongoDB

Make sure MongoDB is running locally, or use MongoDB Atlas connection string.

**Local MongoDB:**
```bash
mongod
```

## Step 4: Seed the Database

```bash
npm run seed
```

This will import the sample words from `data/quran_words.json`.

## Step 5: Start the Server

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

## Step 6: Test the API

Open your browser and visit:
```
http://localhost:5000/health
```

Or test with curl:
```bash
curl http://localhost:5000/api/words?limit=5
```

## 🔑 Getting Credentials

### Firebase Admin SDK
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings > Service Accounts
4. Click "Generate New Private Key"
5. Save the JSON file as `firebase-service-account.json`

### Quran Foundation API
Contact Quran Foundation to get your API credentials:
- Client ID
- Client Secret
- Choose environment (prelive or production)

## 📝 Sample API Requests

### Get Words (No Auth Required)
```bash
curl http://localhost:5000/api/words?limit=10
```

### Get Example Verses (No Auth Required)
```bash
curl "http://localhost:5000/api/quran/examples?word=مِن&size=2"
```

### Mark Word as Learned (Auth Required)
```bash
curl -X POST http://localhost:5000/api/progress \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"wordId": 1}'
```

### Get User Stats (Auth Required)
```bash
curl http://localhost:5000/api/progress/stats \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

## 🐛 Troubleshooting

### MongoDB Connection Failed
- Ensure MongoDB is running
- Check your `MONGO_URI` in `.env`
- For Atlas, whitelist your IP address

### Firebase Authentication Error
- Verify `firebase-service-account.json` exists
- Check the path in `FIREBASE_SERVICE_ACCOUNT`
- Ensure the JSON file is valid

### Quran API Errors
- Verify your `QF_CLIENT_ID` and `QF_CLIENT_SECRET`
- Check your environment setting (`QF_ENV`)
- Test with `/api/quran/health` endpoint

## 📦 Next Steps

1. Import your full word dataset to `data/quran_words.json`
2. Run seed script to populate database
3. Connect your frontend application
4. Test all API endpoints
5. Deploy to production

## 🎯 Development Tips

- Use `npm run dev` for auto-reload during development
- Check logs for detailed error messages
- Use Postman or Thunder Client for API testing
- Monitor MongoDB with MongoDB Compass
- Test authentication flow with your Firebase app

Happy coding! 🚀

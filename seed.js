require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Word = require('./models/Word');

/**
 * Seed Database with Quran Words
 * This script imports words from quran_words.json into MongoDB
 */

const WORDS_FILE = path.join(__dirname, 'data', 'quran_words.json');

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

/**
 * Load words from JSON file
 */
const loadWordsFromFile = () => {
  try {
    if (!fs.existsSync(WORDS_FILE)) {
      console.error(`❌ File not found: ${WORDS_FILE}`);
      console.log('📝 Please create a data/quran_words.json file');
      process.exit(1);
    }

    const fileContent = fs.readFileSync(WORDS_FILE, 'utf8');
    const words = JSON.parse(fileContent);

    if (!Array.isArray(words)) {
      throw new Error('File must contain an array of words');
    }

    console.log(`✅ Loaded ${words.length} words from file`);
    return words;
  } catch (error) {
    console.error('❌ Error loading words file:', error.message);
    process.exit(1);
  }
};

/**
 * Seed the database
 */
const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...\n');
    await connectDB();
    const words = loadWordsFromFile();

    // Clear existing words
    const deleteResult = await Word.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing words\n`);

    // Insert new words
    console.log('📥 Inserting new words...');
    const insertedWords = await Word.insertMany(words);
    console.log(`✅ Inserted ${insertedWords.length} words\n`);

    // Display top 10 most frequent words
    const topWords = await Word.find().sort({ frequency: -1 }).limit(10);
    console.log('🏆 Top 10 Most Frequent Words:');
    topWords.forEach((word, index) => {
      console.log(`  ${index + 1}. ${word.arabic} (${word.transliteration}) - ${word.frequency}x`);
    });

    console.log('\n✅ Database seeding completed!\n');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedDatabase();

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const dns = require('dns');
const mongoose = require('mongoose');
const Story = require('./models/Story');

// Prefer public DNS so the mongodb+srv Atlas lookup works behind routers that
// refuse SRV queries (same fix as config/db.js).
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', ...dns.getServers()]);
} catch (_) {}

/**
 * Seed Database with Stories
 */

// Enriched hadiths (Bengali + category) — produced by scripts/enrich-hadith.js
const STORIES_FILE = path.join(__dirname, 'data', 'stories.enriched.json');

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
 * Load stories from JSON file
 */
const loadStoriesFromFile = () => {
  try {
    if (!fs.existsSync(STORIES_FILE)) {
      console.error(`❌ File not found: ${STORIES_FILE}`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(STORIES_FILE, 'utf8');
    const stories = JSON.parse(fileContent);

    if (!Array.isArray(stories)) {
      throw new Error('File must contain an array of stories');
    }

    console.log(`✅ Loaded ${stories.length} stories from file`);
    return stories;
  } catch (error) {
    console.error('❌ Error loading stories file:', error.message);
    process.exit(1);
  }
};

/**
 * Seed the database
 */
const seedStories = async () => {
  try {
    console.log('🌱 Starting stories seeding...\n');
    await connectDB();
    const stories = loadStoriesFromFile();

    // Clear existing stories
    const deleteResult = await Story.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing stories\n`);

    // Insert new stories
    console.log('📥 Inserting new stories...');
    const insertedStories = await Story.insertMany(stories);
    console.log(`✅ Inserted ${insertedStories.length} stories\n`);

    console.log('\n✅ Stories seeding completed!\n');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding stories:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedStories();

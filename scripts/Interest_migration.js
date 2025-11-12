//makes sure that interests field in users collection is an array of strings
const { MongoClient } = require('mongodb');
require('dotenv').config();

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) return console.error('Set MONGO_URI in .env');
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGO_DB || 'CampusTicketing');
    const users = db.collection('users');
    const cursor = users.find({ interests: { $type: 'string' } });
    while (await cursor.hasNext()) {
      const u = await cursor.next();
      const arr = String(u.interests).split(',').map(s => s.trim()).filter(Boolean);
      await users.updateOne({ _id: u._id }, { $set: { interests: arr } });
      console.log(`Migrated ${u._id} -> [${arr.join(', ')}]`);
    }
    console.log('Migration complete.');
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
})();
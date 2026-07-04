const mongoose = require('mongoose');

/**
 * AppState — arbitrary per-user client state blobs (Journey / Hifz progress).
 * Stored as an opaque object so the client owns the schema; the server just
 * persists + serves it, keyed by (uid, key).
 */
const appStateSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, index: true },
    key: { type: String, required: true }, // 'journey' | 'hifz'
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    // client-supplied logical timestamp for last-write / merge decisions
    clientUpdatedAt: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'appstates' }
);

appStateSchema.index({ uid: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('AppState', appStateSchema);

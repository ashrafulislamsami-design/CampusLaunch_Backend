const mongoose = require('mongoose');

const pitchRoomSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'PitchEvent', required: true },
  jitsiRoomName: { type: String, default: '' },
  roomName: { type: String, required: true },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  activePresenter: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  viewerCount: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date }
});

pitchRoomSchema.index({ event: 1 });

module.exports = mongoose.model('PitchRoom', pitchRoomSchema);

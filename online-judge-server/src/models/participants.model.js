const { type } = require("express/lib/response");
const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema({
  userId: { type: mongoose.SchemaTypes.ObjectId, required: true },
  name: { type: String, required: true },
  contestId: { type: mongoose.SchemaTypes.ObjectId, required: true },
  individualTime: { type: {}, default: {}, required: true },
  individualScore: { type: {}, default: {}, required: true },
  score: {
    default: 0,
    type: Number,
    required: true,
  },
  averageTime: {
    type: String,
    default: "",
  },
});

participantSchema.index({ userId: 1, contestId: 1 }, { unique: true });

const Participant = mongoose.model("Participant", participantSchema);

module.exports = Participant;

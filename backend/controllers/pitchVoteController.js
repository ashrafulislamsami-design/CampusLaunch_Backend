const PitchVote = require('../models/PitchVote');
const PitchEvent = require('../models/PitchEvent');

exports.submitVote = async (req, res) => {
  try {
    const { eventId, teamId } = req.body;

    const event = await PitchEvent.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!event.allowAudienceVoting) {
      return res.status(403).json({ message: 'Audience voting is not enabled for this event' });
    }

    const existing = await PitchVote.findOne({ event: eventId, voter: req.user.id });
    if (existing) {
      return res.status(409).json({ message: "You've already voted in this event" });
    }

    const vote = new PitchVote({
      event: eventId,
      team: teamId,
      voter: req.user.id
    });
    await vote.save();
    res.status(201).json(vote);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "You've already voted in this event" });
    }
    console.error(err.message);
    res.status(500).json({ message: 'Server error submitting vote' });
  }
};

exports.getVoteCounts = async (req, res) => {
  try {
    const votes = await PitchVote.aggregate([
      { $match: { event: require('mongoose').Types.ObjectId.createFromHexString(req.params.eventId) } },
      { $group: { _id: '$team', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const Team = require('../models/Team');
    const populated = await Team.populate(votes, { path: '_id', select: 'name' });
    const result = populated.map(v => ({ team: v._id, count: v.count }));

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error fetching votes' });
  }
};

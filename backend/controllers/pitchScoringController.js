const PitchScore = require('../models/PitchScore');
const PitchEvent = require('../models/PitchEvent');

exports.submitScore = async (req, res) => {
  try {
    const { eventId, teamId, problemClarity, solutionViability, teamStrength, marketPotential, feedback } = req.body;

    const event = await PitchEvent.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (!event.judges.map(j => j.toString()).includes(req.user.id)) {
      return res.status(403).json({ message: 'Only assigned judges can score' });
    }

    const score = await PitchScore.findOneAndUpdate(
      { event: eventId, team: teamId, judge: req.user.id },
      {
        problemClarity,
        solutionViability,
        teamStrength,
        marketPotential,
        totalScore: problemClarity + solutionViability + teamStrength + marketPotential,
        feedback: feedback || '',
        isSubmitted: true,
        submittedAt: new Date()
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json(score);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Score already submitted for this team' });
    }
    console.error(err.message);
    res.status(500).json({ message: 'Server error submitting score' });
  }
};

exports.getEventScores = async (req, res) => {
  try {
    const event = await PitchEvent.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const isOrganizer = event.organizer.toString() === req.user.id;
    const isJudge = event.judges.map(j => j.toString()).includes(req.user.id);
    const isPublished = event.status === 'results_published';

    if (!isOrganizer && !isJudge && !isPublished) {
      return res.status(403).json({ message: 'Scores not yet available' });
    }

    if (isJudge && !isOrganizer && !isPublished) {
      const myScores = await PitchScore.find({ event: req.params.eventId, judge: req.user.id })
        .populate('team', 'name');
      return res.json(myScores);
    }

    const scores = await PitchScore.find({ event: req.params.eventId })
      .populate('team', 'name')
      .populate('judge', 'name');

    res.json(scores);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error fetching scores' });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const event = await PitchEvent.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (!event.showLiveLeaderboard && event.status !== 'results_published') {
      return res.status(403).json({ message: 'Leaderboard not enabled' });
    }

    const scores = await PitchScore.aggregate([
      { $match: { event: event._id, isSubmitted: true } },
      {
        $group: {
          _id: '$team',
          avgTotal: { $avg: '$totalScore' },
          avgProblem: { $avg: '$problemClarity' },
          avgSolution: { $avg: '$solutionViability' },
          avgTeam: { $avg: '$teamStrength' },
          avgMarket: { $avg: '$marketPotential' },
          judgeCount: { $sum: 1 }
        }
      },
      { $sort: { avgTotal: -1 } }
    ]);

    const Team = require('../models/Team');
    const populated = await Team.populate(scores, { path: '_id', select: 'name logoUrl' });
    const leaderboard = populated.map((s, idx) => ({
      rank: idx + 1,
      team: s._id,
      avgTotal: Math.round(s.avgTotal * 10) / 10,
      avgProblem: Math.round(s.avgProblem * 10) / 10,
      avgSolution: Math.round(s.avgSolution * 10) / 10,
      avgTeam: Math.round(s.avgTeam * 10) / 10,
      avgMarket: Math.round(s.avgMarket * 10) / 10,
      judgeCount: s.judgeCount
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error fetching leaderboard' });
  }
};

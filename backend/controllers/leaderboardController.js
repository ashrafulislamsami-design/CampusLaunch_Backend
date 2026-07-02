const User = require('../models/User');
const Team = require('../models/Team');
const { sendNotification } = require('../utils/notificationHelper');

/**
 * @route   GET /api/leaderboard/university
 * @desc    Get university rankings based on aggregated team and student metrics
 */
exports.getUniversityRankings = async (req, res) => {
  try {
    const universityRankings = await User.aggregate([
      // 1. Target students with a university
      { 
        $match: { 
          role: 'Student', 
          university: { $ne: null, $ne: '' } 
        } 
      },
      // 2. Lookup their teams
      {
        $lookup: {
          from: 'teams',
          localField: '_id',
          foreignField: 'members.userId',
          as: 'team'
        }
      },
      // 3. Unwind teams (preserve students without teams)
      { $unwind: { path: "$team", preserveNullAndEmptyArrays: true } },
      // 4. Group by University and Team to isolate unique team metrics per university
      // While also summing individual student contributions within those groups
      {
        $group: {
          _id: { 
            university: "$university", 
            teamId: "$team._id" 
          },
          // Unique Team Metrics (counted once per team)
          teamFunding: { $first: { $ifNull: ["$team.fundingReceived", 0] } },
          teamEvents: { $first: { $ifNull: ["$team.pitchEventsJoined", 0] } },
          // Aggregated Student Metrics (summed for everyone in that university/team bucket)
          userFunding: { $sum: { $ifNull: ["$funding", 0] } },
          userEvents: { $sum: { $ifNull: ["$pitchEvents", 0] } },
          userMentors: { $sum: { $ifNull: ["$mentorSessions", 0] } },
          userCourses: { $sum: { $ifNull: ["$coursesFinished", 0] } }
        }
      },
      // 5. Aggregate metrics by University
      {
        $group: {
          _id: "$_id.university",
          totalFunding: { $sum: { $add: ["$teamFunding", "$userFunding"] } },
          totalEvents: { $sum: { $add: ["$teamEvents", "$userEvents"] } },
          totalMentorSessions: { $sum: "$userMentors" },
          totalCoursesFinished: { $sum: "$userCourses" },
          activeTeams: { 
            $sum: { $cond: [{ $ne: ["$_id.teamId", null] }, 1, 0] } 
          }
        }
      },
      // 6. Calculate weighted score and project final fields
      {
        $project: {
          _id: 0,
          university: "$_id",
          totalFunding: 1,
          totalEvents: 1,
          totalMentorSessions: 1,
          totalCoursesFinished: 1,
          activeTeams: 1,
          weightedScore: { 
            $add: [
              "$totalFunding", 
              "$totalEvents", 
              "$totalMentorSessions",
              "$totalCoursesFinished",
              { $multiply: ["$activeTeams", 10] } // 10 points bonus per active team
            ] 
          }
        }
      },
      // 7. Sort by highest score
      { $sort: { weightedScore: -1 } }
    ]);

    res.json(universityRankings);
  } catch (err) {
    console.error('University leaderboard error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * @route   GET /api/leaderboard/individual
 * @desc    Get top 10 students by courses finished and mentor sessions
 */
exports.getIndividualRankings = async (req, res) => {
  try {
    const topStudents = await User.find({ role: 'Student' })
      .select('name university department coursesFinished mentorSessions isAmbassador')
      .sort({ coursesFinished: -1, mentorSessions: -1 })
      .limit(10);

    res.json(topStudents);
  } catch (err) {
    console.error('Individual leaderboard error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * @route   PATCH /api/leaderboard/ambassador/:id
 * @desc    Toggle isAmbassador status for a user
 */
exports.nominateAmbassador = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isAmbassador = !user.isAmbassador;
    await user.save();

    // Send notification if newly nominated
    if (user.isAmbassador) {
      await sendNotification(
        user._id,
        "Campus Ambassador Nomination! 🌟",
        `Congratulations ${user.name}! You have been officially nominated as a Campus Ambassador for your university.`,
        "TEAM_UPDATE"
      );
    }

    res.json({ 
      message: `User ${user.name} ambassador status toggled to ${user.isAmbassador}`,
      isAmbassador: user.isAmbassador 
    });
  } catch (err) {
    console.error('Ambassador nomination error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

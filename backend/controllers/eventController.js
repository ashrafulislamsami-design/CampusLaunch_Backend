const Event = require('../models/Event');

// @route   GET /api/events
// @desc    Get all events (auto-seeds if empty)
exports.getEvents = async (req, res) => {
  try {
    let events = await Event.find().sort({ date: 1 });

    // Auto-seed for testing purposes
    if (events.length === 0) {
      const seedEvents = [
        {
          title: "National AI Build-a-thon",
          date: new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000), // In 14 days
          description: "A 48-hour hackathon bringing together students to launch Artificial Intelligence MVP products.",
          location: "Silicon Valley Campus (Hybrid)",
          link: "https://example.com/ai-buildathon"
        },
        {
          title: "Hult Prize Regional Summit",
          date: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000), // In 30 days
          description: "The world's largest student competition focusing on social enterprise and sustainable goals.",
          location: "Main Auditorium",
          link: "https://example.com/hult"
        }
      ];
      await Event.insertMany(seedEvents);
      events = await Event.find().sort({ date: 1 });
    }

    res.json(events);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @route   POST /api/events/:id/register
// @desc    Register a team for an event
exports.registerTeam = async (req, res) => {
  try {
    const { teamId } = req.body;
    
    if (!teamId) {
      return res.status(400).json({ message: "teamId is required to register" });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Check if team is already registered
    if (event.attendees.includes(teamId)) {
      return res.status(400).json({ message: 'Your team is already registered for this event!' });
    }

    event.attendees.push(teamId);
    await event.save();

    res.json({ message: 'Team successfully registered!', event });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

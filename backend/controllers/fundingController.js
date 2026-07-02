const Funding = require('../models/Funding');
const User = require('../models/User');
const { sendNotification } = require('../utils/notificationHelper');
const cache = require('../utils/cache');

// @route   GET /api/funding
// @desc    Get all funding opportunities with search and filtering
exports.getAllFunding = async (req, res) => {
  try {
    const { search, category } = req.query;
    
    // Construct cache key based on search and category
    const cacheKey = `funding:list:${(search || '').trim()}:${category || ''}`;
    
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    let query = {};

    if (search && search.trim() !== '') {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { provider: { $regex: search.trim(), $options: 'i' } }
      ];
    } else {
      query = {};
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    const funding = await Funding.find(query).sort({ deadline: 1 });
    
    // Cache results for 10 minutes (600 seconds)
    await cache.set(cacheKey, funding, 600);

    res.json(funding);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @route   POST /api/funding/watchlist
// @desc    Toggle funding item in user's watchlist
exports.toggleWatchlist = async (req, res) => {
  try {
    const { fundingId } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const funding = await Funding.findById(fundingId);
    if (!funding) {
      return res.status(404).json({ message: 'Funding opportunity not found' });
    }

    const index = user.watchlist.indexOf(fundingId);
    if (index > -1) {
      // Remove from watchlist
      user.watchlist.splice(index, 1);
    } else {
      // Add to watchlist
      user.watchlist.push(fundingId);
    }

    await user.save();
    res.json(user.watchlist);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Trigger funding deadline alerts for watchlisted items nearing close date.
exports.sendFundingDeadlineAlerts = async () => {
  const users = await User.find({ watchlist: { $exists: true, $not: { $size: 0 } } })
    .populate('watchlist');

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (const user of users) {
    for (const funding of user.watchlist) {
      const deadline = new Date(funding.deadline);
      deadline.setHours(0, 0, 0, 0);

      const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      if (diffDays !== 3 && diffDays !== 1) continue;

      const timeLabel = diffDays === 1 ? 'in 1 day' : 'in 3 days';
      await sendNotification(
        user._id,
        'Watchlist funding closing soon',
        `${funding.title} (${funding.provider}) closes ${timeLabel}.`,
        'FUNDING',
        { dedupeKey: `FUNDING_DEADLINE:${funding._id}:${user._id}:${diffDays}` }
      );
    }
  }
};

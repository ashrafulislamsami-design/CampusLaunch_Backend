const Team = require('../models/Team');
const User = require('../models/User');
const Canvas = require('../models/Canvas');
const { sendNotification } = require('../utils/notificationHelper');

const notifyOtherTeamMembers = async (team, actorId, title, message) => {
  const recipients = team.members
    .filter((member) => member.status === 'accepted') // Only notify accepted members
    .map((member) => member.userId.toString())
    .filter((userId) => userId !== actorId);

  await Promise.all(
    recipients.map((recipientId) =>
      sendNotification(
        recipientId, 
        title, 
        message, 
        'TEAM_UPDATE', 
        { dedupeKey: `TEAM_UPDATE:${team._id}:${actorId}:${title.replace(/\s+/g, '')}:${new Date().toISOString().split('T')[0]}` }
      )
    )
  );
};

// @route   POST /api/teams
// @desc    Create a new team
exports.createTeam = async (req, res) => {
  try {
    const { name, problemStatement, solution, targetCustomer, stage, logoUrl } = req.body;

    const newTeam = new Team({
      name,
      problemStatement,
      solution,
      targetCustomer,
      stage,
      logoUrl,
      members: [{ userId: req.user.id, role: 'CEO', status: 'accepted' }],
      tasks: []
    });

    const team = await newTeam.save();
    res.status(201).json(team);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   GET /api/teams/:id
// @desc    Get team by ID (for Dashboard)
exports.getTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('members.userId', 'name email role')
      .populate('tasks.assignedTo', 'name email')
      .populate('documents.uploadedBy', 'name email');

    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Check if user is part of the team
    const isMember = team.members.some(m => m.userId._id.toString() === req.user.id);
    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized to view this team' });
    }

    res.json(team);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Team not found' });
    }
    res.status(500).send('Server Error');
  }
};

// @route   POST /api/teams/:id/members
// @desc    Invite/Add a member by email
exports.addMember = async (req, res) => {
  try {
    const { email, role } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) return res.status(404).json({ message: 'Team not found' });

    // Check if requester is CEO (or allowed to add)
    const requester = team.members.find(m => m.userId.toString() === req.user.id);
    if (!requester || requester.role !== 'CEO') {
      return res.status(403).json({ message: 'Only CEO can add members' });
    }

    // Get CEO details, user to add, and requester details concurrently
    const ceoMember = team.members.find(m => m.role === 'CEO');
    const [userToAdd, ceoUser, requesterUser] = await Promise.all([
      User.findOne({ email }),
      ceoMember ? User.findById(ceoMember.userId) : Promise.resolve(null),
      User.findById(req.user.id)
    ]);

    if (!userToAdd) {
      return res.status(404).json({ message: 'User with this email not found. They must register first.' });
    }

    // Check if already in team
    if (team.members.some(m => m.userId.toString() === userToAdd.id)) {
      return res.status(400).json({ message: 'User is already a member of this team' });
    }

    // Add member with pending status
    team.members.push({ userId: userToAdd.id, role: role || 'Member', status: 'pending' });
    await team.save();

    // Send invitation notification to the invited user
    await sendNotification(
      userToAdd.id,
      `Team Invite: ${team.name}`,
      `${requesterUser?.name || 'The CEO'} invited you to join ${team.name} as ${role || 'Member'}. Accept or decline the invite.`,
      'TEAM_UPDATE'
    );

    res.json(team.members);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   PUT /api/teams/:id/invites/accept
// @desc    Accept a team invite
exports.acceptInvite = async (req, res) => {
  try {
    const teamId = req.params.id;
    const userId = req.user.id;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    // Find the member with pending status
    const member = team.members.find(m => m.userId.toString() === userId);
    if (!member) {
      return res.status(404).json({ message: 'You are not invited to this team' });
    }

    if (member.status === 'accepted') {
      return res.status(400).json({ message: 'You have already accepted this invite' });
    }

    // Update status to accepted
    member.status = 'accepted';
    await team.save();

    // Get current user details
    const currentUser = await User.findById(userId);

    // Notify the CEO that the invite was accepted
    const ceoMember = team.members.find(m => m.role === 'CEO');
    if (ceoMember) {
      await sendNotification(
        ceoMember.userId.toString(),
        `Team Member Joined: ${team.name}`,
        `${currentUser?.name || 'A user'} accepted your invite to join ${team.name}!`,
        'TEAM_UPDATE'
      );
    }

    // Populate and return
    await team.populate('members.userId', 'name email role');
    res.json(team);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   POST /api/teams/:id/tasks
// @desc    Add a task
exports.createTask = async (req, res) => {
  try {
    const { title, description, status, assignedToEmail } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) return res.status(404).json({ message: 'Team not found' });
    const member = team.members.find((m) => m.userId.toString() === req.user.id);
    if (!member) {
      return res.status(403).json({ message: 'Only team members can add tasks' });
    }
    if (member.status !== 'accepted') {
      return res.status(403).json({ message: 'Only accepted team members can add tasks' });
    }

    let assignedTo = null;
    if (assignedToEmail) {
       const user = await User.findOne({ email: assignedToEmail });
       if (user) assignedTo = user.id;
    }

    const newTask = { title, description, status: status || 'To Do', assignedTo };
    team.tasks.push(newTask);
    await team.save();
    await notifyOtherTeamMembers(
      team,
      req.user.id,
      `New team task in ${team.name}`,
      `${newTask.title} was added to your team board.`
    );

    res.json(team.tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   PUT /api/teams/:id/tasks/:taskId
// @desc    Update a task status
exports.updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) return res.status(404).json({ message: 'Team not found' });

    const member = team.members.find(m => m.userId.toString() === req.user.id);
    if (!member) return res.status(403).json({ message: 'Not authorized: Not a member of this team' });
    if (member.status !== 'accepted') return res.status(403).json({ message: 'Only accepted team members can update tasks' });

    const task = team.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.status = status;
    await team.save();

    res.json(team.tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   GET /api/teams/user/me
// @desc    Get user's teams
exports.getUserTeams = async (req, res) => {
  try {
    const teams = await Team.find({ 'members.userId': req.user.id });
    res.json(teams);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   GET /api/teams/public/:id
// @desc    Get public team details for Showcase (No auth required)
exports.getPublicTeamDetails = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('members.userId', 'name email role')
      .select('name problemStatement solution targetCustomer stage logoUrl history description teamPhotoUrl productMedia businessModel pitchDeckUrl achievements fundingRounds members _id');

    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    res.json(team);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Team not found' });
    }
    res.status(500).send('Server Error');
  }
};

// @route   GET /api/teams/public
// @desc    Get all teams for the public Showcase Directory
exports.getAllTeams = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { problemStatement: { $regex: search, $options: 'i' } },
          { solution: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const teams = await Team.find(query)
      .select('name logoUrl stage problemStatement solution fundingReceived _id');
    
    res.json(teams);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   PUT /api/teams/:id/portfolio
// @desc    Update team portfolio/showcase details (CEO only)
exports.updatePortfolio = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    // Validate CEO Authorization
    const requester = team.members.find(m => {
      const actualId = m.userId._id ? m.userId._id.toString() : m.userId.toString();
      return actualId === req.user.id;
    });
    if (!requester || requester.role !== 'CEO') {
      return res.status(403).json({ message: 'Forbidden. Only the CEO can update the showcase.' });
    }

    const {
      description,
      teamPhotoUrl,
      productMedia,
      businessModel,
      pitchDeckUrl,
      achievements,
      fundingRounds,
      logoUrl,
      problemStatement,
      solution,
      stage
    } = req.body;

    // Apply updates
    if (description !== undefined) team.description = description;
    if (teamPhotoUrl !== undefined) team.teamPhotoUrl = teamPhotoUrl;
    if (productMedia !== undefined) team.productMedia = productMedia;
    if (businessModel !== undefined) team.businessModel = businessModel;
    if (pitchDeckUrl !== undefined) team.pitchDeckUrl = pitchDeckUrl;
    if (achievements !== undefined) team.achievements = achievements;
    if (fundingRounds !== undefined) team.fundingRounds = fundingRounds;
    if (logoUrl !== undefined) team.logoUrl = logoUrl;
    if (problemStatement !== undefined) team.problemStatement = problemStatement;
    if (solution !== undefined) team.solution = solution;
    
    if (stage && stage !== team.stage) {
      team.history.push({
        oldStage: team.stage,
        newStage: stage,
        changeNote: `Transitioned startup to ${stage}`
      });
      team.stage = stage;
    }

    await team.save();
    res.json(team);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   PUT /api/teams/:id/members/:userId/role
// @desc    Update a member's role
exports.updateMemberRole = async (req, res) => {
  try {
    const teamId = req.params.id;
    const userId = req.params.userId;
    const newRole = req.body.role;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    // Check if requester is CEO
    const requester = team.members.find(m => m.userId.toString() === req.user.id);
    if (!requester || requester.role !== 'CEO') {
      return res.status(403).json({ message: 'Only CEO can change roles' });
    }

    // Check if member being updated is accepted
    const memberToUpdate = team.members.find(m => m.userId.toString() === userId);
    if (!memberToUpdate) {
      return res.status(404).json({ message: 'Member not found in team' });
    }
    if (memberToUpdate.status !== 'accepted') {
      return res.status(400).json({ message: 'Can only change roles for accepted members' });
    }

    // Update using findOneAndUpdate with positional operator
    const updatedTeam = await Team.findOneAndUpdate(
      { _id: teamId, "members.userId": userId },
      { $set: { "members.$.role": newRole } },
      { new: true }
    ).populate('members.userId', 'name email role');

    console.log("Database update result:", updatedTeam);

    if (!updatedTeam) {
      return res.status(404).json({ message: 'Member not found in team' });
    }

    res.json(updatedTeam);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   PATCH /api/teams/:id/details
// @desc    Update team foundational details (CEO only)
exports.updateTeamDetails = async (req, res) => {
  try {
    const { name, problemStatement, solution, stage } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    // Validate CEO Authorization
    const requester = team.members.find(m => m.userId.toString() === req.user.id);
    if (!requester || requester.role !== 'CEO') {
      return res.status(403).json({ message: 'Forbidden. Only the CEO can update startup details.' });
    }

    // Apply updates
    if (name) team.name = name;
    if (problemStatement) team.problemStatement = problemStatement;
    if (solution) team.solution = solution;

    // History Tracking logic for Stage transition
    if (stage && stage !== team.stage) {
      team.history.push({
        oldStage: team.stage,
        newStage: stage,
        changeNote: `Transitioned startup to ${stage}`
      });
      team.stage = stage;
    }

    await team.save();
    await team.populate('members.userId', 'name email role');

    res.json(team);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   GET /api/teams/:id/canvas
// @desc    Get team's canvas
exports.getCanvas = async (req, res) => {
  try {
    let canvas = await Canvas.findOne({ teamId: req.params.id });
    if (!canvas) {
      canvas = new Canvas({ teamId: req.params.id });
      await canvas.save();
    }
    res.json(canvas);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   PUT /api/teams/:id/canvas
// @desc    Update team's canvas
exports.updateCanvas = async (req, res) => {
  try {
    const canvasDoc = await Canvas.findOneAndUpdate(
      { teamId: req.params.id },
      { $set: req.body },
      { new: true, upsert: true }
    );
    res.json(canvasDoc);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   POST /api/teams/:id/messages
// @desc    Add a message to the team feed
exports.addMessage = async (req, res) => {
  try {
    const { text } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    // Retrieve current member record to get name and role
    const sender = await User.findById(req.user.id);
    const member = team.members.find(m => m.userId.toString() === req.user.id);
    if (!member) return res.status(403).json({ message: 'Only team members can post to feed' });
    if (member.status !== 'accepted') return res.status(403).json({ message: 'Only accepted team members can post to feed' });

    const newMessage = {
      senderId: req.user.id,
      senderName: sender.name,
      senderRole: member.role || 'Member',
      text
    };

    team.messages.push(newMessage);
    await team.save();
    await notifyOtherTeamMembers(
      team,
      req.user.id,
      `New message in ${team.name}`,
      `${sender?.name || 'A teammate'} posted: "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`
    );
    res.json(team.messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   POST /api/teams/:id/documents
// @desc    Add a document/resource link
exports.addDocument = async (req, res) => {
  try {
    const { title, url, category } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    const uploader = await User.findById(req.user.id);
    const member = team.members.find((m) => m.userId.toString() === req.user.id);
    if (!member) {
      return res.status(403).json({ message: 'Only team members can add documents' });
    }
    if (member.status !== 'accepted') {
      return res.status(403).json({ message: 'Only accepted team members can add documents' });
    }

    const newDocument = {
      title,
      url,
      category: category || 'Resource',
      uploadedBy: req.user.id
    };

    team.documents.push(newDocument);
    await team.save();
    await team.populate('documents.uploadedBy', 'name email');
    await notifyOtherTeamMembers(
      team,
      req.user.id,
      `New document in ${team.name}`,
      `${uploader?.name || 'A teammate'} shared "${title}".`
    );
    res.json(team.documents);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
// @route   DELETE /api/teams/:id/tasks/:taskId
// @desc    Delete a task (CEO or any accepted member)
exports.deleteTask = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const member = team.members.find(m => m.userId.toString() === req.user.id);
    if (!member) return res.status(403).json({ message: 'Not a team member' });
    if (member.status !== 'accepted') return res.status(403).json({ message: 'Only accepted members can delete tasks' });

    const taskExists = team.tasks.id(req.params.taskId);
    if (!taskExists) return res.status(404).json({ message: 'Task not found' });

    await Team.findByIdAndUpdate(
      req.params.id,
      { $pull: { tasks: { _id: req.params.taskId } } }
    );

    const updated = await Team.findById(req.params.id);
    res.json(updated.tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   DELETE /api/teams/:id/documents/:docId
// @desc    Delete a document (CEO only)
exports.deleteDocument = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const requester = team.members.find(m => m.userId.toString() === req.user.id);
    if (!requester || requester.role !== 'CEO') {
      return res.status(403).json({ message: 'Only CEO can delete documents' });
    }

    await Team.findByIdAndUpdate(
      req.params.id,
      { $pull: { documents: { _id: req.params.docId } } }
    );

    const updated = await Team.findById(req.params.id).populate('documents.uploadedBy', 'name email');
    res.json(updated.documents);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   DELETE /api/teams/:id/messages/:msgId
// @desc    Delete a team message (sender or CEO)
exports.deleteMessage = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const requester = team.members.find(m => m.userId.toString() === req.user.id);
    if (!requester) return res.status(403).json({ message: 'Not a team member' });

    const msg = team.messages.id(req.params.msgId);
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    const isCEO = requester.role === 'CEO';
    const isSender = msg.senderId.toString() === req.user.id;
    if (!isCEO && !isSender) {
      return res.status(403).json({ message: 'Only the sender or CEO can delete a message' });
    }

    await Team.findByIdAndUpdate(
      req.params.id,
      { $pull: { messages: { _id: req.params.msgId } } }
    );

    const updated = await Team.findById(req.params.id);
    res.json(updated.messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   DELETE /api/teams/:id/members/:userId
// @desc    Remove a member (CEO only)
exports.removeMember = async (req, res) => {
  try {
    const teamId = req.params.id;
    const userIdToRemove = req.params.userId;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    // 1. Authorize CEO
    const requester = team.members.find(m => m.userId.toString() === req.user.id);
    if (!requester || requester.role !== 'CEO') {
      return res.status(403).json({ message: 'Only CEO can remove members' });
    }

    // 2. Prevent removing the CEO themselves
    const memberToRemove = team.members.find(m => m.userId.toString() === userIdToRemove);
    if (memberToRemove && memberToRemove.role === 'CEO') {
       return res.status(400).json({ message: 'Cannot remove the CEO. Relinquish role first if needed.' });
    }

    // 3. Perform removal
    const updatedTeam = await Team.findByIdAndUpdate(
      teamId,
      { $pull: { members: { userId: userIdToRemove } } },
      { new: true }
    ).populate('members.userId', 'name email role');

    res.json(updatedTeam);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

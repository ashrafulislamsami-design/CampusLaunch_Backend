// Real-time collaboration for the Business Model Canvas Builder.
// Clients emit `canvas:*` events and the server relays updates to other clients
// in the same room (`canvas-<teamId>`). Presence is tracked in-memory per room.

const PRESENCE = new Map(); // teamId -> Map(socketId -> { userId, userName, color, sectionKey })

const PRESENCE_COLORS = [
  '#0f766e', '#b45309', '#7c3aed', '#be123c',
  '#0369a1', '#15803d', '#c2410c', '#6d28d9'
];

const hashColor = (userId = '') => {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return PRESENCE_COLORS[h % PRESENCE_COLORS.length];
};

const presenceList = (teamId) => {
  const room = PRESENCE.get(teamId);
  if (!room) return [];
  const seen = new Set();
  const out = [];
  for (const entry of room.values()) {
    if (seen.has(entry.userId)) continue;
    seen.add(entry.userId);
    out.push({
      userId: entry.userId,
      userName: entry.userName,
      color: entry.color,
      sectionKey: entry.sectionKey || null
    });
  }
  return out;
};

module.exports = function initCanvasSocket(io) {
  // Dedicated namespace keeps these sockets isolated from any other module.
  const nsp = io.of('/canvas');

  nsp.on('connection', (socket) => {
    let joinedTeamId = null;
    let joinedUser = null;

    socket.on('canvas:join', ({ teamId, userId, userName }) => {
      if (!teamId || !userId) return;
      joinedTeamId = teamId;
      joinedUser = { userId, userName: userName || 'Member', color: hashColor(userId) };
      const room = `canvas-${teamId}`;
      socket.join(room);

      if (!PRESENCE.has(teamId)) PRESENCE.set(teamId, new Map());
      PRESENCE.get(teamId).set(socket.id, { ...joinedUser, sectionKey: null });

      nsp.to(room).emit('canvas:presence:update', { activeUsers: presenceList(teamId) });
    });

    socket.on('canvas:card:add', (payload) => {
      if (!joinedTeamId) return;
      socket.to(`canvas-${joinedTeamId}`).emit('canvas:card:added', payload);
    });

    socket.on('canvas:card:update', (payload) => {
      if (!joinedTeamId) return;
      socket.to(`canvas-${joinedTeamId}`).emit('canvas:card:updated', payload);
    });

    socket.on('canvas:card:delete', (payload) => {
      if (!joinedTeamId) return;
      socket.to(`canvas-${joinedTeamId}`).emit('canvas:card:deleted', payload);
    });

    socket.on('canvas:card:reorder', (payload) => {
      if (!joinedTeamId) return;
      socket.to(`canvas-${joinedTeamId}`).emit('canvas:card:reordered', payload);
    });

    socket.on('canvas:section:focus', ({ sectionKey, userId, userName }) => {
      if (!joinedTeamId) return;
      const room = PRESENCE.get(joinedTeamId);
      if (room && room.has(socket.id)) {
        room.get(socket.id).sectionKey = sectionKey;
      }
      nsp.to(`canvas-${joinedTeamId}`).emit('canvas:section:focused', {
        sectionKey,
        userId,
        userName,
        color: joinedUser?.color || hashColor(userId)
      });
      nsp.to(`canvas-${joinedTeamId}`).emit('canvas:presence:update', {
        activeUsers: presenceList(joinedTeamId)
      });
    });

    socket.on('canvas:section:blur', ({ sectionKey, userId }) => {
      if (!joinedTeamId) return;
      const room = PRESENCE.get(joinedTeamId);
      if (room && room.has(socket.id)) {
        room.get(socket.id).sectionKey = null;
      }
      nsp.to(`canvas-${joinedTeamId}`).emit('canvas:section:blurred', { sectionKey, userId });
      nsp.to(`canvas-${joinedTeamId}`).emit('canvas:presence:update', {
        activeUsers: presenceList(joinedTeamId)
      });
    });

    socket.on('canvas:saved', (payload) => {
      if (!joinedTeamId) return;
      nsp.to(`canvas-${joinedTeamId}`).emit('canvas:saved', payload);
    });

    socket.on('disconnect', () => {
      if (!joinedTeamId) return;
      const room = PRESENCE.get(joinedTeamId);
      if (room) {
        const entry = room.get(socket.id);
        if (entry && entry.sectionKey && joinedUser) {
          nsp.to(`canvas-${joinedTeamId}`).emit('canvas:section:blurred', {
            sectionKey: entry.sectionKey,
            userId: joinedUser.userId
          });
        }
        room.delete(socket.id);
        if (room.size === 0) PRESENCE.delete(joinedTeamId);
      }
      nsp.to(`canvas-${joinedTeamId}`).emit('canvas:presence:update', {
        activeUsers: presenceList(joinedTeamId)
      });
    });
  });

  return nsp;
};

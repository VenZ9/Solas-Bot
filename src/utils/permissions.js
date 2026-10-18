const config = require('../config');

/**
 * Checks if a user is the configured bot owner
 */
function isOwner(userId) {
  return Boolean(config.ownerId && userId === config.ownerId);
}

/**
 * Validates member has specific Discord permission or is guild owner/administrator
 */
function hasPermission(member, permissionBitfield) {
  if (!member) return false;
  if (member.guild.ownerId === member.id) return true;
  if (member.permissions.has('Administrator')) return true;
  if (!permissionBitfield) return true;
  return member.permissions.has(permissionBitfield);
}

/**
 * Validates role hierarchy between executor, target, and the bot itself.
 * Returns { canAct: boolean, reason?: string }
 */
function checkHierarchy(executorMember, targetMember, botMember) {
  if (!executorMember || !targetMember) {
    return { canAct: false, reason: 'Invalid member reference.' };
  }

  // Guild owner can never be moderated
  if (targetMember.id === targetMember.guild.ownerId) {
    return { canAct: false, reason: 'Action denied: The server owner cannot be targeted.' };
  }

  // Cannot act on self
  if (executorMember.id === targetMember.id) {
    return { canAct: false, reason: 'Action denied: You cannot execute this action on yourself.' };
  }

  // Bot cannot moderate itself
  if (targetMember.id === botMember.id) {
    return { canAct: false, reason: 'Action denied: The bot cannot target itself.' };
  }

  // Executor hierarchy check (guild owner bypasses role check)
  if (executorMember.id !== executorMember.guild.ownerId) {
    const executorHighest = executorMember.roles.highest.position;
    const targetHighest = targetMember.roles.highest.position;

    if (targetHighest >= executorHighest) {
      return {
        canAct: false,
        reason: 'Action denied: Target has an equal or higher role hierarchy than your highest role.',
      };
    }
  }

  // Bot hierarchy check
  const botHighest = botMember.roles.highest.position;
  const targetHighest = targetMember.roles.highest.position;

  if (targetHighest >= botHighest) {
    return {
      canAct: false,
      reason: 'Action denied: Target has an equal or higher role hierarchy than the bot\'s highest role.',
    };
  }

  return { canAct: true };
}

/**
 * Checks if executor and bot can manage the given role
 */
function canManageRole(executorMember, botMember, role) {
  if (!role || !executorMember || !botMember) {
    return { canAct: false, reason: 'Invalid role or member.' };
  }

  if (role.managed) {
    return { canAct: false, reason: 'Action denied: This role is managed by an integration.' };
  }

  if (role.id === role.guild.id) {
    return { canAct: false, reason: 'Action denied: The @everyone role cannot be modified this way.' };
  }

  // Executor check
  if (executorMember.id !== executorMember.guild.ownerId) {
    if (role.position >= executorMember.roles.highest.position) {
      return {
        canAct: false,
        reason: 'Action denied: Target role is equal or higher than your highest role.',
      };
    }
  }

  // Bot check
  if (role.position >= botMember.roles.highest.position) {
    return {
      canAct: false,
      reason: 'Action denied: Target role is equal or higher than the bot\'s highest role.',
    };
  }

  return { canAct: true };
}

module.exports = {
  isOwner,
  hasPermission,
  checkHierarchy,
  canManageRole,
};

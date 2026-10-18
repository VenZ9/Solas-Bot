const { PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../config');
const { isOwner, hasPermission, checkHierarchy, canManageRole } = require('../utils/permissions');
const { errorEmbed, successEmbed, infoEmbed, warningEmbed, panelEmbed } = require('../utils/embeds');
const ticketsRepo = require('../database/repositories/tickets');
const giveawaysRepo = require('../database/repositories/giveaways');
const reactionRolesRepo = require('../database/repositories/reactionRoles');
const moderationRepo = require('../database/repositories/moderation');
const botSettingsRepo = require('../database/repositories/botSettings');
const loggingService = require('../services/loggingService');
const { generateTranscriptHtml, saveTranscript, archiveAndCloseTicket } = require('../utils/transcript');
const logger = require('../utils/logger');

async function handleButtonInteraction(interaction) {
  const customId = interaction.customId;

  // 1. Owner Panel Controls
  if (customId.startsWith('owner_')) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        embeds: [errorEmbed('Access Denied', 'Owner commands are restricted exclusively to the configured system administrator.')],
        ephemeral: true,
      });
    }

    if (customId === 'owner_maintenance_toggle') {
      const current = botSettingsRepo.isMaintenanceMode();
      botSettingsRepo.setMaintenanceMode(!current, 'Toggled from owner dashboard');
      const newState = !current ? 'ENABLED' : 'DISABLED';
      return interaction.reply({
        embeds: [successEmbed('Maintenance Mode Updated', `Maintenance mode is now **${newState}**. Non-owners cannot run commands.`)],
        ephemeral: true,
      });
    }

    if (customId === 'owner_shutdown') {
      const { gracefulShutdown } = require('../utils/lifecycle');
      await interaction.reply({
        embeds: [warningEmbed('System Shutdown', 'Gracefully closing connections, sweepers, and terminating Solas process...')],
        ephemeral: true,
      });
      logger.info('Graceful shutdown initiated via owner panel.');
      setTimeout(() => {
        gracefulShutdown('OWNER_PANEL_BUTTON');
      }, 1000);
      return;
    }
  }

  // 1b. Moderation Panel Quick Actions
  if (customId === 'mod_panel_warn') {
    if (!hasPermission(interaction.member, 'ModerateMembers')) {
      return interaction.reply({
        embeds: [errorEmbed('Permission Denied', 'You require ModerateMembers permission to issue warnings.')],
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId('modal_mod_warn')
      .setTitle('Issue Member Warning')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('target_id')
            .setLabel('Target Member User ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('17-20 digit Discord User ID')
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Warning Reason')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Describe the infraction...')
            .setRequired(true)
        )
      );

    return interaction.showModal(modal);
  }

  if (customId === 'mod_panel_refresh') {
    if (!hasPermission(interaction.member, 'ModerateMembers')) {
      return interaction.reply({
        embeds: [errorEmbed('Permission Denied', 'You require ModerateMembers permission to access the moderation panel.')],
        ephemeral: true,
      });
    }

    const recent = moderationRepo.getRecentActions(interaction.guild.id, 5);
    let recentSummary = 'No recent moderation events logged.';
    if (recent.length > 0) {
      recentSummary = recent.map(r => {
        const time = Math.floor(r.created_at / 1000);
        return `• <t:${time}:R> | **${r.action_type}** on <@${r.user_id}> by <@${r.moderator_id}>`;
      }).join('\n');
    }

    const embed = panelEmbed(
      'Moderation Control Center',
      `Welcome to the Solas Server Moderation Panel.\n\nUse slash commands for direct actions, or access quick moderation tools below.\n\n**Recent Server Sanctions:**\n${recentSummary}`
    );
    embed.addGlassField('Available Controls', 'Ban, Kick, Timeout, Warn, Warnings Management, Slowmode, Purge, Channel Lock', false);

    return interaction.update({
      embeds: [embed],
    });
  }

  // 2. Moderation Confirmation Controls (Format: mod_<confirm|cancel>:<action>:<targetId>:<executorId>)
  if (customId.startsWith('mod_confirm:') || customId.startsWith('mod_cancel:')) {
    const parts = customId.split(':');
    const actionType = parts[1];
    const targetId = parts[2];
    const executorId = parts[3];

    // Recheck authorization server-side: only the initiator can click
    if (interaction.user.id !== executorId) {
      return interaction.reply({
        embeds: [errorEmbed('Authorization Failure', 'You are not authorized to respond to this confirmation prompt.')],
        ephemeral: true,
      });
    }

    if (customId.startsWith('mod_cancel:')) {
      return interaction.update({
        embeds: [infoEmbed('Action Cancelled', `The pending **${actionType.toUpperCase()}** operation was aborted.`)],
        components: [],
      });
    }

    // Recheck executor permissions
    const permMap = {
      ban: 'BanMembers',
      unban: 'BanMembers',
      kick: 'KickMembers',
      timeout: 'ModerateMembers',
    };

    const requiredPerm = permMap[actionType];
    if (requiredPerm && !hasPermission(interaction.member, requiredPerm)) {
      return interaction.reply({
        embeds: [errorEmbed('Permission Revoked', `You no longer hold the required permission: \`${requiredPerm}\`.`)],
        ephemeral: true,
      });
    }

    // Execute verified destructive action
    const guild = interaction.guild;
    const botMember = guild.members.me;

    if (actionType === 'ban') {
      const targetMember = await guild.members.fetch(targetId).catch(() => null);
      if (targetMember) {
        const hierarchy = checkHierarchy(interaction.member, targetMember, botMember);
        if (!hierarchy.canAct) {
          return interaction.update({ embeds: [errorEmbed('Hierarchy Violation', hierarchy.reason)], components: [] });
        }
      }

      await guild.bans.create(targetId, { reason: `Executed via Solas panel by ${interaction.user.tag}` });
      moderationRepo.logAction(guild.id, targetId, interaction.user.id, 'BAN', 'Confirmed via panel');
      loggingService.logModAction(guild, 'BAN', interaction.user, { id: targetId }, 'Confirmed via moderation panel');

      return interaction.update({
        embeds: [successEmbed('Member Banned', `Successfully banned user <@${targetId}> from the server.`)],
        components: [],
      });
    }

    if (actionType === 'kick') {
      const targetMember = await guild.members.fetch(targetId).catch(() => null);
      if (!targetMember) {
        return interaction.update({ embeds: [errorEmbed('Target Not Found', 'Target user is no longer in this server.')], components: [] });
      }

      const hierarchy = checkHierarchy(interaction.member, targetMember, botMember);
      if (!hierarchy.canAct) {
        return interaction.update({ embeds: [errorEmbed('Hierarchy Violation', hierarchy.reason)], components: [] });
      }

      await targetMember.kick(`Executed via Solas panel by ${interaction.user.tag}`);
      moderationRepo.logAction(guild.id, targetId, interaction.user.id, 'KICK', 'Confirmed via panel');
      loggingService.logModAction(guild, 'KICK', interaction.user, targetMember.user, 'Confirmed via moderation panel');

      return interaction.update({
        embeds: [successEmbed('Member Kicked', `Successfully kicked <@${targetId}> from the server.`)],
        components: [],
      });
    }
  }

  // 3. Ticket Panel Controls
  if (customId === 'ticket_create') {
    const guild = interaction.guild;
    const cfg = ticketsRepo.getConfig(guild.id);

    // Rate limit / duplicate check: see if user has an active open ticket
    const openTicket = guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase().slice(0, 10)}`);
    if (openTicket) {
      return interaction.reply({
        embeds: [warningEmbed('Existing Ticket', `You already have an active ticket channel: <#${openTicket.id}>.`)],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const ticketNumber = ticketsRepo.incrementCounter(guild.id);
    const channelName = `ticket-${String(ticketNumber).padStart(4, '0')}`;

    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: guild.members.me.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
    ];

    if (cfg.staff_role_id) {
      permissionOverwrites.push({
        id: cfg.staff_role_id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      });
    }

    try {
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: cfg.category_id || undefined,
        permissionOverwrites,
      });

      const ticketRecord = ticketsRepo.createTicket(guild.id, channel.id, interaction.user.id);

      const controlRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim Ticket').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ticket_close_prompt').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
      );

      const welcomeEmbed = infoEmbed(
        `Ticket #${ticketNumber}`,
        `Welcome <@${interaction.user.id}>. Staff has been notified and will assist shortly.\n\nUse the buttons below to manage this ticket session.`
      );

      await channel.send({ content: `<@${interaction.user.id}>`, embeds: [welcomeEmbed], components: [controlRow] });

      loggingService.logTicketEvent(guild, 'Created', ticketRecord, interaction.user);

      return interaction.editReply({
        embeds: [successEmbed('Ticket Created', `Your private channel has been opened: <#${channel.id}>.`)],
      });
    } catch (err) {
      logger.error(`Failed to create ticket channel: ${err.message}`);
      return interaction.editReply({
        embeds: [errorEmbed('Creation Failed', `Could not create ticket channel: ${err.message}`)],
      });
    }
  }

  if (customId === 'ticket_claim') {
    const ticket = ticketsRepo.getTicketByChannel(interaction.channel.id);
    if (!ticket) {
      return interaction.reply({ embeds: [errorEmbed('Invalid Channel', 'This channel is not an active ticket.')], ephemeral: true });
    }

    const cfg = ticketsRepo.getConfig(interaction.guild.id);
    const isStaff = (cfg.staff_role_id && interaction.member.roles.cache.has(cfg.staff_role_id))
      || hasPermission(interaction.member, 'ManageChannels');

    if (!isStaff) {
      return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only designated support staff may claim tickets.')], ephemeral: true });
    }

    ticketsRepo.claimTicket(ticket.id, interaction.user.id);
    loggingService.logTicketEvent(interaction.guild, 'Claimed', ticket, interaction.user);

    return interaction.reply({
      embeds: [successEmbed('Ticket Claimed', `<@${interaction.user.id}> has taken ownership of this ticket.`)],
    });
  }

  if (customId === 'ticket_close_prompt') {
    const ticket = ticketsRepo.getTicketByChannel(interaction.channel.id);
    if (!ticket) {
      return interaction.reply({ embeds: [errorEmbed('Invalid Channel', 'This channel is not an active ticket.')], ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Confirm Close').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
      embeds: [warningEmbed('Close Confirmation', 'Are you sure you want to close this ticket? An HTML transcript will be generated and archived.')],
      components: [row],
    });
  }

  if (customId === 'ticket_close_cancel') {
    return interaction.update({
      embeds: [infoEmbed('Cancelled', 'Ticket closure aborted.')],
      components: [],
    });
  }

  if (customId === 'ticket_close_confirm') {
    const ticket = ticketsRepo.getTicketByChannel(interaction.channel.id);
    if (!ticket) {
      return interaction.reply({ embeds: [errorEmbed('Invalid Channel', 'This channel is not an active ticket.')], ephemeral: true });
    }

    await interaction.update({
      embeds: [infoEmbed('Archiving Ticket', 'Exporting full conversation transcript and preparing channel deletion...')],
      components: [],
    });

    try {
      const result = await archiveAndCloseTicket({
        channel: interaction.channel,
        ticket,
        closedBy: interaction.user,
        reason: 'Closed via interaction button',
        guild: interaction.guild,
        client: interaction.client,
      });

      const statusNote = result.complete
        ? `Complete transcript saved (${result.totalFetched} messages).`
        : `Partial transcript saved (${result.totalFetched} messages fetched; note: ${result.failureReason}).`;

      await interaction.channel.send({
        embeds: [infoEmbed('Ticket Concluded', `${statusNote}\nChannel will be deleted in 3 seconds.`)],
      }).catch(() => {});

      // Safe channel deletion after 3 seconds
      setTimeout(async () => {
        await interaction.channel.delete('Ticket closed and archived').catch(() => {});
      }, 3000);
    } catch (err) {
      logger.error(`Failed to close ticket: ${err.message}`);
    }
  }

  // 4. Giveaway Entry Toggle
  if (customId.startsWith('giveaway_entry:')) {
    const giveawayId = parseInt(customId.split(':')[1], 10);
    const giveaway = giveawaysRepo.getGiveawayById(giveawayId);

    if (!giveaway || giveaway.ended) {
      return interaction.reply({
        embeds: [errorEmbed('Giveaway Concluded', 'This giveaway has already ended and entries are closed.')],
        ephemeral: true,
      });
    }

    const { entered, entryCount } = giveawaysRepo.toggleEntry(giveawayId, interaction.user.id);

    // Update message button counter
    try {
      const giveawayService = require('../services/giveawayService');
      const updatedEmbed = giveawayService.buildGiveawayEmbed(giveaway, entryCount);
      const updatedButton = giveawayService.buildGiveawayButton(giveawayId, entryCount, false);
      await interaction.message.edit({ embeds: [updatedEmbed], components: [updatedButton] }).catch(() => {});
    } catch (err) {
      logger.warn(`Could not update giveaway counter: ${err.message}`);
    }

    if (entered) {
      return interaction.reply({
        embeds: [successEmbed('Giveaway Entry Confirmed', `You have successfully entered the giveaway for **${giveaway.prize}**.\n\nClick again at any time to withdraw.`)],
        ephemeral: true,
      });
    } else {
      return interaction.reply({
        embeds: [infoEmbed('Entry Withdrawn', `You have withdrawn your entry for **${giveaway.prize}**.`)],
        ephemeral: true,
      });
    }
  }

  // 5. Reaction Roles Button Toggle (Format: rr:<panelId>:<roleId>)
  if (customId.startsWith('rr:')) {
    const parts = customId.split(':');
    const panelId = parts[1];
    const roleId = parts[2];

    const panel = reactionRolesRepo.getPanel(panelId);
    if (!panel) {
      return interaction.reply({ embeds: [errorEmbed('Unknown Panel', 'This role panel configuration no longer exists.')], ephemeral: true });
    }

    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) {
      return interaction.reply({ embeds: [errorEmbed('Role Not Found', 'The associated Discord role could not be located.')], ephemeral: true });
    }

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has('ManageRoles') || role.position >= botMember.roles.highest.position) {
      return interaction.reply({
        embeds: [errorEmbed('Hierarchy Restriction', 'The bot lacks permissions or role hierarchy to assign this role.')],
        ephemeral: true,
      });
    }

    const member = interaction.member;
    const hasRole = member.roles.cache.has(roleId);

    try {
      if (hasRole) {
        await member.roles.remove(roleId);
        return interaction.reply({ embeds: [infoEmbed('Role Removed', `Removed role **${role.name}** from your profile.`)], ephemeral: true });
      } else {
        // If single select mode, remove other panel roles first
        if (!panel.multi_select) {
          const items = reactionRolesRepo.getItems(panelId);
          for (const item of items) {
            if (item.role_id !== roleId && member.roles.cache.has(item.role_id)) {
              await member.roles.remove(item.role_id).catch(() => {});
            }
          }
        }

        await member.roles.add(roleId);
        return interaction.reply({ embeds: [successEmbed('Role Assigned', `Granted role **${role.name}** to your profile.`)], ephemeral: true });
      }
    } catch (err) {
      return interaction.reply({ embeds: [errorEmbed('Assignment Error', `Could not update role: ${err.message}`)], ephemeral: true });
    }
  }
}

module.exports = {
  handleButtonInteraction,
};

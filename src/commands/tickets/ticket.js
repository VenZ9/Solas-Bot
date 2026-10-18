const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionsBitField } = require('discord.js');
const { errorEmbed, successEmbed, infoEmbed } = require('../../utils/embeds');
const ticketsRepo = require('../../database/repositories/tickets');
const loggingService = require('../../services/loggingService');
const { generateTranscriptHtml, saveTranscript } = require('../../utils/transcript');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage ticket sessions, staff assignments, and ticket configurations')
    .addSubcommand(sub =>
      sub
        .setName('close')
        .setDescription('Close and archive the current ticket session')
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for closing the ticket').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('claim')
        .setDescription('Claim ownership of the current ticket as a staff member')
    )
    .addSubcommand(sub =>
      sub
        .setName('reopen')
        .setDescription('Reopen a previously closed ticket in this channel')
    )
    .addSubcommand(sub =>
      sub
        .setName('add-user')
        .setDescription('Add a user to the current ticket channel')
        .addUserOption(opt => opt.setName('user').setDescription('User to grant access to').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('remove-user')
        .setDescription('Remove a user from the current ticket channel')
        .addUserOption(opt => opt.setName('user').setDescription('User to revoke access from').setRequired(true))
    )
    .addSubcommandGroup(group =>
      group
        .setName('config')
        .setDescription('Configure ticket system parameters')
        .addSubcommand(sub =>
          sub
            .setName('category')
            .setDescription('Set the category where new tickets are created')
            .addChannelOption(opt => opt.setName('category').setDescription('Target category').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('staff-role')
            .setDescription('Designate the staff role authorized to handle tickets')
            .addRoleOption(opt => opt.setName('role').setDescription('Designated support role').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('log-channel')
            .setDescription('Set channel where closed ticket transcripts are dispatched')
            .addChannelOption(opt => opt.setName('channel').setDescription('Logs channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
        )
    ),

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const cfg = ticketsRepo.getConfig(guild.id);

    // Config subcommands require ManageGuild
    if (group === 'config') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Configuring the ticket system requires `ManageGuild` permission.')], ephemeral: true });
      }

      if (subcommand === 'category') {
        const cat = interaction.options.getChannel('category');
        ticketsRepo.updateConfig(guild.id, { categoryId: cat.id });
        loggingService.logConfigChange(guild, interaction.user, 'ticket_category', 'updated', cat.name);
        return interaction.reply({ embeds: [successEmbed('Ticket Category Set', `New tickets will be organized under **${cat.name}**.`)], ephemeral: true });
      }

      if (subcommand === 'staff-role') {
        const role = interaction.options.getRole('role');
        ticketsRepo.updateConfig(guild.id, { staffRoleId: role.id });
        loggingService.logConfigChange(guild, interaction.user, 'ticket_staff_role', 'updated', role.name);
        return interaction.reply({ embeds: [successEmbed('Staff Role Configured', `Staff role set to <@&${role.id}>.`)], ephemeral: true });
      }

      if (subcommand === 'log-channel') {
        const chan = interaction.options.getChannel('channel');
        ticketsRepo.updateConfig(guild.id, { logChannelId: chan.id });
        loggingService.logConfigChange(guild, interaction.user, 'ticket_log_channel', 'updated', chan.name);
        return interaction.reply({ embeds: [successEmbed('Transcript Channel Set', `Ticket transcripts will be routed to <#${chan.id}>.`)], ephemeral: true });
      }
    }

    // Channel-bound ticket operations
    const ticket = ticketsRepo.getTicketByChannel(interaction.channel.id);
    if (!ticket) {
      return interaction.reply({
        embeds: [errorEmbed('Invalid Channel', 'This command can only be executed inside an active ticket channel.')],
        ephemeral: true,
      });
    }

    const isStaff = (cfg.staff_role_id && interaction.member.roles.cache.has(cfg.staff_role_id))
      || interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
      || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (subcommand === 'claim') {
      if (!isStaff) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only designated support staff may claim tickets.')], ephemeral: true });
      }

      ticketsRepo.claimTicket(ticket.id, interaction.user.id);
      loggingService.logTicketEvent(guild, 'Claimed', ticket, interaction.user);

      return interaction.reply({
        embeds: [successEmbed('Ticket Claimed', `<@${interaction.user.id}> has claimed ownership of this ticket.`)],
      });
    }

    if (subcommand === 'reopen') {
      if (!isStaff) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only support staff may reopen closed tickets.')], ephemeral: true });
      }

      ticketsRepo.reopenTicket(ticket.id);
      loggingService.logTicketEvent(guild, 'Reopened', ticket, interaction.user);

      return interaction.reply({
        embeds: [successEmbed('Ticket Reopened', 'This ticket session has been restored to active status.')],
      });
    }

    if (subcommand === 'add-user') {
      if (!isStaff) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only staff can manage ticket participants.')], ephemeral: true });
      }

      const targetUser = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(targetUser.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });

      return interaction.reply({
        embeds: [successEmbed('User Added', `Granted ticket access to <@${targetUser.id}>.`)],
      });
    }

    if (subcommand === 'remove-user') {
      if (!isStaff) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Only staff can manage ticket participants.')], ephemeral: true });
      }

      const targetUser = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.delete(targetUser.id);

      return interaction.reply({
        embeds: [successEmbed('User Removed', `Revoked ticket access for <@${targetUser.id}>.`)],
      });
    }

    if (subcommand === 'close') {
      const isCreator = interaction.user.id === ticket.creator_id;
      if (!isStaff && !isCreator) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'You do not have permission to close this ticket.')], ephemeral: true });
      }

      const reason = interaction.options.getString('reason') || 'Ticket resolved';

      await interaction.reply({
        embeds: [infoEmbed('Archiving Ticket', `Exporting HTML transcript and closing ticket #${ticket.ticket_number}...`)],
      });

      try {
        const fetched = await interaction.channel.messages.fetch({ limit: 100 });
        const messagesArray = Array.from(fetched.values()).reverse();
        const creator = await interaction.client.users.fetch(ticket.creator_id).catch(() => ({ tag: 'Unknown User' }));

        const html = generateTranscriptHtml({
          ticketNumber: ticket.ticket_number,
          guildName: guild.name,
          channelName: interaction.channel.name,
          creatorTag: creator.tag || creator.username,
          closedByTag: interaction.user.tag,
          closeReason: reason,
          messages: messagesArray,
        });

        const transcriptPath = saveTranscript(ticket.ticket_number, guild.id, html);
        ticketsRepo.closeTicket(ticket.id, interaction.user.id, reason);

        loggingService.logTicketEvent(guild, 'Closed', ticket, interaction.user, `Reason: ${reason}`);

        if (cfg.log_channel_id) {
          const logChan = await guild.channels.fetch(cfg.log_channel_id).catch(() => null);
          if (logChan && logChan.isTextBased()) {
            await logChan.send({
              content: `Transcript for Ticket #${ticket.ticket_number} (Creator: <@${ticket.creator_id}>)`,
              files: [transcriptPath],
            }).catch(() => {});
          }
        }

        setTimeout(async () => {
          await interaction.channel.delete(`Ticket #${ticket.ticket_number} closed by ${interaction.user.tag}`).catch(() => {});
        }, 3000);
      } catch (err) {
        return interaction.followUp({
          embeds: [errorEmbed('Closure Error', `Failed to archive ticket: ${err.message}`)],
          ephemeral: true,
        });
      }
    }
  },
};

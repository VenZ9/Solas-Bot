const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { errorEmbed, successEmbed, infoEmbed } = require('../../utils/embeds');
const giveawaysRepo = require('../../database/repositories/giveaways');
const giveawayService = require('../../services/giveawayService');
const { parseDuration } = require('../../utils/time');
const loggingService = require('../../services/loggingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create, manage, and schedule automated giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Launch a new scheduled giveaway with entry buttons')
        .addStringOption(opt => opt.setName('duration').setDescription('Giveaway duration (e.g. 10m, 1h, 1d)').setRequired(true))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners to select').setMinValue(1).setMaxValue(20).setRequired(true))
        .addStringOption(opt => opt.setName('prize').setDescription('Prize description').setRequired(true))
        .addChannelOption(opt => opt.setName('channel').setDescription('Target announcement channel (defaults to current)').addChannelTypes(ChannelType.GuildText).setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('end')
        .setDescription('Immediately conclude an active giveaway and pick winners')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('reroll')
        .setDescription('Select new winners from the giveaway entry pool')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
        .addIntegerOption(opt => opt.setName('count').setDescription('Number of new winners to draw').setMinValue(1).setMaxValue(20).setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('cancel')
        .setDescription('Cancel an active giveaway without picking winners')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all currently active giveaways in this server')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (subcommand === 'start') {
      const durationInput = interaction.options.getString('duration');
      const winnerCount = interaction.options.getInteger('winners');
      const prize = interaction.options.getString('prize');
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      const durationMs = parseDuration(durationInput);
      if (!durationMs || durationMs < 10000 || durationMs > 90 * 24 * 60 * 60 * 1000) {
        return interaction.reply({
          embeds: [errorEmbed('Invalid Duration', 'Duration must be between 10 seconds and 90 days (e.g. `30s`, `10m`, `1d`, `30d`).')],
          ephemeral: true,
        });
      }

      const endTime = Date.now() + durationMs;

      // Construct initial dummy giveaway record
      const tempEmbed = giveawayService.buildGiveawayEmbed({
        prize,
        winner_count: winnerCount,
        end_time: endTime,
        created_by: interaction.user.id,
        ended: 0,
      }, 0);

      const tempButton = giveawayService.buildGiveawayButton(0, 0, false);

      const msg = await targetChannel.send({
        embeds: [tempEmbed],
        components: [tempButton],
      });

      // Persist to database
      const giveaway = giveawaysRepo.createGiveaway({
        guildId: guild.id,
        channelId: targetChannel.id,
        messageId: msg.id,
        prize,
        winnerCount,
        endTime,
        createdBy: interaction.user.id,
      });

      // Update button with real giveaway ID
      const realButton = giveawayService.buildGiveawayButton(giveaway.id, 0, false);
      await msg.edit({ components: [realButton] });

      // Schedule deadline timer
      giveawayService.scheduleGiveaway(giveaway, interaction.client);
      loggingService.logConfigChange(guild, interaction.user, 'giveaway_start', prize, `Ends at ${new Date(endTime).toISOString()}`);

      return interaction.reply({
        embeds: [successEmbed('Giveaway Launched', `Giveaway for **${prize}** has been initiated in <#${targetChannel.id}>.`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'end') {
      const messageId = interaction.options.getString('message_id').trim();
      const giveaway = giveawaysRepo.getGiveawayByMessageId(messageId);

      if (!giveaway) {
        return interaction.reply({
          embeds: [errorEmbed('Not Found', `No giveaway found associated with message ID \`${messageId}\`.`)],
          ephemeral: true,
        });
      }

      if (giveaway.ended) {
        return interaction.reply({
          embeds: [errorEmbed('Already Ended', 'This giveaway has already concluded.')],
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });
      await giveawayService.resolveGiveaway(giveaway.id, interaction.client);

      return interaction.editReply({
        embeds: [successEmbed('Giveaway Ended', `Giveaway for **${giveaway.prize}** has been finalized and winners announced.`)],
      });
    }

    if (subcommand === 'reroll') {
      const messageId = interaction.options.getString('message_id').trim();
      const count = interaction.options.getInteger('count') || 1;
      const giveaway = giveawaysRepo.getGiveawayByMessageId(messageId);

      if (!giveaway) {
        return interaction.reply({
          embeds: [errorEmbed('Not Found', `No giveaway found with message ID \`${messageId}\`.`)],
          ephemeral: true,
        });
      }

      if (!giveaway.ended) {
        return interaction.reply({
          embeds: [errorEmbed('Giveaway In Progress', 'You cannot reroll an active giveaway. Use `/giveaway end` first.')],
          ephemeral: true,
        });
      }

      const newWinners = giveawaysRepo.rerollGiveaway(giveaway.id, count);
      if (newWinners.length === 0) {
        return interaction.reply({
          embeds: [errorEmbed('Reroll Failed', 'No eligible entries available to draw winners from.')],
          ephemeral: true,
        });
      }

      const winnerPings = newWinners.map(id => `<@${id}>`).join(' ');
      const channel = await guild.channels.fetch(giveaway.channel_id).catch(() => null);

      if (channel) {
        const announceEmbed = successEmbed(
          'Giveaway Reroll Result',
          `Prize: **${giveaway.prize}**\nNew Winner(s): ${winnerPings}`
        );
        await channel.send({ content: winnerPings, embeds: [announceEmbed] });
      }

      return interaction.reply({
        embeds: [successEmbed('Reroll Complete', `Drawn new winners: ${winnerPings}`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'cancel') {
      const messageId = interaction.options.getString('message_id').trim();
      const giveaway = giveawaysRepo.getGiveawayByMessageId(messageId);

      if (!giveaway) {
        return interaction.reply({ embeds: [errorEmbed('Not Found', 'Giveaway record not found.')], ephemeral: true });
      }

      giveawayService.cancelGiveaway(giveaway.id);

      try {
        const channel = await guild.channels.fetch(giveaway.channel_id).catch(() => null);
        if (channel) {
          const msg = await channel.messages.fetch(giveaway.message_id).catch(() => null);
          if (msg) {
            const embed = infoEmbed('Giveaway Cancelled', `This giveaway for **${giveaway.prize}** has been cancelled by staff.`);
            await msg.edit({ embeds: [embed], components: [] });
          }
        }
      } catch (err) {
        // Continue
      }

      return interaction.reply({
        embeds: [successEmbed('Giveaway Cancelled', `Successfully cancelled giveaway for **${giveaway.prize}**.`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'list') {
      const active = giveawaysRepo.getActiveGiveaways(guild.id);

      if (active.length === 0) {
        return interaction.reply({
          embeds: [infoEmbed('Active Giveaways', 'There are no active giveaways running in this server.')],
          ephemeral: true,
        });
      }

      const lines = active.map(g => {
        const unix = Math.floor(g.end_time / 1000);
        return `• **${g.prize}** (<#${g.channel_id}>)\n  Ends: <t:${unix}:R> | Winners: ${g.winner_count} | ID: \`${g.message_id}\``;
      }).join('\n\n');

      return interaction.reply({
        embeds: [infoEmbed('Active Server Giveaways', lines)],
        ephemeral: true,
      });
    }
  },
};

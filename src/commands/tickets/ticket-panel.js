const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { panelEmbed } = require('../../utils/embeds');
const ticketsRepo = require('../../database/repositories/tickets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Publish an interactive support ticket creation panel')
    .addStringOption(opt => opt.setName('title').setDescription('Panel title').setRequired(false))
    .addStringOption(opt => opt.setName('description').setDescription('Panel description instructions').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const title = interaction.options.getString('title') || 'Support & Assistance';
    const description = interaction.options.getString('description') ||
      'Need help or have an inquiry? Click the button below to initiate a private support ticket with our server staff team.';

    const embed = panelEmbed(title, description);
    embed.addGlassField('Staff Availability', 'Tickets are monitored by authorized server moderators.', false);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_create')
        .setLabel('Open Ticket')
        .setStyle(ButtonStyle.Primary)
    );

    const msg = await interaction.channel.send({
      embeds: [embed],
      components: [row],
    });

    ticketsRepo.updateConfig(interaction.guild.id, { panelMessageId: msg.id });

    return interaction.reply({
      content: 'Ticket panel published successfully.',
      ephemeral: true,
    });
  },
};

const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const crypto = require('crypto');
const { errorEmbed, successEmbed, panelEmbed } = require('../../utils/embeds');
const reactionRolesRepo = require('../../database/repositories/reactionRoles');
const { canManageRole } = require('../../utils/permissions');
const loggingService = require('../../services/loggingService');

function getButtonStyle(styleName) {
  switch ((styleName || '').toLowerCase()) {
    case 'primary': return ButtonStyle.Primary;
    case 'success': return ButtonStyle.Success;
    case 'danger': return ButtonStyle.Danger;
    default: return ButtonStyle.Secondary;
  }
}

function buildPanelComponents(panelId, items) {
  if (items.length === 0) return [];

  const rows = [];
  let currentRow = new ActionRowBuilder();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`rr:${panelId}:${item.role_id}`)
        .setLabel(item.label)
        .setStyle(getButtonStyle(item.style))
    );

    if (currentRow.components.length === 5 || i === items.length - 1) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
  }

  return rows;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reaction-roles')
    .setDescription('Create and manage button-driven role assignment panels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create and deploy a new role assignment button panel')
        .addStringOption(opt => opt.setName('title').setDescription('Panel title').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Panel instructions').setRequired(false))
        .addBooleanOption(opt => opt.setName('multi_select').setDescription('Allow members to pick multiple roles simultaneously (default: true)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('add-role')
        .setDescription('Add a role button to an existing panel')
        .addStringOption(opt => opt.setName('panel_id').setDescription('Panel ID').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to assign').setRequired(true))
        .addStringOption(opt => opt.setName('label').setDescription('Button text label (zero emojis)').setRequired(true))
        .addStringOption(opt =>
          opt.setName('style')
            .setDescription('Button visual style')
            .setRequired(false)
            .addChoices(
              { name: 'Secondary (Slate Glass)', value: 'Secondary' },
              { name: 'Primary (Electric Violet)', value: 'Primary' },
              { name: 'Success (Emerald)', value: 'Success' },
              { name: 'Danger (Crimson)', value: 'Danger' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove-role')
        .setDescription('Remove a role button from an existing panel')
        .addStringOption(opt => opt.setName('panel_id').setDescription('Panel ID').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to remove from panel').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Permanently delete a role panel')
        .addStringOption(opt => opt.setName('panel_id').setDescription('Panel ID to delete').setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (subcommand === 'create') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description') || 'Select the buttons below to toggle your server roles.';
      const multiSelect = interaction.options.getBoolean('multi_select') ?? true;

      const embed = panelEmbed(title, description);
      embed.addGlassField('Selection Mode', multiSelect ? 'Multi-Role Toggle' : 'Single Exclusive Role', true);

      // Post initial message
      const msg = await interaction.channel.send({ embeds: [embed] });
      reactionRolesRepo.createPanel(msg.id, guild.id, interaction.channel.id, title, description, multiSelect);

      loggingService.logConfigChange(guild, interaction.user, 'reaction_roles_panel', 'created', msg.id);

      return interaction.reply({
        embeds: [successEmbed('Panel Created', `Role panel created successfully in <#${interaction.channel.id}>.\n\nPanel ID: \`${msg.id}\`\nUse \`/reaction-roles add-role\` with this ID to attach role buttons.`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'add-role') {
      const panelId = interaction.options.getString('panel_id').trim();
      const role = interaction.options.getRole('role');
      const label = interaction.options.getString('label');
      const style = interaction.options.getString('style') || 'Secondary';

      const panel = reactionRolesRepo.getPanel(panelId);
      if (!panel) {
        return interaction.reply({
          embeds: [errorEmbed('Panel Not Found', `No panel with ID \`${panelId}\` exists in the database.`)],
          ephemeral: true,
        });
      }

      // Hierarchy validation
      const check = canManageRole(interaction.member, guild.members.me, role);
      if (!check.canAct) {
        return interaction.reply({ embeds: [errorEmbed('Hierarchy Restriction', check.reason)], ephemeral: true });
      }

      const existingItems = reactionRolesRepo.getItems(panelId);
      if (existingItems.length >= 25) {
        return interaction.reply({
          embeds: [errorEmbed('Limit Reached', 'A single panel cannot contain more than 25 role buttons.')],
          ephemeral: true,
        });
      }

      reactionRolesRepo.addItem(panelId, role.id, label, style);
      const updatedItems = reactionRolesRepo.getItems(panelId);

      // Update message on Discord
      try {
        const channel = await guild.channels.fetch(panel.channel_id).catch(() => null);
        if (channel) {
          const msg = await channel.messages.fetch(panelId).catch(() => null);
          if (msg) {
            const rows = buildPanelComponents(panelId, updatedItems);
            await msg.edit({ components: rows });
          }
        }
      } catch (err) {
        return interaction.reply({
          embeds: [errorEmbed('Update Error', `Database was updated, but Discord message could not be edited: ${err.message}`)],
          ephemeral: true,
        });
      }

      return interaction.reply({
        embeds: [successEmbed('Role Button Attached', `Added role **${role.name}** to panel \`${panelId}\` with label "${label}".`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'remove-role') {
      const panelId = interaction.options.getString('panel_id').trim();
      const role = interaction.options.getRole('role');

      const panel = reactionRolesRepo.getPanel(panelId);
      if (!panel) {
        return interaction.reply({ embeds: [errorEmbed('Panel Not Found', 'Target panel does not exist.')], ephemeral: true });
      }

      reactionRolesRepo.removeItem(panelId, role.id);
      const updatedItems = reactionRolesRepo.getItems(panelId);

      try {
        const channel = await guild.channels.fetch(panel.channel_id).catch(() => null);
        if (channel) {
          const msg = await channel.messages.fetch(panelId).catch(() => null);
          if (msg) {
            const rows = buildPanelComponents(panelId, updatedItems);
            await msg.edit({ components: rows });
          }
        }
      } catch (err) {
        // Continue
      }

      return interaction.reply({
        embeds: [successEmbed('Role Button Removed', `Removed role **${role.name}** from panel \`${panelId}\`.`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'delete') {
      const panelId = interaction.options.getString('panel_id').trim();
      const panel = reactionRolesRepo.getPanel(panelId);

      if (!panel) {
        return interaction.reply({ embeds: [errorEmbed('Panel Not Found', 'Target panel does not exist.')], ephemeral: true });
      }

      try {
        const channel = await guild.channels.fetch(panel.channel_id).catch(() => null);
        if (channel) {
          const msg = await channel.messages.fetch(panelId).catch(() => null);
          if (msg) await msg.delete().catch(() => {});
        }
      } catch (err) {
        // Continue
      }

      reactionRolesRepo.deletePanel(panelId);

      return interaction.reply({
        embeds: [successEmbed('Panel Deleted', `Permanently deleted role panel \`${panelId}\`.`)],
        ephemeral: true,
      });
    }
  },
};

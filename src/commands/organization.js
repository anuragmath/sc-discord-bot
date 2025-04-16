import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('organization')
        .setDescription('Get Star Citizen organization information')
        .addStringOption(option =>
            option.setName('sid')
                .setDescription('Organization sid')
                .setRequired(true)),

    async execute(interaction, apiHandler) {
        await interaction.deferReply();

        try {
            const sid = interaction.options.getString('sid');
            const response = await apiHandler.fetchData(`organization/${sid}`, {});

            // Handle API error response
            if (response.success === 0) {
                return await interaction.editReply({
                    content: '⚠️ API Error: Could not fetch organization data',
                    flags: 64
                });
            }


            // Handle successful response but missing data
            if (!response.data || Object.keys(response.data).length === 0) {
                return await interaction.editReply({
                    content: `❌ Organization "${sid}" not found`,
                    flags: 64
                });
            }

            const orgData = response.data; // The data object from the response

            // Icons and text processing
            const cleanText = (text) => text?.replace(/\t/g, '').replace(/\n+/g, '\n').trim() || null;
            const headline = cleanText(orgData.headline?.plaintext);
            const charter = cleanText(orgData.charter?.plaintext);
            const manifesto = cleanText(orgData.manifesto?.plaintext);
            const history = cleanText(orgData.history?.plaintext);

            // Create the 3x3 grid fields
            const gridFields = [
                // Row 1
                {
                    name: '🏷️ Archetype',
                    value: orgData.archetype || 'Unknown',
                    inline: true
                },
                {
                    name: '🎯 Primary Focus',
                    value: orgData.focus?.primary?.name || 'None',
                    inline: true
                },
                {
                    name: '🎯 Secondary Focus',
                    value: orgData.focus?.secondary?.name || 'None',
                    inline: true
                },

                // Row 2
                {
                    name: '⚔ Commitment',
                    value: orgData.commitment || 'Unknown',
                    inline: true
                },
                {
                    name: '🌍 Language',
                    value: orgData.lang || 'Unknown',
                    inline: true
                },
                {
                    name: '👥 Members',
                    value: orgData.members?.toLocaleString() || 'Unknown',
                    inline: true
                },

                // Row 3
                {
                    name: '📢 Recruitment',
                    value: orgData.recruiting ? 'Open ✅' : 'Closed ❌',
                    inline: true
                },
                {
                    name: '🎭 Roleplay',
                    value: orgData.roleplay ? 'Yes' : 'No',
                    inline: true
                },
                {
                    name: '🆔 SID',
                    value: orgData.sid || 'Unknown',
                    inline: true
                }
            ];

            // Build the embed
            const embed = {
                title: `${orgData.name}`,
                url: orgData.href,
                thumbnail: { url: orgData.logo },
                color: 0x0099ff,
                fields: []
            };

            // Add headline first if exists
            if (headline) {
                embed.fields.push({
                    name: '📢 Headline',
                    value: headline.length > 1024 ? headline.substring(0, 1021) + '...' : headline,
                    inline: false
                });
            }

            // Add the 3x3 grid
            embed.fields.push(...gridFields);

            // Add additional sections
            const addSection = (icon, title, content) => {
                if (!content) return;
                embed.fields.push({
                    name: `${icon} ${title}`,
                    value: content.length > 1024 ? content.substring(0, 1021) + '...' : content,
                    inline: false
                });
            };

            addSection('📜', 'Charter', charter);
            addSection('📃', 'Manifesto', manifesto);
            addSection('🕰️', 'History', history);

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {

            console.error('Organization command error:', error);
            await interaction.editReply({
                content: '⚠️ An unexpected error occurred while fetching organization data',
                flags: 64
            });
        }
    }
};
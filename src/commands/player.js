import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('player')
        .setDescription('Get Star Citizen player information')
        .addStringOption(option =>
            option.setName('handle')
                .setDescription('Player handle')
                .setRequired(true)),

    async execute(interaction, apiHandler) {
        await interaction.deferReply();

        try {
            const handle = interaction.options.getString('handle');
            const response = await apiHandler.fetchData(`user/${handle}`, {});

            // Handle API error response
            if (response.success === 0) {
                return await interaction.editReply({
                    content: '⚠️ API Error: Could not fetch player data',
                    flags: 64
                });
            }


            // Handle successful response but missing data
            if (!response.data || Object.keys(response.data).length === 0) {
                return await interaction.editReply({
                    content: `❌ Player "${handle}" not found`,
                    flags: 64
                });
            }

            const { data } = response;

            // Validate required profile data
            if (!data.profile) {
                return await interaction.editReply({
                    content: '⚠️ Invalid player data format from API',
                    flags: 64
                });
            }

            const embed = {
                title: `👤 Player Info: ${handle}`,
                fields: [
                    { name: 'Display Name', value: data.profile.display || 'Unknown', inline: true },
                    { name: 'Joined', value: new Date(data.profile.enlisted).toLocaleDateString(), inline: true },
                    { name: 'Badge', value: data.profile.badge, inline: true },
                    {
                        name: 'Organization',
                        value: data.organization?.name
                            ? `${data.organization.name}\nSid: ${data.organization.sid}\nRank: ${data.organization.rank || 'No rank'}`
                            : 'None',
                        inline: true
                    },
                ],
                thumbnail: { url: data.profile.image },
                color: 0x0099ff
            };

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {

            console.error('Player command error:', error);
            await interaction.editReply({
                content: '⚠️ An unexpected error occurred while fetching player data',
                flags: 64
            });
        }
    }
};
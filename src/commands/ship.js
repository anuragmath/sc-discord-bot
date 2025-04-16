import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ship')
        .setDescription('Get Star Citizen ship information')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Ship name')
                .setRequired(true)),
        // .addStringOption(option =>
        //     option.setName('class')
        //         .setDescription('Ship class')
        //         .setRequired(false)
        //         .addChoices(
        //             { name: 'Combat', value: 'combat' },
        //             { name: 'Transport', value: 'transport' },
        //             { name: 'Exploration', value: 'exploration' },
        //             { name: 'Industrial', value: 'industrial' },
        //             { name: 'Support', value: 'support' },
        //             { name: 'Competition', value: 'competition' },
        //             { name: 'Ground', value: 'ground' },
        //             { name: 'Multi', value: 'multi' },
        //         )
        // ),
        

    async execute(interaction, apiHandler) {
        await interaction.deferReply();

        try {
            const shipName = interaction.options.getString('name');
            const response = await apiHandler.fetchData(`ships`, { name: shipName });

            // Handle API error response
            if (response.success === 0) {
                return await interaction.editReply({
                    content: '⚠️ API Error: Could not fetch ship data',
                    flags: 64
                });
            }


            // Handle successful response but missing data
            if (!response.data || Object.keys(response.data).length === 0) {
                return await interaction.editReply({
                    content: `❌ Ship "${shipName}" not found`,
                    flags: 64
                });
            }

            // Helper function to format numbers and handle nulls
            const formatValue = (value, unit = '') => {
                if (!value || value === 'null') return 'Unknown';
                return unit ? `${value}${unit}` : value;
            };

            // Helper function to format components
            const formatComponents = (components, typeFilter) => {
                const filtered = components.filter(c => c.type === typeFilter);
                if (filtered.length === 0) return 'None';
                return filtered.map(c => `S${c.size} x${c.quantity}`).join('\n');
            };

            // Helper to format weapon systems
            const formatWeapons = (weaponData) => {
                let output = [];
                const types = {
                    missiles: '🚀 Missiles',
                    weapons: '🔫 Weapons',
                    turrets: '🎯 Turrets'
                };

                for (const [type, label] of Object.entries(types)) {
                    const weapons = weaponData[type] || [];
                    if (weapons.length > 0) {
                        output.push(`**${label}**\n${weapons.map(w => `S${w.size} x${w.quantity}`).join('\n')}`);
                    }
                }

                return output.join('\n\n') || 'None';
            };


            // Process all ships in the array
            const embeds = response.data.slice(0, 10).map((shipData, index) => { // Discord allows max 10 embeds

                const imageUrl = shipData.media?.[0]?.source_url;
                const components = shipData.compiled;

                return new EmbedBuilder()
                    .setTitle(`🚀 ${shipData.name} ${index + 1}/${response.data.length}`)
                    .setURL(`https://robertsspaceindustries.com${shipData.url}`)
                    .setColor(0x0099ff)
                    .setImage(imageUrl)
                    .setThumbnail(`https://robertsspaceindustries.com${shipData.manufacturer.media?.[0]?.source_url}` || 'https://placehold.co/400')
                    .addFields(
                        {
                            name: '🏭 Manufacturer',
                            value: shipData.manufacturer?.name || 'Unknown Manufacturer',
                            inline: true
                        },
                        {
                            name: '👥 Crew',
                            value: `Min: ${shipData.min_crew}\nMax: ${shipData.max_crew}`,
                            inline: true
                        },
                        {
                            name: '📦 Cargo Capacity',
                            value: formatValue(shipData.cargocapacity, ' SCU'),
                            inline: true
                        },
                        {
                            name: '🚀 Speeds',
                            value: `SCM: ${formatValue(shipData.scm_speed, 'm/s')}\nAB: ${formatValue(shipData.afterburner_speed, 'm/s')}`,
                            inline: true
                        },
                        {
                            name: '📐 Size',
                            value: `🔻 ${shipData.size?.toUpperCase()}`,
                            inline: true
                        },
                        {
                            name: '🔧 Type',
                            value: `🎚️ ${shipData.type?.toUpperCase()}`,
                            inline: true
                        },
                        {
                            name: '🎯 Focus',
                            value: shipData.focus || 'General Purpose',
                            inline: true
                        },
                        {
                            name: '⚙ Core Components',
                            value: [
                                `**Coolers:** ${formatComponents(components.RSIModular?.coolers || [], 'coolers')}`,
                                `**Power Plants:** ${formatComponents(components.RSIModular?.power_plants || [], 'power_plants')}`,
                                `**Shields:** ${formatComponents(components.RSIModular?.shield_generators || [], 'shield_generators')}`,
                                `**Quantum Drive:** ${formatComponents(components.RSIPropulsion?.quantum_drives || [], 'quantum_drives')}`
                            ].join('\n'),
                            inline: true
                        },
                        {
                            name: '🔫 Weapon Systems',
                            value: formatWeapons(components.RSIWeapon || {}),
                            inline: false
                        },
                        {
                            name: '📝 Description',
                            value: shipData.description?.substring(0, 1024) || 'No description available',
                            inline: false
                        }
                    )
                    .setFooter({
                        text: `Status: ${shipData.production_status.replace('-', ' ').toUpperCase()}`
                    });
            });

            await interaction.editReply({
                content: `Found ${response.data.length} ships:`,
                embeds: embeds,
                ...(response.data.length > 10 && {
                    content: `Showing first 10 of ${response.data.length} ships:`
                })
            });
        } catch (error) {

            console.error('Ship command error:', error);
            await interaction.editReply({
                content: '⚠️ An unexpected error occurred while fetching ship info',
                flags: 64
            });
        }
    }
};
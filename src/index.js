import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import ApiHandler from './utils/apiHandler.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// Load commands
const commandsPath = path.join(process.cwd(), 'src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(filePath);
    client.commands.set(command.default.data.name, command.default);
}

const registerCommands = async () => {
	try {
	  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
	  const commands = [];
	  
	  // Load all commands
	  for (const file of commandFiles) {
		const command = await import(path.join(commandsPath, file));
		commands.push(command.default.data.toJSON());
	  }
  
	  console.log(`🔨 Registering ${commands.length} commands...`);
	  
	  await rest.put(
		Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
		{ body: commands }
	  );
  
	  console.log('✅ Successfully registered commands!');
	} catch (error) {
	  console.error('❌ Command registration failed:', error);
	}
  };

client.once('ready', async () => {
	await registerCommands();
    console.log(`🚀 ${client.user.tag} is ready!`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, ApiHandler);
    } catch (error) {
        console.error(`❌ Error executing ${command.data.name}:`, error);
        await interaction.reply({ 
            content: '⚠️ Error fetching Star Citizen data. Please try again later.', 
            ephemeral: true 
        });
    }
});

client.login(process.env.DISCORD_TOKEN);
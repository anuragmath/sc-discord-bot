import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import ApiHandler from './utils/apiHandler.js';
import mcpClient from './mcp/mcpClient.js';
import conversationalHandler from './handlers/conversationalHandler.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Need this for conversational messages
        GatewayIntentBits.DirectMessages
    ],
    partials: ['MESSAGE', 'CHANNEL'] // For DM support
});

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
    console.log(`🚀 ${client.user.tag} is ready!`);
    
    // Register slash commands
    await registerCommands();
    
    // Initialize MCP client
    try {
        await mcpClient.connect();
        console.log('✅ MCP server connected!');
    } catch (error) {
        console.error('❌ Failed to connect MCP server:', error);
        console.log('⚠️  Conversational features will be disabled');
    }
    
    // Set bot status
    client.user.setActivity('Star Citizen | @mention for help', { type: 'PLAYING' });
});

// Handle slash commands (existing functionality)
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

// Handle conversational messages (new functionality)
client.on('messageCreate', async message => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Check if bot is mentioned or it's a DM
    const isMentioned = message.mentions.has(client.user);
    const isDM = message.channel.type === 'DM';
    
    if (!isMentioned && !isDM) return;

    // Check if MCP is connected
    if (!mcpClient.connected) {
        await message.reply('⚠️ Conversational features are currently unavailable. Please use slash commands instead.');
        return;
    }

    // Show typing indicator
    await message.channel.sendTyping();

    try {
        // Remove bot mention from message content
        const cleanContent = message.content.replace(/<@!?\d+>/g, '').trim();
        
        // Create a modified message object with clean content
        const cleanMessage = {
            ...message,
            content: cleanContent,
            author: message.author
        };

        // Get response from conversational handler
        const response = await conversationalHandler.handleMessage(cleanMessage);

        // Split response if it's too long for Discord (2000 char limit)
        if (response.length > 2000) {
            const chunks = response.match(/.{1,2000}/g);
            for (const chunk of chunks) {
                await message.reply(chunk);
            }
        } else {
            await message.reply(response);
        }

    } catch (error) {
        console.error('❌ Conversational handler error:', error);
        await message.reply('⚠️ Sorry, I encountered an error. Please try again or use slash commands.');
    }
});

// Add help command for conversational interface
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    const content = message.content.toLowerCase();
    if ((message.mentions.has(client.user) || message.channel.type === 'DM') && 
        (content.includes('help') || content.includes('commands'))) {
        
        const helpMessage = `**Star Citizen Bot - Help**

**Conversational Commands** (mention me or DM):
• Ask about players: "What's the profile of player Dymerz?"
• Ship information: "Tell me about the Mustang Alpha"
• Compare ships: "Compare the Avenger Titan and the Cutlass Black"
• Organization info: "Show me org info for TEST"
• Search ships: "Find cargo ships with at least 100 SCU"

**Slash Commands**:
• \`/player <handle>\` - Get player information
• \`/ship <name>\` - Get ship details
• \`/organization <sid>\` - Get organization info

**Tips**:
• I remember our conversation, so you can ask follow-up questions!
• For complex queries, just describe what you're looking for
• DM me for private queries`;

        await message.reply(helpMessage);
    }
});

// Clear conversation history command
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    const content = message.content.toLowerCase();
    if ((message.mentions.has(client.user) || message.channel.type === 'DM') && 
        (content.includes('clear') || content.includes('reset'))) {
        
        conversationalHandler.clearHistory(message.author.id);
        await message.reply('✅ Conversation history cleared! Starting fresh.');
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    
    if (mcpClient.connected) {
        await mcpClient.close();
        console.log('✅ MCP client disconnected');
    }
    
    client.destroy();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
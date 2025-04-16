# Star Citizen API Discord Bot

A feature-rich Discord bot that fetches and displays Star Citizen player, organization, and ship data from the [Star Citizen API](https://starcitizen-api.com). Built with Node.js and Discord.js v14.

## Features

- 🚀 Slash command integration
- 👥 Player/organization profile lookup
- 🛠 Modular command system
- 🎨 Rich embed responses
- 🔄 API error handling
- ⚙ Easy configuration

## Setup Instructions

### Prerequisites
- Node.js v18+
- npm v9+
- Discord Developer Account
- [Star Citizen API Key](https://starcitizen-api.com)

### Installation
1. Clone repository
2. Install dependencies
```
npm install
```
3. Create .env file
```
DISCORD_TOKEN=your_bot_token
GUILD_ID=your_server_id
STARCITIZEN_API_KEY=your_api_key
STARCITIZEN_API_MODE=cache
```
4. Start bot
```
node src/index.js
```

### Bot Permissions
Required OAuth2 Scopes:
- applications.commands
- bot

Required Bot Permissions:
- Send Messages
- Embed Links
- Read Message History

Use the invite url to invite the bot to your channel

### Command Reference

| Command                | Description                          | Parameters               | Example                   |
|------------------------|--------------------------------------|--------------------------|---------------------------|
| `/player`              | Get player profile information       | `handle`: Player handle  | `/player JohnCitizen`     |
| `/ship`                | Show ship specifications and loadout | `name`: Ship name        | `/ship Mustang_Alpha`     |
| `/organization`        | Display organization details         | `name`: Organization tag | `/org SOME_ORG`           |


### Acknowledgments

 # Star Citizen API Team
 # Roberts Space Industries


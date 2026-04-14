import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

class MCPClient {
    constructor() {
        this.client = new Client({
            name: 'discord-bot-client',
            version: '1.0.0',
        });
        this.connected = false;
    }

    async connect() {
        try {
            // Create transport with command to spawn
            const serverPath = path.join(process.cwd(), 'src/mcp', 'mcpServer.js');
            const transport = new StdioClientTransport({
                command: 'node',
                args: [serverPath],
                env: {
                    ...process.env,
                    STARCITIZEN_API_KEY: process.env.STARCITIZEN_API_KEY,
                    STARCITIZEN_API_MODE: process.env.STARCITIZEN_API_MODE || 'cache'
                }
            });

            await this.client.connect(transport);
            this.connected = true;
            console.log('Connected to MCP server');

            // List available tools
            const tools = await this.client.listTools();
            console.log('Available tools:', tools.tools.map(t => t.name));

        } catch (error) {
            console.error('Failed to connect to MCP server:', error);
            throw error;
        }
    }

    async callTool(toolName, args) {
        if (!this.connected) {
            throw new Error('MCP client not connected');
        }

        try {
            const result = await this.client.callTool({
                name: toolName,
                arguments: args
            });

            // Parse the response
            if (result.content && result.content[0]) {
                try {
                    return JSON.parse(result.content[0].text);
                } catch {
                    return result.content[0].text;
                }
            }
            
            return null;
        } catch (error) {
            console.error(`Error calling tool ${toolName}:`, error);
            throw error;
        }
    }

    async close() {
        if (this.client) {
            await this.client.close();
            this.connected = false;
        }
    }
}

// Export a singleton instance
export default new MCPClient();
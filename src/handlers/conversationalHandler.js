import mcpClient from '../mcp/mcpClient.js';
import dotenv from 'dotenv';

dotenv.config();

// Simple prompt templates
const SYSTEM_PROMPT = `You are a helpful Star Citizen assistant integrated into Discord. You have access to tools that can fetch real-time game data including player profiles, ship specifications, and organization information. 

When users ask questions, determine if you need to use tools to get current data, or if you can answer from your knowledge. Be concise but informative in your responses.

Available tools:
- getPlayerInfo: Get player profile data
- getShipDetails: Get detailed ship specifications
- searchShips: Search ships by criteria
- getOrganizationInfo: Get organization details
- compareShips: Compare multiple ships

Format your responses in a Discord-friendly way.`;

// Simple LLM interface - you can swap this with any provider
class SimpleLLM {
    constructor() {
        // Choose your LLM provider here
        this.provider = process.env.LLM_PROVIDER || 'simple'; // Default to simple if not set
        this.apiKey = process.env.LLM_API_KEY;
        
        // Validate API key for providers that need it
        if ((this.provider === 'openai' || this.provider === 'groq') && !this.apiKey) {
            console.warn(`⚠️  No API key found for ${this.provider}. Falling back to simple pattern matching.`);
            this.provider = 'simple';
        }
    }

    async complete(messages) {
        try {
            // Validate messages
            if (!messages || messages.length === 0) {
                throw new Error('No messages provided');
            }

            // This is a simplified example - implement based on your chosen provider
            if (this.provider === 'openai') {
                return await this.openAIComplete(messages);
            } else if (this.provider === 'groq') {
                return await this.groqComplete(messages);
            } else {
                // Fallback to a simple pattern matching for testing
                return this.simpleComplete(messages);
            }
        } catch (error) {
            console.error(`LLM error (${this.provider}):`, error.message);
            
            // Fallback to simple pattern matching on error
            if (this.provider !== 'simple') {
                console.log('Falling back to simple pattern matching...');
                return this.simpleComplete(messages);
            }
            
            throw error;
        }
    }

    async openAIComplete(messages) {
        // Validate and clean messages
        const cleanMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content || '' // Ensure content is never null
        })).filter(msg => msg.content.trim() !== ''); // Remove empty messages

        if (cleanMessages.length === 0) {
            throw new Error('No valid messages to send to OpenAI');
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: cleanMessages,
                tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'callMCPTool',
                            description: 'Call an MCP tool to get Star Citizen data',
                            parameters: {
                                type: 'object',
                                properties: {
                                    tool: { 
                                        type: 'string', 
                                        enum: ['getPlayerInfo', 'getShipDetails', 'searchShips', 'getOrganizationInfo', 'compareShips'],
                                        description: 'The MCP tool to call'
                                    },
                                    args: { 
                                        type: 'object',
                                        description: 'Arguments for the tool'
                                    }
                                },
                                required: ['tool', 'args']
                            }
                        }
                    }
                ],
                tool_choice: 'auto',
                temperature: 0.7,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('OpenAI API error:', error);
            throw new Error(`OpenAI API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        
        if (!data.choices || data.choices.length === 0) {
            throw new Error('No response from OpenAI');
        }

        const choice = data.choices[0];
        
        // Handle tool calls
        if (choice.message.tool_calls) {
            return {
                message: { content: choice.message.content || 'Let me look that up for you...' },
                finish_reason: 'tool_calls',
                tool_calls: choice.message.tool_calls.map(tc => ({
                    function: {
                        name: tc.function.name,
                        arguments: tc.function.arguments
                    }
                }))
            };
        }
        
        // Regular response
        return {
            message: { content: choice.message.content || 'I couldn\'t generate a response.' },
            finish_reason: choice.finish_reason
        };
    }

    async groqComplete(messages) {
        // Implement Groq API call here
        // Similar structure but different endpoint
        throw new Error('Groq provider not implemented yet');
    }

    // Simple pattern matching for testing without LLM
    simpleComplete(messages) {
        const lastMessage = messages[messages.length - 1].content.toLowerCase();
        
        // Debug log
        console.log('🔍 Pattern matching for:', lastMessage);
        
        // Pattern matching for common queries
        if (lastMessage.includes('player') || lastMessage.includes('citizen')) {
            const patterns = [
                /(?:player|citizen)\s+(?:info|information|profile|stats)?\s*(?:for\s+)?(\w+)/i,
                /(?:tell me about|show me|get|find)\s+(?:player|citizen)\s+(\w+)/i,
                /(?:info|information|profile|stats)\s+(?:on|for|about)\s+(?:player|citizen)\s+(\w+)/i,
                /what'?s?\s+(\w+)'?s?\s+(?:profile|stats|info)/i,
                /(\w+)\s+player\s+(?:info|profile|stats)/i
            ];
            
            for (const pattern of patterns) {
                const match = lastMessage.match(pattern);
                if (match && match[1]) {
                    const handle = match[1];
                    console.log('👤 Detected player query for:', handle);
                    return {
                        message: { content: `I'll look up player ${handle} for you.` },
                        finish_reason: 'tool_calls',
                        tool_calls: [{
                            function: {
                                name: 'callMCPTool',
                                arguments: JSON.stringify({ tool: 'getPlayerInfo', args: { handle } })
                            }
                        }]
                    };
                }
            }
        }
        
        if (lastMessage.includes('ship') && !lastMessage.includes('compare')) {
            // Multiple patterns to match ship queries
            const patterns = [
                /(?:tell me about|show me|info on|information about|details on|what is the|what's the)\s+(?:the\s+)?([\w\s]+?)(?:\s+ship)?$/i,
                /ship\s+([\w\s]+?)(?:\s+info|information|details)?$/i,
                /(?:get|show)\s+ship\s+([\w\s]+)$/i,
                /([\w\s]+?)\s+ship\s+(?:info|details|specs)/i
            ];
            
            for (const pattern of patterns) {
                const shipMatch = lastMessage.match(pattern);
                if (shipMatch && shipMatch[1]) {
                    const shipName = shipMatch[1].trim();
                    console.log('🚀 Detected ship query for:', shipName);
                    return {
                        message: { content: `Looking up the ${shipName}...` },
                        finish_reason: 'tool_calls',
                        tool_calls: [{
                            function: {
                                name: 'callMCPTool',
                                arguments: JSON.stringify({ tool: 'getShipDetails', args: { name: shipName } })
                            }
                        }]
                    };
                }
            }
        }

        if (lastMessage.includes('compare')) {
            // More flexible pattern matching for ship comparisons
            const patterns = [
                /compare\s+([\w\s]+?)\s+(?:and|vs|versus|with)\s+([\w\s]+)/i,
                /compare\s+([\w\s]+?)\s+to\s+([\w\s]+)/i,
                /what'?s?\s+the\s+difference\s+between\s+([\w\s]+?)\s+and\s+([\w\s]+)/i,
                /([\w\s]+?)\s+vs\.?\s+([\w\s]+)/i
            ];
            
            for (const pattern of patterns) {
                const ships = lastMessage.match(pattern);
                if (ships && ships[1] && ships[2]) {
                    return {
                        message: { content: `Comparing ${ships[1].trim()} and ${ships[2].trim()}...` },
                        finish_reason: 'tool_calls',
                        tool_calls: [{
                            function: {
                                name: 'callMCPTool',
                                arguments: JSON.stringify({ 
                                    tool: 'compareShips', 
                                    args: { 
                                        shipNames: [ships[1].trim(), ships[2].trim()] 
                                    } 
                                })
                            }
                        }]
                    };
                }
            }
            
            // If no pattern matched but user wants to compare
            return {
                message: { content: 'To compare ships, please use format like: "compare Mustang Alpha and Aurora MR" or "Avenger vs Cutlass"' },
                finish_reason: 'stop'
            };
        }

        if (lastMessage.includes('search') || lastMessage.includes('find') || lastMessage.includes('cargo')) {
            // Search for cargo ships
            const cargoMatch = lastMessage.match(/(?:find|search|show me|list)\s+(?:cargo\s+)?ships?\s+with\s+(?:at least\s+)?(\d+)\s*(?:scu|cargo)/i);
            if (cargoMatch) {
                const minCargo = parseInt(cargoMatch[1]);
                console.log('📦 Searching for ships with cargo >=', minCargo);
                return {
                    message: { content: `Searching for ships with at least ${minCargo} SCU cargo capacity...` },
                    finish_reason: 'tool_calls',
                    tool_calls: [{
                        function: {
                            name: 'callMCPTool',
                            arguments: JSON.stringify({ tool: 'searchShips', args: { minCargo } })
                        }
                    }]
                };
            }
            
            // Search by manufacturer
            const manuMatch = lastMessage.match(/(?:find|search|show me|list)\s+(?:all\s+)?(\w+)\s+ships/i);
            if (manuMatch && !manuMatch[1].match(/cargo|fighter|mining/i)) {
                const manufacturer = manuMatch[1];
                console.log('🏭 Searching for ships by manufacturer:', manufacturer);
                return {
                    message: { content: `Searching for ${manufacturer} ships...` },
                    finish_reason: 'tool_calls',
                    tool_calls: [{
                        function: {
                            name: 'callMCPTool',
                            arguments: JSON.stringify({ tool: 'searchShips', args: { manufacturer } })
                        }
                    }]
                };
            }
        }

        if (lastMessage.includes('org') || lastMessage.includes('organization')) {
            const patterns = [
                /(?:org|organization)\s+(?:info|information|details)?\s*(?:for\s+)?(\w+)/i,
                /(?:tell me about|show me|get|find)\s+(?:org|organization)\s+(\w+)/i,
                /(?:info|information|details)\s+(?:on|for|about)\s+(?:org|organization)\s+(\w+)/i,
                /what'?s?\s+(\w+)\s+(?:org|organization)/i,
                /(\w+)\s+(?:org|organization)\s+(?:info|details)/i
            ];
            
            for (const pattern of patterns) {
                const match = lastMessage.match(pattern);
                if (match && match[1]) {
                    const sid = match[1].toUpperCase(); // Org SIDs are usually uppercase
                    console.log('🏢 Detected organization query for:', sid);
                    return {
                        message: { content: `Looking up organization ${sid}...` },
                        finish_reason: 'tool_calls',
                        tool_calls: [{
                            function: {
                                name: 'callMCPTool',
                                arguments: JSON.stringify({ tool: 'getOrganizationInfo', args: { sid } })
                            }
                        }]
                    };
                }
            }
        }

        // Default response
        return {
            message: { content: 'I can help you with Star Citizen information! Try asking about:\n- Player profiles (e.g., "player info Dymerz")\n- Ship details (e.g., "ship Mustang Alpha")\n- Ship comparisons (e.g., "compare Mustang vs Aurora")\n- Organizations (e.g., "org info TEST")' },
            finish_reason: 'stop'
        };
    }
}

class ConversationalHandler {
    constructor() {
        this.llm = new SimpleLLM();
        this.conversations = new Map(); // Store conversation history
    }

    async handleMessage(message) {
        const userId = message.author.id;
        const content = message.content || '';

        // Validate message content
        if (!content.trim()) {
            return '❓ Please send a message with your question!';
        }

        // Get or create conversation history
        if (!this.conversations.has(userId)) {
            this.conversations.set(userId, []);
        }
        const history = this.conversations.get(userId);

        // Add user message to history
        history.push({ role: 'user', content: content.trim() });

        // Keep only last 10 messages to save memory
        if (history.length > 10) {
            history.splice(0, history.length - 10);
        }

        try {
            // Prepare messages for LLM (ensure all have content)
            const messages = [
                { role: 'system', content: SYSTEM_PROMPT },
                ...history.filter(msg => msg.content && msg.content.trim())
            ];

            // Get LLM response
            const response = await this.llm.complete(messages);

            // Check if LLM wants to call tools
            if (response.finish_reason === 'tool_calls' && response.tool_calls) {
                const toolResults = [];

                for (const toolCall of response.tool_calls) {
                    try {
                        const { tool, args } = JSON.parse(toolCall.function.arguments);
                        const result = await mcpClient.callTool(tool, args);
                        toolResults.push({
                            tool,
                            result: JSON.stringify(result, null, 2)
                        });
                    } catch (error) {
                        toolResults.push({
                            tool: toolCall.function.name,
                            error: error.message
                        });
                    }
                }

                // Format tool results for display
                let formattedResponse = (response.message.content || '') + '\n\n';
                
                for (const result of toolResults) {
                    if (result.error) {
                        formattedResponse += `❌ Error: ${result.error}\n`;
                    } else {
                        // Parse and format the result nicely
                        try {
                            const data = JSON.parse(result.result);
                            formattedResponse += this.formatToolResult(result.tool, data);
                        } catch {
                            formattedResponse += `\`\`\`json\n${result.result}\n\`\`\``;
                        }
                    }
                }

                // Add assistant response to history (ensure it's not null)
                const assistantContent = formattedResponse || 'I processed your request.';
                history.push({ role: 'assistant', content: assistantContent });

                return assistantContent;
            } else {
                // No tool calls, just return the LLM response
                const responseContent = response.message.content || 'I couldn\'t process that request. Please try again.';
                history.push({ role: 'assistant', content: responseContent });
                return responseContent;
            }

        } catch (error) {
            console.error('Conversational handler error:', error);
            return '⚠️ Sorry, I encountered an error while processing your request. Please try again.';
        }
    }

    formatToolResult(tool, data) {
        switch (tool) {
            case 'getPlayerInfo':
                return `**Player: ${data.displayName}**
Handle: ${data.handle}
Enlisted: ${new Date(data.enlisted).toLocaleDateString()}
Badge: ${data.badge}
Organization: ${data.organization ? `${data.organization.name} (${data.organization.sid}) - ${data.organization.rank}` : 'None'}
Profile: ${data.profileUrl || 'N/A'}\n\n`;

            case 'getShipDetails':
                return `**Ship: ${data.name}**
Manufacturer: ${data.manufacturer}
Type: ${data.type} | Focus: ${data.focus}
Size: ${data.size}
Crew: ${data.crew.min}-${data.crew.max}
Cargo: ${data.cargo} SCU
Speed: ${data.speeds.scm} m/s (SCM) | ${data.speeds.afterburner} m/s (AB)
Price: ${data.price ? `$${data.price}` : 'N/A'}
Status: ${data.status}
Link: ${data.url}\n\n`;

            case 'searchShips':
                let result = '**Search Results:**\n';
                data.forEach(ship => {
                    result += `• **${ship.name}** - ${ship.manufacturer} | ${ship.type} | ${ship.crew} crew | ${ship.cargo} SCU | ${ship.status}\n`;
                });
                return result + '\n';

            case 'getOrganizationInfo':
                return `**Organization: ${data.name}**
SID: ${data.sid}
Type: ${data.archetype} | ${data.commitment}
Members: ${data.members}
Language: ${data.language}
Recruiting: ${data.recruiting ? '✅ Yes' : '❌ No'}
Focus: ${data.focus.primary}${data.focus.secondary ? ` / ${data.focus.secondary}` : ''}
${data.headline ? `\n${data.headline}\n` : ''}
Link: ${data.url}\n\n`;

            case 'compareShips':
                let comparison = '**Ship Comparison:**\n\n';
                data.comparison.forEach(ship => {
                    comparison += `**${ship.name}**
• Manufacturer: ${ship.manufacturer}
• Type: ${ship.type} | Focus: ${ship.focus}
• Crew: ${ship.crew} | Cargo: ${ship.cargo} SCU
• Speed: ${ship.speeds.scm}/${ship.speeds.afterburner} m/s
• Price: ${ship.price ? `$${ship.price}` : 'N/A'}\n\n`;
                });
                return comparison;

            default:
                return `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`;
        }
    }

    clearHistory(userId) {
        this.conversations.delete(userId);
    }
}

export default new ConversationalHandler();
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import ApiHandler from '../utils/apiHandler.js';

const server = new Server(
  {
    name: 'star-citizen-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = {
  player: 3600000,      // 1 hour
  organization: 3600000, // 1 hour  
  ship: 86400000,       // 24 hours
};

// Helper function for caching
async function getCachedOrFetch(key, ttlType, fetchFn) {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  
  const data = await fetchFn();
  cache.set(key, {
    data,
    expires: Date.now() + CACHE_TTL[ttlType]
  });
  
  return data;
}

// Tool definitions
const tools = [
  {
    name: 'getPlayerInfo',
    description: 'Get Star Citizen player profile information including organization and stats',
    inputSchema: {
      type: 'object',
      properties: {
        handle: {
          type: 'string',
          description: 'Player handle/username'
        }
      },
      required: ['handle']
    }
  },
  {
    name: 'getShipDetails',
    description: 'Get detailed specifications for a Star Citizen ship including components and weapons',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Ship name (e.g., "Mustang Alpha", "Avenger Titan")'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'searchShips',
    description: 'Search for Star Citizen ships by various criteria',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Ship name to search for'
        },
        manufacturer: {
          type: 'string',
          description: 'Filter by manufacturer'
        },
        minCrew: {
          type: 'number',
          description: 'Minimum crew requirement'
        },
        maxCrew: {
          type: 'number',
          description: 'Maximum crew requirement'
        },
        minCargo: {
          type: 'number',
          description: 'Minimum cargo capacity in SCU'
        },
        maxCargo: {
          type: 'number',
          description: 'Maximum cargo capacity in SCU'
        }
      }
    }
  },
  {
    name: 'getOrganizationInfo',
    description: 'Get Star Citizen organization details including members and focus',
    inputSchema: {
      type: 'object',
      properties: {
        sid: {
          type: 'string',
          description: 'Organization SID (Spectrum Identifier)'
        }
      },
      required: ['sid']
    }
  },
  {
    name: 'compareShips',
    description: 'Compare multiple Star Citizen ships side by side',
    inputSchema: {
      type: 'object',
      properties: {
        shipNames: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Array of ship names to compare'
        }
      },
      required: ['shipNames']
    }
  }
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'getPlayerInfo': {
        if (!args || !args.handle) {
          throw new Error('handle parameter is required for getPlayerInfo');
        }
        const { handle } = args;
        const cacheKey = `player:${handle}`;
        
        const data = await getCachedOrFetch(cacheKey, 'player', async () => {
          const response = await ApiHandler.fetchData(`user/${handle}`, {});
          
          if (response.success === 0 || !response.data) {
            throw new Error(`Player "${handle}" not found`);
          }
          
          return {
            handle: handle,
            displayName: response.data.profile?.display || 'Unknown',
            enlisted: response.data.profile?.enlisted,
            badge: response.data.profile?.badge,
            organization: response.data.organization ? {
              name: response.data.organization.name,
              sid: response.data.organization.sid,
              rank: response.data.organization.rank
            } : null,
            profileUrl: response.data.profile?.page?.url
          };
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      }

      case 'getShipDetails': {
        if (!args || !args.name) {
          throw new Error('name parameter is required for getShipDetails');
        }
        const { name } = args;
        const cacheKey = `ship:${name}`;
        
        const data = await getCachedOrFetch(cacheKey, 'ship', async () => {
          const response = await ApiHandler.fetchData('ships', { name });
          
          if (response.success === 0 || !response.data || response.data.length === 0) {
            throw new Error(`Ship "${name}" not found`);
          }
          
          // Return the first matching ship with essential details
          const ship = response.data[0];
          return {
            name: ship.name,
            manufacturer: ship.manufacturer?.name,
            type: ship.type,
            focus: ship.focus,
            crew: {
              min: ship.min_crew,
              max: ship.max_crew
            },
            cargo: ship.cargocapacity,
            size: ship.size,
            speeds: {
              scm: ship.scm_speed,
              afterburner: ship.afterburner_speed
            },
            price: ship.price,
            status: ship.production_status,
            description: ship.description,
            url: `https://robertsspaceindustries.com${ship.url}`
          };
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      }

      case 'searchShips': {
        const { name, manufacturer, minCrew, maxCrew, minCargo, maxCargo } = args;
        const cacheKey = `ships:search:${JSON.stringify(args)}`;
        
        const data = await getCachedOrFetch(cacheKey, 'ship', async () => {
          // First get ships by name if provided
          let params = {};
          if (name) params.name = name;
          
          const response = await ApiHandler.fetchData('ships', params);
          
          if (response.success === 0 || !response.data) {
            throw new Error('Failed to search ships');
          }
          
          // Filter results based on criteria
          let ships = response.data;
          
          if (manufacturer) {
            ships = ships.filter(s => 
              s.manufacturer?.name?.toLowerCase().includes(manufacturer.toLowerCase())
            );
          }
          
          if (minCrew !== undefined) {
            ships = ships.filter(s => parseInt(s.min_crew) >= minCrew);
          }
          
          if (maxCrew !== undefined) {
            ships = ships.filter(s => parseInt(s.max_crew) <= maxCrew);
          }
          
          if (minCargo !== undefined) {
            ships = ships.filter(s => parseInt(s.cargocapacity) >= minCargo);
          }
          
          if (maxCargo !== undefined) {
            ships = ships.filter(s => parseInt(s.cargocapacity) <= maxCargo);
          }
          
          // Return simplified ship list
          return ships.slice(0, 10).map(ship => ({
            name: ship.name,
            manufacturer: ship.manufacturer?.name,
            type: ship.type,
            focus: ship.focus,
            crew: `${ship.min_crew}-${ship.max_crew}`,
            cargo: ship.cargocapacity,
            price: ship.price,
            status: ship.production_status
          }));
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      }

      case 'getOrganizationInfo': {
        if (!args || !args.sid) {
          throw new Error('sid parameter is required for getOrganizationInfo');
        }
        const { sid } = args;
        const cacheKey = `org:${sid}`;
        
        const data = await getCachedOrFetch(cacheKey, 'organization', async () => {
          const response = await ApiHandler.fetchData(`organization/${sid}`, {});
          
          if (response.success === 0 || !response.data) {
            throw new Error(`Organization "${sid}" not found`);
          }
          
          const org = response.data;
          return {
            name: org.name,
            sid: org.sid,
            archetype: org.archetype,
            commitment: org.commitment,
            language: org.lang,
            members: org.members,
            recruiting: org.recruiting,
            roleplay: org.roleplay,
            focus: {
              primary: org.focus?.primary?.name,
              secondary: org.focus?.secondary?.name
            },
            headline: org.headline?.plaintext,
            url: org.href
          };
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      }

      case 'compareShips': {
        if (!args || !args.shipNames) {
          throw new Error('shipNames parameter is required for compareShips');
        }
        const { shipNames } = args;
        
        if (!shipNames || shipNames.length < 2) {
          throw new Error('Please provide at least 2 ship names to compare');
        }
        
        const ships = await Promise.all(
          shipNames.map(async (shipName) => {
            const cacheKey = `ship:${shipName}`;
            try {
              return await getCachedOrFetch(cacheKey, 'ship', async () => {
                const response = await ApiHandler.fetchData('ships', { name: shipName });
                
                if (response.success === 0 || !response.data || response.data.length === 0) {
                  return null;
                }
                
                const ship = response.data[0];
                return {
                  name: ship.name,
                  manufacturer: ship.manufacturer?.name,
                  type: ship.type,
                  focus: ship.focus,
                  crew: `${ship.min_crew}-${ship.max_crew}`,
                  cargo: ship.cargocapacity,
                  speeds: {
                    scm: ship.scm_speed,
                    afterburner: ship.afterburner_speed
                  },
                  size: ship.size,
                  price: ship.price,
                  status: ship.production_status
                };
              });
            } catch {
              return null;
            }
          })
        );
        
        // Filter out ships that weren't found
        const validShips = ships.filter(s => s !== null);
        
        if (validShips.length === 0) {
          throw new Error('No ships found for comparison');
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                comparison: validShips,
                count: validShips.length
              }, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Star Citizen MCP server running...');
}

main().catch(console.error);
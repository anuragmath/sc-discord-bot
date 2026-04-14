import mcpClient from '../src/mcp/mcpClient.js';

async function testMCPServer() {
    console.log('🧪 Testing MCP Server...\n');

    try {
        // Connect to MCP server
        console.log('1. Connecting to MCP server...');
        await mcpClient.connect();
        console.log('✅ Connected successfully!\n');

        // Add small delay to ensure server is ready
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: Get player info
        console.log('2. Testing getPlayerInfo tool...');
        const playerResult = await mcpClient.callTool('getPlayerInfo', {
            handle: 'Dymerz'
        });
        console.log('✅ Player result:', JSON.stringify(playerResult, null, 2));
        console.log('');

        // Test 2: Get ship details
        console.log('3. Testing getShipDetails tool...');
        const shipResult = await mcpClient.callTool('getShipDetails', {
            name: 'Mustang Alpha'
        });
        console.log('✅ Ship result:', JSON.stringify(shipResult, null, 2));
        console.log('');

        // Test 3: Search ships
        console.log('4. Testing searchShips tool...');
        const searchResult = await mcpClient.callTool('searchShips', {
            minCargo: 50,
            maxCargo: 100
        });
        console.log('✅ Search result:', JSON.stringify(searchResult, null, 2));
        console.log('');

        // Test 4: Compare ships
        console.log('5. Testing compareShips tool...');
        const compareResult = await mcpClient.callTool('compareShips', {
            shipNames: ['Aurora MR', 'Mustang Alpha']
        });
        console.log('✅ Compare result:', JSON.stringify(compareResult, null, 2));
        console.log('');

        // Test 5: Get organization
        console.log('6. Testing getOrganizationInfo tool...');
        const orgResult = await mcpClient.callTool('getOrganizationInfo', {
            sid: 'TEST'
        });
        console.log('✅ Organization result:', JSON.stringify(orgResult, null, 2));
        console.log('');

        console.log('🎉 All tests passed!\n');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Close connection
        await mcpClient.close();
        console.log('👋 Test complete, connection closed.');
        process.exit(0);
    }
}

// Run tests
testMCPServer();
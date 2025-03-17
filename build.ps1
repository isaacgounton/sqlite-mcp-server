# Build the TypeScript project
npm run build

# If a database path is provided as an argument, update the MCP settings
if ($args.Count -gt 0) {
    $dbPath = $args[0]
    Write-Host "Updating MCP settings with database path: $dbPath"
    
    $settingsPath = "$env:APPDATA/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"
    $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
    
    $settings.mcpServers.'github.com/modelcontextprotocol/servers/tree/main/src/sqlite'.env = @{
        DB_PATH = $dbPath
    }
    
    $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath
}

Write-Host "Build complete!"

// Note: PM2 requires CommonJS for config files, so we use .cjs extension
module.exports = {
    apps: [
      {
        name: 'sc-discord-bot',
        script: './src/index.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '600M',
        interpreter_args: '--experimental-specifier-resolution=node',
        env: {
          NODE_ENV: 'production'
        },
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_file: './logs/combined.log',
        time: true,
        // Add delay between restarts
        restart_delay: 4000,
        // Kill timeout
        kill_timeout: 5000
      }
    ]
  };
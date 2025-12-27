// PM2 설정 파일
// 사용법: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'inner-dev',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/inner-dev', // EC2에서의 프로젝트 경로로 변경
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G',
    },
  ],
};


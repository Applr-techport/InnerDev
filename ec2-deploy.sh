#!/bin/bash

# EC2 배포 스크립트
# 이 스크립트는 EC2에서 직접 실행하거나 GitHub Actions에서 호출할 수 있습니다.

set -e

echo "🚀 배포 시작..."

# 프로젝트 디렉토리로 이동
cd /var/www/inner-dev || cd ~/inner-dev || cd /home/ubuntu/inner-dev

# Git pull
echo "📥 Git pull 중..."
git fetch origin
git reset --hard origin/main
git pull origin main

# Dependencies 설치
echo "📦 Dependencies 설치 중..."
npm install

# Build
echo "🔨 Build 중..."
npm run build

# PM2로 재시작 (PM2 사용 시)
if command -v pm2 &> /dev/null; then
    echo "🔄 PM2로 재시작 중..."
    pm2 restart inner-dev || pm2 start npm --name "inner-dev" -- start
elif systemctl list-units --type=service | grep -q inner-dev; then
    echo "🔄 systemd로 재시작 중..."
    sudo systemctl restart inner-dev
else
    echo "⚠️  PM2나 systemd가 설정되지 않았습니다. 수동으로 재시작해주세요."
    echo "실행 중인 프로세스를 종료하고 다시 시작하세요:"
    echo "  pkill -f 'next start'"
    echo "  nohup npm start > /dev/null 2>&1 &"
fi

echo "✅ 배포 완료!"


# AWS EC2 배포 가이드

## 1. EC2 인스턴스 준비

### EC2 인스턴스 생성
1. AWS 콘솔에서 EC2 인스턴스 생성
2. Ubuntu 22.04 LTS 또는 Amazon Linux 2023 권장
3. 최소 사양: t3.medium 이상 (Puppeteer 사용 시 메모리 필요)
4. Security Group에서 포트 3000 (또는 80, 443) 열기

### EC2 접속
```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
# 또는 Amazon Linux의 경우
ssh -i your-key.pem ec2-user@YOUR_EC2_IP
```

## 2. EC2 초기 설정

### 시스템 업데이트
```bash
# Ubuntu
sudo apt update && sudo apt upgrade -y

# Amazon Linux
sudo yum update -y
```

### Node.js 설치 (Node.js 24 필요)
```bash
# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

# Amazon Linux
curl -fsSL https://rpm.nodesource.com/setup_24.x | sudo bash -
sudo yum install -y nodejs

# 버전 확인
node --version  # v24.x.x 확인
npm --version
```

### 필수 패키지 설치 (Puppeteer용)
```bash
# Ubuntu
sudo apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  lsb-release \
  wget \
  xdg-utils

# Amazon Linux
sudo yum install -y \
  alsa-lib \
  atk \
  cups-libs \
  gtk3 \
  ipa-gothic-fonts \
  libXcomposite \
  libXcursor \
  libXdamage \
  libXext \
  libXi \
  libXrandr \
  libXScrnSaver \
  libXtst \
  pango \
  xorg-x11-fonts-100dpi \
  xorg-x11-fonts-75dpi \
  xorg-x11-utils
```

### Git 설치
```bash
# Ubuntu
sudo apt-get install -y git

# Amazon Linux
sudo yum install -y git
```

## 3. 프로젝트 배포

### 프로젝트 디렉토리 생성 및 클론
```bash
# 프로젝트 디렉토리 생성
sudo mkdir -p /var/www/inner-dev
sudo chown $USER:$USER /var/www/inner-dev

# Git 저장소 클론
cd /var/www/inner-dev
git clone https://github.com/your-username/InnerDev.git .

# 또는 이미 있다면
cd /var/www/inner-dev
git pull origin main
```

### 환경 변수 설정
```bash
cd /var/www/inner-dev
nano .env
```

다음 환경 변수 추가:
```env
# 데이터베이스
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Anthropic API (AI 분석용)
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Figma API (피그마 웹사이트 변환기용)
FIGMA_API_TOKEN="your-figma-api-token"

# Vercel API (자동 배포용, 선택사항)
VERCEL_API_TOKEN="your-vercel-api-token"
VERCEL_TEAM_ID="your-vercel-team-id"  # 선택사항

# Node 환경
NODE_ENV=production
PORT=3000
```

### 의존성 설치 및 빌드
```bash
cd /var/www/inner-dev

# 의존성 설치
npm install

# Prisma 마이그레이션
npx prisma generate
npx prisma migrate deploy

# 빌드
npm run build
```

## 4. 프로세스 관리자 설정

### PM2 사용 (권장)

```bash
# PM2 전역 설치
sudo npm install -g pm2

# PM2로 앱 시작
cd /var/www/inner-dev
pm2 start ecosystem.config.js

# PM2 자동 시작 설정
pm2 startup
# 출력된 명령어 실행 (sudo 권한 필요)
pm2 save
```

### PM2 명령어
```bash
# 상태 확인
pm2 status

# 로그 확인
pm2 logs inner-dev

# 재시작
pm2 restart inner-dev

# 중지
pm2 stop inner-dev
```

### systemd 사용 (대안)

```bash
# systemd 서비스 파일 생성
sudo nano /etc/systemd/system/inner-dev.service
```

다음 내용 추가:
```ini
[Unit]
Description=Inner Dev Next.js App
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/inner-dev
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
# 서비스 활성화
sudo systemctl daemon-reload
sudo systemctl enable inner-dev
sudo systemctl start inner-dev

# 상태 확인
sudo systemctl status inner-dev
```

## 5. Nginx 리버스 프록시 설정 (권장)

### Nginx 설치
```bash
# Ubuntu
sudo apt-get install -y nginx

# Amazon Linux
sudo yum install -y nginx
```

### Nginx 설정
```bash
sudo nano /etc/nginx/sites-available/inner-dev
```

다음 내용 추가:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # 또는 EC2 IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/inner-dev /etc/nginx/sites-enabled/

# 기본 설정 제거 (선택사항)
sudo rm /etc/nginx/sites-enabled/default

# Nginx 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 6. 방화벽 설정

### AWS Security Group
- 인바운드 규칙에 포트 80, 443 (또는 3000) 추가
- 소스: 0.0.0.0/0 (또는 특정 IP)

### UFW (Ubuntu)
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 7. 자동 배포 설정 (GitHub Actions)

### GitHub Actions 워크플로우 생성
`.github/workflows/deploy.yml` 파일 생성:

```yaml
name: Deploy to EC2

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Deploy to EC2
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USERNAME }}
          key: ${{ secrets.EC2_SSH_KEY }}
          port: ${{ secrets.EC2_PORT || 22 }}
          script: |
            cd ${{ secrets.EC2_APP_PATH || '/var/www/inner-dev' }}
            bash ec2-deploy.sh
```

### GitHub Secrets 설정
GitHub 저장소 > Settings > Secrets and variables > Actions에서:
- `EC2_HOST`: EC2 Public IP 또는 도메인
- `EC2_USERNAME`: ubuntu 또는 ec2-user
- `EC2_SSH_KEY`: SSH private key 전체 내용
- `EC2_PORT`: 22 (기본값)
- `EC2_APP_PATH`: /var/www/inner-dev

## 8. 배포 확인

### 애플리케이션 접속
```bash
# EC2 IP로 접속
http://YOUR_EC2_IP:3000

# 또는 Nginx 설정 시
http://YOUR_EC2_IP
```

### 로그 확인
```bash
# PM2 사용 시
pm2 logs inner-dev

# systemd 사용 시
sudo journalctl -u inner-dev -f

# Nginx 로그
sudo tail -f /var/log/nginx/error.log
```

## 9. 트러블슈팅

### Puppeteer 오류
```bash
# Chromium 경로 확인
which chromium-browser
# 또는
which google-chrome

# Puppeteer가 Chromium을 찾지 못하는 경우
# @sparticuz/chromium-min을 사용하도록 설정되어 있는지 확인
```

### 메모리 부족
```bash
# 스왑 파일 생성 (필요 시)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 포트 확인
```bash
# 포트 사용 확인
sudo netstat -tulpn | grep 3000
# 또는
sudo lsof -i :3000
```

## 10. 업데이트 배포

### 수동 배포
```bash
cd /var/www/inner-dev
bash ec2-deploy.sh
```

### 자동 배포
```bash
# 로컬에서 main 브랜치에 push
git push origin main

# GitHub Actions가 자동으로 배포 실행
```

## 참고사항

- Puppeteer는 메모리를 많이 사용하므로 인스턴스 사양을 충분히 확보하세요
- 환경 변수는 반드시 `.env` 파일에 설정하세요
- Prisma 마이그레이션은 배포 시마다 실행해야 합니다
- PM2를 사용하면 프로세스가 자동으로 재시작됩니다


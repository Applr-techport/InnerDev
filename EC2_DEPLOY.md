# EC2 자동 배포 설정 가이드

## 1. GitHub Secrets 설정

GitHub 저장소의 Settings > Secrets and variables > Actions에서 다음 secrets를 추가하세요:

- `EC2_HOST`: EC2 인스턴스의 Public IP 또는 도메인
- `EC2_USERNAME`: EC2 사용자명 (보통 `ubuntu` 또는 `ec2-user`)
- `EC2_SSH_KEY`: EC2 접속용 SSH private key (전체 내용)
- `EC2_PORT`: SSH 포트 (기본값: 22)
- `EC2_APP_PATH`: 프로젝트 경로 (예: `/var/www/inner-dev`)

## 2. EC2 초기 설정

### SSH 키 생성 및 등록
```bash
# 로컬에서 SSH 키 생성 (이미 있으면 생략)
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# EC2에 공개키 복사
ssh-copy-id -i ~/.ssh/id_rsa.pub ubuntu@YOUR_EC2_IP
```

### EC2에서 프로젝트 클론
```bash
# 프로젝트 디렉토리 생성
sudo mkdir -p /var/www/inner-dev
sudo chown ubuntu:ubuntu /var/www/inner-dev

# Git 저장소 클론
cd /var/www/inner-dev
git clone https://github.com/your-username/InnerDev.git .

# 또는 이미 있다면
cd /var/www/inner-dev
git remote add origin https://github.com/your-username/InnerDev.git
git pull origin main
```

### 환경 변수 설정
```bash
# .env 파일 생성
cd /var/www/inner-dev
nano .env

# 필요한 환경 변수 추가
# ANTHROPIC_API_KEY=...
# DATABASE_URL=...
# 등등
```

### PM2 설치 및 설정
```bash
# PM2 전역 설치
npm install -g pm2

# PM2로 앱 시작
cd /var/www/inner-dev
pm2 start ecosystem.config.js

# PM2 자동 시작 설정 (서버 재부팅 시 자동 실행)
pm2 startup
pm2 save
```

### 또는 systemd 서비스로 설정
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
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
# 서비스 활성화
sudo systemctl daemon-reload
sudo systemctl enable inner-dev
sudo systemctl start inner-dev
```

## 3. 배포 테스트

### 수동 배포 테스트
```bash
# EC2에 SSH 접속
ssh ubuntu@YOUR_EC2_IP

# 배포 스크립트 실행
cd /var/www/inner-dev
bash ec2-deploy.sh
```

### 자동 배포 테스트
```bash
# 로컬에서 main 브랜치에 push
git push origin main

# GitHub Actions에서 자동으로 배포가 시작됩니다
# GitHub 저장소의 Actions 탭에서 확인 가능
```

## 4. 트러블슈팅

### PM2 명령어
```bash
# 앱 상태 확인
pm2 status

# 로그 확인
pm2 logs inner-dev

# 재시작
pm2 restart inner-dev

# 중지
pm2 stop inner-dev

# 삭제
pm2 delete inner-dev
```

### systemd 명령어
```bash
# 상태 확인
sudo systemctl status inner-dev

# 재시작
sudo systemctl restart inner-dev

# 로그 확인
sudo journalctl -u inner-dev -f
```

### 포트 확인
```bash
# Next.js가 실행 중인지 확인
netstat -tulpn | grep 3000

# 또는
lsof -i :3000
```

### 방화벽 설정
```bash
# AWS Security Group에서 포트 3000 열기
# 또는 EC2에서 직접:
sudo ufw allow 3000/tcp
```

## 5. Nginx 리버스 프록시 설정 (선택사항)

도메인을 사용하거나 HTTPS를 적용하려면 Nginx를 설정하세요:

```bash
# Nginx 설치
sudo apt update
sudo apt install nginx

# 설정 파일 생성
sudo nano /etc/nginx/sites-available/inner-dev
```

다음 내용 추가:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/inner-dev /etc/nginx/sites-enabled/

# Nginx 재시작
sudo nginx -t
sudo systemctl restart nginx
```

## 6. 자동 배포 확인

GitHub에 push하면:
1. GitHub Actions가 자동으로 실행됩니다
2. EC2에 SSH 접속합니다
3. Git pull, npm install, build를 실행합니다
4. PM2 또는 systemd로 앱을 재시작합니다

GitHub 저장소의 Actions 탭에서 배포 상태를 확인할 수 있습니다.


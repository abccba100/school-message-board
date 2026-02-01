# 실시간 메시지 보드

여러 휴대폰에서 메시지를 작성하면 PC에서 실시간으로 확인할 수 있는 웹앱입니다.

## 빠른 시작

### 로컬 실행

1. `.env` 파일 생성:
```bash
cp env.example .env
# .env 파일 편집: SHARED_KEY 설정
```

2. 의존성 설치:
```bash
npm install
```

3. 서버 실행:
```bash
npm start
```

4. 브라우저에서 접속:
- 전송: http://localhost:3000/send
- 보기: http://localhost:3000/view

## 배포 (Ubuntu VPS)

### 1. 서버 준비

```bash
# Node.js 설치 (v18 이상)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Git 설치
sudo apt-get install git -y
```

### 2. 프로젝트 배포

```bash
# 프로젝트 클론
git clone <your-repo-url> messageboard
cd messageboard

# .env 파일 생성 및 설정
cp env.example .env
nano .env  # SHARED_KEY 설정

# 의존성 설치
npm install

# 서버 실행 (pm2 사용 권장)
npm install -g pm2
pm2 start server.js --name messageboard
pm2 save
pm2 startup
```

### 3. 포트 변경 (선택사항)

`.env` 파일에서 `PORT` 설정

## 환경 변수

- `PORT`: 서버 포트 (기본: 3000)
- `SHARED_KEY`: 공유 비밀키 (필수, send/view 모두 동일한 키 사용)

## 기능

- 실시간 메시지 전송/수신 (Socket.IO)
- SHARED_KEY + roomKey 기반 접근 제어
- 메시지 영속 저장 (SQLite)
- Rate limiting (IP당 1분에 30회)
- 입력값 검증 (이름 20자, 메시지 500자)
- 자동 스크롤 (토글 가능)
- localStorage로 roomKey, 이름 저장

## 데이터베이스

SQLite 파일 (`messages.db`)이 자동으로 생성됩니다.

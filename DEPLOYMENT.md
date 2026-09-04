# VerifAI deployment

## Local development

### Hardhat

```bash
cd contracts
npm install
npx hardhat node
```

In another terminal:

```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

### Backend

```bash
cd backend
python3 -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8000
```

For local development, set:

```env
APP_ENV=development
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
CONTRACT_ABI_PATH=./TrainingVerification.abi.json
AUTH_SECRET=replace-with-a-random-secret
DATABASE_URL=sqlite:///./verify_nn.db
CORS_ORIGINS=http://localhost:3000
```

### Frontend

```bash
npm install
npm start
```

Optional local environment:

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000/ws/dashboard
```

## Sepolia contract deployment

Create `contracts/.env` from `.env.example`:

```env
SEPOLIA_RPC_URL=YOUR_GOOGLE_CLOUD_SEPOLIA_RPC_ENDPOINT
PRIVATE_KEY=YOUR_SEPOLIA_DEPLOYER_PRIVATE_KEY
```

Never commit this file.

Deploy:

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

Copy the resulting contract address into the production backend environment.

## Production backend

Use a persistent Python host with HTTPS and WebSocket support.

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Set:

```env
APP_ENV=production
RPC_URL=YOUR_GOOGLE_CLOUD_SEPOLIA_RPC_ENDPOINT
CONTRACT_ADDRESS=0xYOUR_SEPOLIA_CONTRACT_ADDRESS
CONTRACT_ABI_PATH=./TrainingVerification.abi.json
AUTH_SECRET=GENERATED_RANDOM_SECRET
JWT_EXPIRY_HOURS=24
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/verifai
CORS_ORIGINS=https://YOUR-VERCEL-DOMAIN.vercel.app
MAX_UPLOAD_BYTES=536870912
UPLOAD_DIR=./uploads
```

Generate a secret with:

```bash
openssl rand -hex 32
```

The production owner account is seeded automatically as:

```text
Email: owner@gmail.com
Password: owner12345
Role: admin
```

Change the password after the first production login.

## Vercel frontend

Use the repository root as the Vercel root directory because the React application is in the repository root `src/` and `package.json`.

Framework preset:

```text
Create React App
```

Build command:

```text
npm run build
```

Output directory:

```text
build
```

Environment variables:

```env
REACT_APP_API_URL=https://YOUR-BACKEND-DOMAIN
REACT_APP_WS_URL=wss://YOUR-BACKEND-DOMAIN/ws/dashboard
```

Do not put private keys, database credentials, or `AUTH_SECRET` in Vercel variables.

## Production topology

```text
Vercel React
    |
    | HTTPS / WSS
    v
FastAPI backend
    |
    +---- PostgreSQL
    |
    +---- Google Cloud Blockchain RPC
                |
                v
          Ethereum Sepolia
                |
                v
       TrainingVerification
```

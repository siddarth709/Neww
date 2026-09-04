import hashlib
import json
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect, Header
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from web3 import Web3

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="Blockchain-Verification NN Training API", version="2.0.0")

CORS_ORIGINS = [item.strip() for item in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RPC_URL = os.getenv("RPC_URL", "http://127.0.0.1:8545")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000000")
CONTRACT_ABI_PATH = os.getenv("CONTRACT_ABI_PATH", str(BASE_DIR / "TrainingVerification.abi.json"))
AUTH_SECRET = os.getenv("AUTH_SECRET", "development-only-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(512 * 1024 * 1024)))
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'verify_nn.db'}")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads")))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 10}))


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class ModelArtifact(Base):
    __tablename__ = "model_artifacts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(Integer, index=True)
    filename: Mapped[str] = mapped_column(String(255))
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    size_bytes: Mapped[int] = mapped_column(Integer)
    round_id: Mapped[int] = mapped_column(Integer)
    storage_path: Mapped[str] = mapped_column(Text)
    tx_hash: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class TrainingRoundRecord(Base):
    __tablename__ = "training_rounds"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    round_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    accepted: Mapped[int] = mapped_column(Integer, default=0)
    rejected: Mapped[int] = mapped_column(Integer, default=0)
    accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    finalized_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)


def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_owner():
    with SessionLocal() as db:
        owner = db.scalar(select(User).where(User.email == "owner@gmail.com"))
        if owner is None:
            db.add(User(email="owner@gmail.com", password_hash=pwd_context.hash("owner12345"), role="admin"))
            db.commit()
        elif owner.role != "admin":
            owner.role = "admin"
            db.commit()


seed_owner()


def load_contract():
    path = Path(CONTRACT_ABI_PATH)
    if not path.is_absolute():
        path = BASE_DIR / path
    if not path.exists() or not Web3.is_address(CONTRACT_ADDRESS) or CONTRACT_ADDRESS == "0x0000000000000000000000000000000000000000":
        return None
    with path.open() as f:
        abi = json.load(f)
    return w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=abi)


contract = load_contract()
active_dashboard_sockets: list[WebSocket] = []


def create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "exp": int(datetime.now(timezone.utc).timestamp()) + JWT_EXPIRY_HOURS * 3600,
    }
    return jwt.encode(payload, AUTH_SECRET, algorithm=JWT_ALGORITHM)


def current_user(authorization: str, db: Session) -> User:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization[7:].strip()
    try:
        payload = jwt.decode(token, AUTH_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Invalid or expired session")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(401, "User not found")
    return user


def auth_user(authorization: str = Header(default=""), db: Session = Depends(db_session)) -> User:
    return current_user(authorization, db)


def admin_user(user: User = Depends(auth_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Administrator access required")
    return user


class AuthRequest(BaseModel):
    email: EmailStr
    password: str


class CommitRequest(BaseModel):
    node_address: str
    gradient_hash: str
    nonce: int


class RevealRequest(BaseModel):
    node_address: str
    gradient_hash: str
    nonce: int
    ipfs_cid: str
    round_id: int


class VerifyRequest(BaseModel):
    node_address: str
    round_id: int
    update_index: int
    anomaly_score: float
    is_malicious: bool
    reason: Optional[str] = None


class FinalizeRoundRequest(BaseModel):
    round_id: int
    accepted: int
    rejected: int
    accuracy: Optional[float] = None


@app.get("/health")
async def health():
    connected = False
    chain_id = None
    latest_block = None
    try:
        connected = w3.is_connected()
        if connected:
            chain_id = w3.eth.chain_id
            latest_block = w3.eth.block_number
    except Exception:
        connected = False
    return {
        "status": "ok",
        "blockchain_connected": connected,
        "chain_id": chain_id,
        "latest_block": latest_block,
        "contract_loaded": contract is not None,
        "environment": os.getenv("APP_ENV", "development"),
    }


@app.post("/auth/register")
async def register(req: AuthRequest, db: Session = Depends(db_session)):
    email = req.email.lower().strip()
    if len(req.password) < 8:
        raise HTTPException(422, "Password must be at least 8 characters")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists")
    user = User(email=email, password_hash=pwd_context.hash(req.password), role="user")
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user)
    return {"token": token, "user": {"id": user.id, "email": user.email, "role": user.role}}


@app.post("/auth/login")
async def login(req: AuthRequest, db: Session = Depends(db_session)):
    email = req.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not pwd_context.verify(req.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    token = create_token(user)
    return {"token": token, "user": {"id": user.id, "email": user.email, "role": user.role}}


@app.get("/auth/me")
async def me(user: User = Depends(auth_user)):
    return {"user": {"id": user.id, "email": user.email, "role": user.role}}


@app.get("/models")
async def list_models(user: User = Depends(auth_user), db: Session = Depends(db_session)):
    stmt = select(ModelArtifact).order_by(ModelArtifact.created_at.desc())
    if user.role != "admin":
        stmt = stmt.where(ModelArtifact.owner_id == user.id)
    rows = db.scalars(stmt).all()
    return {
        "models": [
            {
                "id": row.id,
                "filename": row.filename,
                "sha256": row.sha256,
                "size": row.size_bytes,
                "size_bytes": row.size_bytes,
                "round_id": row.round_id,
                "tx_hash": row.tx_hash,
                "created_at": row.created_at.isoformat(),
                "owner_id": row.owner_id,
            }
            for row in rows
        ]
    }


@app.post("/models/commit")
async def commit_model(
    file: UploadFile = File(...),
    round_id: int = Form(...),
    user: User = Depends(auth_user),
    db: Session = Depends(db_session),
):
    if round_id < 1:
        raise HTTPException(422, "round_id must be at least 1")
    allowed = {".pt", ".pth", ".onnx", ".bin", ".safetensors"}
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in allowed:
        raise HTTPException(415, "Unsupported model format")
    safe_name = Path(file.filename or "model.bin").name
    target = UPLOAD_DIR / f"{secrets.token_hex(16)}_{safe_name}"
    digest = hashlib.sha256()
    size = 0
    with target.open("wb") as output:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                target.unlink(missing_ok=True)
                raise HTTPException(413, "Model artifact exceeds the upload limit")
            digest.update(chunk)
            output.write(chunk)
    sha256 = digest.hexdigest()
    artifact = ModelArtifact(
        owner_id=user.id,
        filename=safe_name,
        sha256=sha256,
        size_bytes=size,
        round_id=round_id,
        storage_path=str(target),
    )
    db.add(artifact)
    db.commit()
    db.refresh(artifact)
    await broadcast({
        "type": "model_committed",
        "model_id": artifact.id,
        "filename": artifact.filename,
        "sha256": artifact.sha256,
        "round": artifact.round_id,
        "owner": user.email,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "status": "committed",
        "model_hash": f"0x{sha256}",
        "sha256": sha256,
        "size": size,
        "round_id": round_id,
        "model_id": artifact.id,
    }


@app.get("/admin/rounds")
async def admin_rounds(user: User = Depends(admin_user), db: Session = Depends(db_session)):
    rows = db.scalars(select(TrainingRoundRecord).order_by(TrainingRoundRecord.round_id.asc())).all()
    return {
        "rounds": [
            {"round": r.round_id, "accepted": r.accepted, "rejected": r.rejected, "accuracy": r.accuracy, "finalized_at": r.finalized_at.isoformat()}
            for r in rows
        ]
    }


@app.post("/commitGradient")
async def commit_gradient(req: CommitRequest, user: User = Depends(auth_user)):
    try:
        gradient_bytes = Web3.to_bytes(hexstr=req.gradient_hash)
    except Exception:
        raise HTTPException(422, "gradient_hash must be a valid bytes32 hex value")
    commit_hash = Web3.solidity_keccak(
        ["bytes32", "uint256", "address"],
        [gradient_bytes, req.nonce, Web3.to_checksum_address(req.node_address)],
    )
    if contract is None:
        return {"status": "simulated", "commit_hash": commit_hash.hex()}
    tx = contract.functions.commitGradient(commit_hash).build_transaction({
        "from": Web3.to_checksum_address(req.node_address),
        "nonce": w3.eth.get_transaction_count(Web3.to_checksum_address(req.node_address)),
    })
    return {"status": "built_tx", "commit_hash": commit_hash.hex(), "tx": tx}


@app.post("/revealGradient")
async def reveal_gradient(req: RevealRequest, user: User = Depends(auth_user)):
    await broadcast({
        "type": "gradient_revealed",
        "node": req.node_address,
        "round": req.round_id,
        "ipfs_cid": req.ipfs_cid,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return {"status": "revealed", "round_id": req.round_id, "node": req.node_address}


@app.post("/verifyUpdate")
async def verify_update(req: VerifyRequest, user: User = Depends(auth_user)):
    event_type = "gradient_flagged" if req.is_malicious else "gradient_verified"
    await broadcast({
        "type": event_type,
        "node": req.node_address,
        "round": req.round_id,
        "anomaly_score": req.anomaly_score,
        "reason": req.reason,
    })
    return {"status": "processed", "flagged": req.is_malicious, "anomaly_score": req.anomaly_score}


@app.post("/finalizeRound")
async def finalize_round(req: FinalizeRoundRequest, user: User = Depends(admin_user), db: Session = Depends(db_session)):
    if req.round_id < 1 or req.accepted < 0 or req.rejected < 0:
        raise HTTPException(422, "Invalid round metrics")
    existing = db.scalar(select(TrainingRoundRecord).where(TrainingRoundRecord.round_id == req.round_id))
    if existing is None:
        existing = TrainingRoundRecord(round_id=req.round_id, accepted=req.accepted, rejected=req.rejected, accuracy=req.accuracy)
        db.add(existing)
    else:
        existing.accepted = req.accepted
        existing.rejected = req.rejected
        existing.accuracy = req.accuracy
        existing.finalized_at = datetime.now(timezone.utc)
    db.commit()
    await broadcast({
        "type": "round_finalized",
        "round": req.round_id,
        "accepted": req.accepted,
        "rejected": req.rejected,
        "accuracy": req.accuracy,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return {"status": "finalized", "round": req.round_id}


@app.get("/getTrainingHistory/{round_id}")
async def get_training_history(round_id: int, user: User = Depends(auth_user)):
    if contract is None:
        raise HTTPException(503, "Contract is not loaded. Set CONTRACT_ADDRESS and CONTRACT_ABI_PATH.")
    try:
        updates = contract.functions.getTrainingHistory(round_id).call()
    except Exception as exc:
        raise HTTPException(502, f"Blockchain query failed: {exc}")
    return {"round": round_id, "updates": updates}


@app.websocket("/ws/dashboard")
async def dashboard_socket(ws: WebSocket, token: str = ""):
    try:
        payload = jwt.decode(token, AUTH_SECRET, algorithms=[JWT_ALGORITHM])
        if not payload.get("sub"):
            raise ValueError
    except Exception:
        await ws.close(code=1008)
        return
    await ws.accept()
    active_dashboard_sockets.append(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        if ws in active_dashboard_sockets:
            active_dashboard_sockets.remove(ws)


async def broadcast(event: dict):
    dead = []
    for ws in active_dashboard_sockets:
        try:
            await ws.send_json(event)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in active_dashboard_sockets:
            active_dashboard_sockets.remove(ws)


def hash_gradient(tensor_bytes: bytes) -> str:
    return "0x" + hashlib.sha3_256(tensor_bytes).hexdigest()

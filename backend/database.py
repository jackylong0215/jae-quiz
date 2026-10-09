import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 本地 SQLite 輕量資料庫（自動儲存在 jae-backend 目錄下）
DB_PATH = os.path.abspath(os.getenv('JAE_DATABASE_PATH') or os.path.join(os.path.dirname(os.path.abspath(__file__)), "jae_app.db"))
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """FastAPI 依賴注入：獲取資料庫會話"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """初始化資料庫表結構"""
    import models
    Base.metadata.create_all(bind=engine)

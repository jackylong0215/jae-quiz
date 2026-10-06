from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from sqlalchemy import Boolean
from datetime import datetime, timezone, timedelta

# 澳門時間 = UTC+8
MACAO_TZ = timezone(timedelta(hours=8))

def macao_now():
    return datetime.now(MACAO_TZ).replace(tzinfo=None)  # 移除 tzinfo 以便存 SQLite

class User(Base):
    __tablename__ = "users"
    is_admin = Column(Boolean, default=False)
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=macao_now)
    favorites = relationship("FavoriteQuestion", back_populates="user")

    # 關聯測驗歷史記錄
    quiz_records = relationship("QuizRecord", back_populates="user", cascade="all, delete-orphan")


class QuizRecord(Base):
    __tablename__ = "quiz_records"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    score_percent = Column(Integer, nullable=False)
    correct_count = Column(Integer, nullable=False)
    total_count = Column(Integer, nullable=False)
    time_taken_seconds = Column(Integer, default=0)
    category_breakdown_json = Column(Text, nullable=True)  # JSON 字串
    questions_json = Column(Text)
    user_answers_json = Column(Text, nullable=True)
    pedagogical_feedback = Column(Text, nullable=True)     # AI 教育理論學習反饋
    created_at = Column(DateTime, default=macao_now)

    user = relationship("User", back_populates="quiz_records")

class FavoriteQuestion(Base):
    __tablename__ = "favorite_questions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    question_id = Column(String, index=True)          # 題目唯一識別（例如 p00-m1）
    question_json = Column(Text)                       # 完整題目內容（快照）
    note = Column(Text, nullable=True)                 # 使用者筆記（可選）
    created_at = Column(DateTime, default=macao_now)
    user = relationship("User", back_populates="favorites")   # ← 加上 b
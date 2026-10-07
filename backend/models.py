from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base

# 澳門時間 = UTC+8
MACAO_TZ = timezone(timedelta(hours=8))

def macao_now():
    return datetime.now(MACAO_TZ).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=macao_now)

    favorites = relationship("FavoriteQuestion", back_populates="user", cascade="all, delete-orphan")
    quiz_records = relationship("QuizRecord", back_populates="user", cascade="all, delete-orphan")
    wrong_questions = relationship("WrongQuestion", back_populates="user", cascade="all, delete-orphan")
    topic_mastery = relationship("TopicMastery", back_populates="user", cascade="all, delete-orphan")
    question_attempts = relationship("QuestionAttempt", back_populates="user", cascade="all, delete-orphan")
    topic_diagnoses = relationship("TopicDiagnosis", back_populates="user", cascade="all, delete-orphan")


class QuizRecord(Base):
    __tablename__ = "quiz_records"
    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    score_percent = Column(Integer, nullable=False)
    correct_count = Column(Integer, nullable=False)
    total_count = Column(Integer, nullable=False)
    time_taken_seconds = Column(Integer, default=0)
    category_breakdown_json = Column(Text, nullable=True)
    questions_json = Column(Text)
    user_answers_json = Column(Text, nullable=True)
    pedagogical_feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=macao_now)

    user = relationship("User", back_populates="quiz_records")


class FavoriteQuestion(Base):
    __tablename__ = "favorite_questions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    question_id = Column(String, index=True)
    question_json = Column(Text)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=macao_now)

    user = relationship("User", back_populates="favorites")


class WrongQuestion(Base):
    __tablename__ = "wrong_questions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    question_id = Column(String, index=True)
    question_json = Column(Text)
    user_answer = Column(Text)
    correct_answer = Column(Text)
    category = Column(String, index=True)
    sub_topics = Column(Text)
    difficulty = Column(String)
    wrong_count = Column(Integer, default=1)
    last_wrong_at = Column(DateTime, default=macao_now)
    mastered = Column(Boolean, default=False)
    created_at = Column(DateTime, default=macao_now)

    user = relationship("User", back_populates="wrong_questions")


class TopicMastery(Base):
    __tablename__ = "topic_mastery"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    topic = Column(String, index=True)
    total_attempts = Column(Integer, default=0)
    correct_attempts = Column(Integer, default=0)
    mastery_percent = Column(Integer, default=0)
    updated_at = Column(DateTime, default=macao_now)

    user = relationship("User", back_populates="topic_mastery")


class PracticeSession(Base):
    __tablename__ = "practice_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    topic = Column(String)
    question_ids = Column(Text)
    score_percent = Column(Integer)
    created_at = Column(DateTime, default=macao_now)


class QuestionAttempt(Base):
    __tablename__ = "question_attempts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    question_id = Column(String, index=True)
    quiz_id = Column(String, index=True)
    question_json = Column(Text)
    user_answer = Column(String)
    correct_answer = Column(String)
    is_correct = Column(Boolean)
    time_spent_seconds = Column(Integer)
    difficulty = Column(String)
    sub_topics = Column(Text)
    main_category = Column(String)
    attempted_at = Column(DateTime, default=macao_now)

    user = relationship("User", back_populates="question_attempts")


class TopicDiagnosis(Base):
    __tablename__ = "topic_diagnosis"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    topic = Column(String, index=True)
    mastery_level = Column(String)
    correct_rate = Column(Integer)
    avg_time_seconds = Column(Integer)
    total_attempts = Column(Integer)
    recent_results = Column(String)          # ⭐ 改名：recent_3_results → recent_results
    diagnosis_type = Column(String)
    recommendation = Column(Text)  
    last_updated = Column(DateTime, default=macao_now)

    user = relationship("User", back_populates="topic_diagnoses")
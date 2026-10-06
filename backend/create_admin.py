from database import SessionLocal
from models import User
from auth import hash_password


def create_admin(username, email, password, full_name):
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            existing.is_admin = True
            db.commit()
            print(f"✅ 已將 {username} 升級為管理員")
            return
        admin = User(
            username=username,
            email=email,
            hashed_password=hash_password(password),
            full_name=full_name,
            is_admin=True,
        )
        db.add(admin)
        db.commit()
        print(f"✅ 管理員 {username} 建立成功")
    finally:
        db.close()


if __name__ == "__main__":
    create_admin(
        username="admin",
        email="admin@jae.local",
        password="Admin123456",
        full_name="系統管理員",
    )
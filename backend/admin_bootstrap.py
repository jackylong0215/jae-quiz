"""Provision an administrator only with an operator-configured password."""
import os

from auth import hash_password
from models import User


def bootstrap_admin(db):
    password = os.getenv('JAE_ADMIN_PASSWORD', '')
    if not password:
        return False
    username = os.getenv('JAE_ADMIN_USERNAME', 'admin')
    # Do not change an existing user's password or grant an existing user a role.
    if db.query(User).filter(User.username == username).first():
        return False
    db.add(User(username=username, email=os.getenv('JAE_ADMIN_EMAIL', 'admin@jae.local'),
                hashed_password=hash_password(password), full_name='系統管理員', is_admin=True))
    db.commit()
    return True

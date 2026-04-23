import sys
sys.path.insert(0, '/var/www/vod-manager/app/backend')
from app.core.database import SessionLocal
from sqlalchemy import text
db = SessionLocal()
r = db.execute(text('SELECT COUNT(*) FROM user_connections WHERE is_active=true'))
print('active:', r.scalar())
db.execute(text('UPDATE user_connections SET is_active=false'))
db.commit()
print('cleared')
db.close()

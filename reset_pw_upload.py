from argon2 import PasswordHasher
import subprocess, os
ph = PasswordHasher()
h = ph.hash('admin')
sql = "UPDATE users SET password_hash='" + h + "' WHERE username='admin';"
env = dict(os.environ)
env['PGPASSWORD'] = 'V0dM4n4g3r_Pr0d_2024_xK9mZ'
r = subprocess.run(['psql','-h','127.0.0.1','-U','vod_user','-d','vod_manager','-c',sql], capture_output=True, text=True, env=env)
print('out:', r.stdout, 'err:', r.stderr)

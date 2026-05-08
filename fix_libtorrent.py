#!/usr/bin/env python3
import paramiko
import time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('62.210.92.252', port=22, username='root', password='Kia2014x', timeout=30)

def run(cmd, timeout=60):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors='replace')
    err = stderr.read().decode(errors='replace')
    ec = stdout.channel.recv_exit_status()
    return out, err, ec

# Find libtorrent .so files
out, err, ec = run('find /usr/lib/python3 -name "*libtorrent*" 2>/dev/null')
print('LIBTORRENT FILES:', out)

# Find venv site-packages path
out2, _, _ = run('/var/www/vod-manager/venv/bin/python -c "import site; print(site.getsitepackages())"')
print('VENV SITE PACKAGES:', out2)

# Link libtorrent to venv
link_cmd = 'VENV_SITE=$(/var/www/vod-manager/venv/bin/python -c "import site; print(site.getsitepackages()[0])") && for f in $(find /usr/lib/python3 -name "*libtorrent*" 2>/dev/null); do fname=$(basename $f); if [ ! -e "$VENV_SITE/$fname" ]; then ln -sf "$f" "$VENV_SITE/$fname" && echo "Linked: $fname"; fi; done && echo DONE'
out3, err3, ec3 = run(link_cmd)
print('LINK RESULT:', out3, err3[:200] if err3 else '')

# Verify libtorrent in venv
out4, _, _ = run('/var/www/vod-manager/venv/bin/python -c "import libtorrent; print(\'OK:\', libtorrent.version)"')
print('VERIFY LIBTORRENT:', out4)

# Restart API
out5, _, _ = run('systemctl restart vod-manager-api')
time.sleep(8)
out6, _, _ = run('curl -s http://127.0.0.1:8000/health')
print('HEALTH:', out6)

# Check torrent endpoint
out7, _, _ = run('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/v1/torrent')
print('TORRENT ENDPOINT HTTP CODE:', out7, '(401=auth required=OK)')

# Check recent logs
out8, _, _ = run('journalctl -u vod-manager-api -n 15 --no-pager')
print('RECENT LOGS:\n', out8[:800])

client.close()
print('Done.')

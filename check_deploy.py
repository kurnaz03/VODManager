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

print('Waiting for API to be ready...')
time.sleep(10)

# Health check
out, _, _ = run('curl -s http://127.0.0.1:8000/health')
print('HEALTH:', out)

out2, _, _ = run('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/v1/torrent')
print('TORRENT ENDPOINT HTTP CODE:', out2, '(401=OK)')

out3, _, _ = run('journalctl -u vod-manager-api -n 30 --no-pager 2>&1 | tail -30')
print('LOGS:\n', out3)

# Check if API is responding and what port
out4, _, _ = run('ss -tlnp | grep 8000 || ss -tlnp | grep uvicorn')
print('PORT 8000:', out4)

client.close()

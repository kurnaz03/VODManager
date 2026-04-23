import sys
sys.path.insert(0, '/var/www/vod-manager/app/backend')
import httpx
import psycopg2

conn = psycopg2.connect(host='127.0.0.1', dbname='vod_manager', user='vod_user', password='V0dM4n4g3r_Pr0d_2024_xK9mZ')
cur = conn.cursor()

cur.execute("SELECT id, ip_address FROM user_connections WHERE (country_code IS NULL OR country_code='') AND ip_address NOT IN ('127.0.0.1','::1')")
rows = cur.fetchall()
print(f"Bos kayit sayisi: {len(rows)}")

updated = 0
for row_id, ip in rows:
    if ip.startswith('192.168.') or ip.startswith('10.') or ip.startswith('172.'):
        continue
    try:
        resp = httpx.get(f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,isp", timeout=3.0)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('countryCode'):
                cur.execute(
                    "UPDATE user_connections SET country_code=%s, country_name=%s, isp_name=%s WHERE id=%s",
                    (data['countryCode'], data.get('country',''), data.get('isp',''), row_id)
                )
                updated += 1
    except Exception as e:
        print(f"Hata {ip}: {e}")

conn.commit()
cur.close()
conn.close()
print(f"Guncellenen: {updated}")

import psycopg2
import httpx
import time

conn = psycopg2.connect(
    host='127.0.0.1',
    user='vod_user',
    password='V0dM4n4g3r_Pr0d_2024_xK9mZ',
    dbname='vod_manager'
)
cur = conn.cursor()

cur.execute("""
    SELECT DISTINCT ip_address FROM user_connections
    WHERE (isp_name IS NULL OR isp_name = '')
    AND ip_address NOT IN ('127.0.0.1', '::1')
    AND ip_address NOT LIKE '192.168.%'
    AND ip_address NOT LIKE '10.%'
    AND ip_address NOT LIKE '172.%'
""")
ips = [r[0] for r in cur.fetchall()]
print(f'Found {len(ips)} IPs to update in user_connections')

updated = 0
for ip in ips:
    try:
        r = httpx.get(f'http://ip-api.com/json/{ip}?fields=country,countryCode,isp', timeout=3)
        d = r.json()
        if d.get('countryCode') or d.get('isp'):
            isp = d.get('isp', '')
            cc = d.get('countryCode', '')
            country = d.get('country', '')
            cur.execute("""
                UPDATE user_connections
                SET isp_name=%s, country_code=%s, country_name=%s
                WHERE ip_address=%s AND (isp_name IS NULL OR isp_name='')
            """, (isp, cc, country, ip))
            cur.execute("""
                UPDATE user_watch_history
                SET isp_name=%s, country_code=%s
                WHERE ip_address=%s AND (isp_name IS NULL OR isp_name='')
            """, (isp, cc, ip))
            print(f'  {ip} -> {cc} / {isp}')
            updated += 1
        else:
            print(f'  {ip} -> no data returned')
    except Exception as e:
        print(f'  {ip} ERROR: {e}')
    time.sleep(0.5)  # rate limit: max 2 req/sec free tier

conn.commit()
cur.close()
conn.close()
print(f'DONE. Updated {updated}/{len(ips)} IPs.')

from sqlalchemy import create_engine, text
engine = create_engine('postgresql://vod_user:V0dM4n4g3r_Pr0d_2024_xK9mZ@localhost/vod_manager')
with engine.connect() as conn:
    conn.execute(text("UPDATE vpn_server_config SET ta_key_path = '/etc/openvpn/clients/ta.key'"))
    conn.commit()
    r = conn.execute(text("SELECT ta_key_path FROM vpn_server_config"))
    print('Updated ta_key_path:', r.fetchone()[0])

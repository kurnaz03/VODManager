import sys
import os
sys.path.insert(0, '/var/www/vod-manager/app/backend')
os.chdir('/var/www/vod-manager/app/backend')

try:
    from app.modules.settings import service
    print('settings.service: OK')
except Exception as e:
    print(f'settings.service ERROR: {e}')

try:
    from app.modules.settings import router
    print('settings.router: OK')
except Exception as e:
    print(f'settings.router ERROR: {e}')

try:
    from app.api.v1.router import api_router
    print('api_router: OK')
    routes = [r.path for r in api_router.routes]
    setting_routes = [r for r in routes if 'setting' in r]
    print(f'Setting routes: {setting_routes}')
except Exception as e:
    print(f'api_router ERROR: {e}')

try:
    import main
    print('main: OK')
except Exception as e:
    print(f'main ERROR: {e}')

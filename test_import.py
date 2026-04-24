import sys
sys.path.insert(0, '/var/www/vod-manager/app/backend')

# Test imports
try:
    from app.main import app
    print("App loaded successfully")
except Exception as e:
    print(f"Error loading app: {e}")
    import traceback
    traceback.print_exc()

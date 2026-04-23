#!/bin/bash
curl -s http://127.0.0.1:8000/openapi.json > /tmp/openapi.json
python3 << 'EOF'
import json
with open('/tmp/openapi.json') as f:
    data = json.load(f)
for path in sorted(data.get('paths', {}).keys()):
    print(path)
EOF

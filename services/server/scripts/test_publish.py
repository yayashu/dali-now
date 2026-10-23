import urllib.request
import json
import os

# Login（账号密码从环境变量读取，请勿硬编码）
login_data = json.dumps({
    "username": os.environ.get('ADMIN_USERNAME', 'admin'),
    "password": os.environ.get('ADMIN_PASSWORD', '')
}).encode()
req = urllib.request.Request("http://localhost:5000/api/admin/login", data=login_data, headers={"Content-Type":"application/json"}, method="POST")
resp = urllib.request.urlopen(req)
result = json.loads(resp.read())
token = result['data']['token']
print(f"Logged in, token: {token[:16]}...")

# Test checkin points
req2 = urllib.request.Request("http://localhost:5000/api/admin/checkin-points?size=2", headers={"X-Admin-Token":token})
resp2 = urllib.request.urlopen(req2)
data = json.loads(resp2.read())
print(f"Checkin points: code={data['code']}, total={data['data']['total']}")
if data['data']['list']:
    item = data['data']['list'][0]
    print(f"  First item: name={item['name']}, publish_status={item.get('publish_status','N/A')}")

# Test activities
req3 = urllib.request.Request("http://localhost:5000/api/admin/activities?size=2", headers={"X-Admin-Token":token})
resp3 = urllib.request.urlopen(req3)
data3 = json.loads(resp3.read())
print(f"Activities: code={data3['code']}, total={data3['data']['total']}")
if data3['data']['list']:
    item = data3['data']['list'][0]
    print(f"  First item: name={item['name']}, publish_status={item.get('publish_status','N/A')}")

print("\nAll tests passed!")

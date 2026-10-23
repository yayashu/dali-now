"""
为数据库中所有 /images/ 开头的图片路径生成占位图
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from PIL import Image, ImageDraw, ImageFont
from app import query

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES_DIR = os.path.join(BASE_DIR, 'images')

# 收集所有 /images/ 开头的图片 URL
paths = set()

tables_fields = [
    ('activity_images', 'image_url'),
    ('activities', 'cover'),
    ('activities', 'poster'),
    ('checkin_points', 'cover'),
    ('checkin_photos', 'image_url'),
    ('homepage_photos', 'image_url'),
    ('live_posts', 'cover'),
    ('live_post_images', 'image_url'),
    ('users', 'avatar'),
]

for table, field in tables_fields:
    try:
        rows = query(f'SELECT DISTINCT {field} FROM {table} WHERE {field} IS NOT NULL AND {field} != %s', [''])
        for r in rows:
            url = r[field]
            if url and url.startswith('/images/'):
                paths.add(url)
    except Exception as e:
        print(f'  skip {table}.{field}: {e}')

print(f'共 {len(paths)} 个唯一图片路径需要生成')

def generate_placeholder(filepath, label=''):
    """生成彩色占位图"""
    width, height = 400, 300
    import hashlib
    h = hashlib.md5(label.encode()).hexdigest()
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    img = Image.new('RGB', (width, height), (r, g, b))
    draw = ImageDraw.Draw(img)
    # 简单文字标注
    try:
        font = ImageFont.truetype('arial.ttf', 16)
    except:
        font = ImageFont.load_default()
    text = label[:30]
    bbox = draw.textbbox((0, 0), text, font=font)
    tx = (width - bbox[2]) // 2
    ty = (height - bbox[3]) // 2
    draw.text((tx, ty), text, fill=(255, 255, 255), font=font)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    img.save(filepath)
    print(f'  created: {filepath}')

for url in sorted(paths):
    rel = url[len('/images/'):]  # 去掉 /images/ 前缀
    filepath = os.path.join(IMAGES_DIR, rel)
    if os.path.exists(filepath):
        print(f'  exists: {filepath}')
        continue
    generate_placeholder(filepath, os.path.basename(url))

print('完成！')

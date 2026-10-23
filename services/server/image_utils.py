# -*- coding: utf-8 -*-
"""
图片处理工具 — 服务端统一压缩 + WebP 转换
=============================================
匹配微信小程序各展示场景的最优尺寸：
  封面/卡片: 展示宽度 ~335px(2x屏), 高度 320-440rpx → max 1200px 足够
  详情大图:  展示宽度 ~375px(2x屏), 高度最高 440rpx → max 1200px 足够
  缩略图:    网格小图 200-380rpx → max 600px 足够
"""
import io
from PIL import Image, ImageOps


# 处理档位配置
PROFILES = {
    'cover':   {'max_width': 1200, 'max_height': 2400, 'quality': 85},
    'gallery': {'max_width': 1200, 'max_height': 2400, 'quality': 82},
    'thumb':   {'max_width': 600,  'max_height': 1200, 'quality': 80},
}


def process_image(file_data, max_width=1200, max_height=2400,
                  quality=85, output_format='webp'):
    """
    处理图片：智能等比缩放 + 格式转换 + 压缩优化

    Args:
        file_data:   原始图片字节数据
        max_width:   最大宽度（px），超过等比缩小
        max_height:  最大高度（px），超过等比缩小
        quality:     WebP/JPEG 质量 (1-100)
        output_format: 输出格式，'webp' 或 'jpeg'

    Returns:
        (processed_bytes, extension) — extension 不含点号
        处理失败时返回 (原始数据, None) 不阻断流程
    """
    try:
        img = Image.open(io.BytesIO(file_data))

        # 自动旋转（根据 EXIF 方向标记）
        img = ImageOps.exif_transpose(img)

        # 处理色彩模式
        orig_mode = img.mode
        if output_format == 'webp':
            # WebP 原生支持 RGBA，保留透明通道
            pass
        elif output_format == 'jpeg':
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                if img.mode in ('RGBA', 'LA'):
                    background.paste(img, mask=img.split()[-1])
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')

        # 等比缩放（只缩小不放大）
        w, h = img.size
        ratio = min(max_width / w, max_height / h, 1.0)
        if ratio < 1.0:
            new_size = (int(w * ratio), int(h * ratio))
            img = img.resize(new_size, Image.LANCZOS)

        # 编码输出
        ext = output_format.lower()
        save_fmt = 'JPEG' if ext == 'jpeg' else ext.upper()
        output = io.BytesIO()
        save_kwargs = {
            'format': save_fmt,
            'quality': quality,
            'optimize': True,
        }
        if output_format == 'webp':
            save_kwargs['method'] = 6  # 最高压缩比(0-6)
        img.save(output, **save_kwargs)

        return output.getvalue(), ext

    except Exception:
        # 处理失败返回原数据，不阻断上传流程
        return file_data, None

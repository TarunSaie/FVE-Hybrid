#!/usr/bin/env python3
"""
Generate Android app launcher icons and adaptive icons for FitVerse Elite mobile app.
Supports base64 data URLs, local image files, and web paths.
"""

import sys
import os
import re
import base64
import argparse
from io import BytesIO
from PIL import Image, ImageDraw, ImageOps

DENSITIES = {
    'mdpi': {'legacy': 48, 'adaptive': 108},
    'hdpi': {'legacy': 72, 'adaptive': 162},
    'xhdpi': {'legacy': 96, 'adaptive': 216},
    'xxhdpi': {'legacy': 144, 'adaptive': 324},
    'xxxhdpi': {'legacy': 192, 'adaptive': 432},
}

def hex_to_rgb(hex_str, default=(5, 5, 5)):
    if not hex_str:
        return default
    hex_clean = hex_str.strip().lstrip('#')
    if len(hex_clean) == 3:
        hex_clean = ''.join(c * 2 for c in hex_clean)
    if len(hex_clean) == 6:
        try:
            return tuple(int(hex_clean[i:i+2], 16) for i in (0, 2, 4))
        except ValueError:
            return default
    return default

def load_image(input_data, mobile_root):
    # Check if base64 data URL
    if input_data.startswith('data:'):
        match = re.search(r'base64,(.+)', input_data, re.DOTALL)
        if match:
            raw_bytes = base64.b64decode(match.group(1))
            return Image.open(BytesIO(raw_bytes)).convert('RGBA')
        raise ValueError("Invalid base64 image data URL")

    # Check if direct file path
    if os.path.exists(input_data):
        return Image.open(input_data).convert('RGBA')

    # Check relative to mobile root
    rel_path = os.path.join(mobile_root, input_data.lstrip('/'))
    if os.path.exists(rel_path):
        return Image.open(rel_path).convert('RGBA')

    # Check relative to web public directory
    web_public = os.path.abspath(os.path.join(mobile_root, '../fitverse-elite-fve/public', input_data.lstrip('/')))
    if os.path.exists(web_public):
        return Image.open(web_public).convert('RGBA')

    raise FileNotFoundError(f"Source image not found: {input_data}")

def fit_contain(img, target_w, target_h):
    aspect = img.width / img.height
    if aspect >= target_w / target_h:
        new_w = target_w
        new_h = max(1, int(target_w / aspect))
    else:
        new_h = target_h
        new_w = max(1, int(target_h * aspect))
    return img.resize((new_w, new_h), Image.Resampling.LANCZOS)

def create_adaptive_foreground(logo_img, canvas_size):
    # Safe zone: center 66% to 70% of canvas
    target_dim = int(canvas_size * 0.68)
    scaled_logo = fit_contain(logo_img, target_dim, target_dim)
    
    foreground = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    offset_x = (canvas_size - scaled_logo.width) // 2
    offset_y = (canvas_size - scaled_logo.height) // 2
    foreground.paste(scaled_logo, (offset_x, offset_y), scaled_logo)
    return foreground

def create_monochrome(foreground_img):
    # Convert alpha channel to white on transparent for Android themed monochrome icons
    r, g, b, alpha = foreground_img.split()
    white = Image.new('L', foreground_img.size, 255)
    return Image.merge('RGBA', (white, white, white, alpha))

def create_legacy_icon(logo_img, size, bg_rgb, round_corners=True, corner_radius=None):
    # Draw background
    target_dim = int(size * 0.72)
    scaled_logo = fit_contain(logo_img, target_dim, target_dim)
    
    icon = Image.new('RGBA', (size, size), (*bg_rgb, 255))
    offset_x = (size - scaled_logo.width) // 2
    offset_y = (size - scaled_logo.height) // 2
    icon.paste(scaled_logo, (offset_x, offset_y), scaled_logo)
    
    if round_corners:
        radius = corner_radius or int(size * 0.22)
        mask = Image.new('L', (size, size), 0)
        draw = ImageDraw.Draw(mask)
        draw.rounded_rectangle((0, 0, size, size), radius=radius, fill=255)
        out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        out.paste(icon, (0, 0))
        out.putalpha(mask)
        return out
    return icon

def create_circular_icon(logo_img, size, bg_rgb):
    target_dim = int(size * 0.70)
    scaled_logo = fit_contain(logo_img, target_dim, target_dim)
    
    icon = Image.new('RGBA', (size, size), (*bg_rgb, 255))
    offset_x = (size - scaled_logo.width) // 2
    offset_y = (size - scaled_logo.height) // 2
    icon.paste(scaled_logo, (offset_x, offset_y), scaled_logo)
    
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size, size), fill=255)
    
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(icon, (0, 0))
    out.putalpha(mask)
    return out

def update_colors_xml(file_path, bg_hex):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    updated = re.sub(
        r'<color name="iconBackground">#[0-9a-fA-F]+</color>',
        f'<color name="iconBackground">{bg_hex}</color>',
        content
    )
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(updated)

def main():
    parser = argparse.ArgumentParser(description='Generate Android app launcher icons')
    parser.add_argument('--input', help='Path or base64 data of source logo image')
    parser.add_argument('--input-file', help='Path to file containing image path or base64 data')
    parser.add_argument('--bg-color', default='#050505', help='App launcher background color (hex)')
    parser.add_argument('--mobile-dir', default=os.path.abspath(os.path.join(os.path.dirname(__file__), '..')), help='Path to fve-mobile directory')
    
    args = parser.parse_args()
    mobile_dir = os.path.abspath(args.mobile_dir)
    res_dir = os.path.join(mobile_dir, 'android/app/src/main/res')
    assets_dir = os.path.join(mobile_dir, 'assets')
    bg_rgb = hex_to_rgb(args.bg_color)
    bg_hex = f"#{bg_rgb[0]:02X}{bg_rgb[1]:02X}{bg_rgb[2]:02X}"
    
    input_source = args.input
    if args.input_file and os.path.exists(args.input_file):
        with open(args.input_file, 'r', encoding='utf-8') as f:
            input_source = f.read().strip()
            
    if not input_source:
        print("[ICONS ERROR] No input image provided via --input or --input-file")
        sys.exit(1)
        
    print(f"[ICONS] Loading source image from: {input_source[:40]}...")
    logo = load_image(input_source, mobile_dir)
    print(f"[ICONS] Loaded source logo: {logo.size} {logo.format or 'RGBA'}")
    
    # 1. Generate master assets in assets/
    os.makedirs(assets_dir, exist_ok=True)
    
    # assets/icon.png (1024x1024)
    master_icon = create_legacy_icon(logo, 1024, bg_rgb, round_corners=False)
    master_icon.save(os.path.join(assets_dir, 'icon.png'), 'PNG')
    
    # assets/android-icon-foreground.png (1024x1024)
    master_foreground = create_adaptive_foreground(logo, 1024)
    master_foreground.save(os.path.join(assets_dir, 'android-icon-foreground.png'), 'PNG')
    
    # assets/android-icon-monochrome.png (1024x1024)
    master_monochrome = create_monochrome(master_foreground)
    master_monochrome.save(os.path.join(assets_dir, 'android-icon-monochrome.png'), 'PNG')
    
    # assets/splash-icon.png (512x512)
    splash_icon = fit_contain(logo, 360, 360)
    splash_canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    splash_canvas.paste(splash_icon, ((512 - splash_icon.width) // 2, (512 - splash_icon.height) // 2), splash_icon)
    splash_canvas.save(os.path.join(assets_dir, 'splash-icon.png'), 'PNG')
    print("[ICONS] Updated master files in fve-mobile/assets/")

    # 2. Generate mipmap densities for Android native
    for density, sizes in DENSITIES.items():
        density_dir = os.path.join(res_dir, f'mipmap-{density}')
        os.makedirs(density_dir, exist_ok=True)
        
        legacy_size = sizes['legacy']
        adaptive_size = sizes['adaptive']
        
        # ic_launcher.webp
        legacy = create_legacy_icon(logo, legacy_size, bg_rgb, round_corners=True)
        legacy.save(os.path.join(density_dir, 'ic_launcher.webp'), 'WEBP', quality=95)
        
        # ic_launcher_round.webp
        circular = create_circular_icon(logo, legacy_size, bg_rgb)
        circular.save(os.path.join(density_dir, 'ic_launcher_round.webp'), 'WEBP', quality=95)
        
        # ic_launcher_foreground.webp
        fg = create_adaptive_foreground(logo, adaptive_size)
        fg.save(os.path.join(density_dir, 'ic_launcher_foreground.webp'), 'WEBP', quality=95)
        
        # ic_launcher_monochrome.webp
        mono = create_monochrome(fg)
        mono.save(os.path.join(density_dir, 'ic_launcher_monochrome.webp'), 'WEBP', quality=95)
        
        print(f"[ICONS] Generated density mipmap-{density} (legacy: {legacy_size}px, adaptive: {adaptive_size}px)")
        
    # 3. Drawable monochrome png
    drawable_dir = os.path.join(res_dir, 'drawable')
    if os.path.exists(drawable_dir):
        mono_drawable = create_monochrome(create_adaptive_foreground(logo, 216))
        mono_drawable.save(os.path.join(drawable_dir, 'ic_launcher_monochrome.png'), 'PNG')

    # 4. Update colors.xml iconBackground
    update_colors_xml(os.path.join(res_dir, 'values/colors.xml'), bg_hex)
    update_colors_xml(os.path.join(res_dir, 'values-night/colors.xml'), bg_hex)
    print(f"[ICONS] Updated iconBackground in colors.xml to {bg_hex}")

    print("[SUCCESS] All Android launcher and adaptive icons successfully generated!")

if __name__ == '__main__':
    main()

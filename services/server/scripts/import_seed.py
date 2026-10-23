
# -*- coding: utf-8 -*-
"""
大理此刻 - Mock 种子数据通过 API 导入
从本地文件读取 mock-data.js 导出的 JSON 数据，调用本地 API 批量导入 MySQL
"""
import pymysql
import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DB_CONFIG

def get_conn():
    return pymysql.connect(**DB_CONFIG, cursorclass=pymysql.cursors.DictCursor, autocommit=True)

def main():
    conn = get_conn()
    cur = conn.cursor()

    try:
        # 1. 清空现有数据
        tables = ['activity_images','activity_tags','live_post_images','live_posts',
                  'community_tags','community_posts','checkin_photos','homepage_photos',
                  'local_life_items','checkin_points','activities','user_bookings',
                  'user_checkins','user_favorites','user_likes','search_history']
        for t in tables:
            cur.execute("DELETE FROM `{}`".format(t))
        conn.commit()

        # 2. 导入活动
        import_activities(cur)
        conn.commit()

        # 3. 导入打卡点
        import_checkin_points(cur)
        conn.commit()

        # 4. 导入现场发文
        import_live_posts(cur)
        conn.commit()

        # 5. 导入社区帖
        import_community_posts(cur)
        conn.commit()

        # 6. 导入打卡照片
        import_checkin_photos(cur)
        conn.commit()

        # 7. 导入首页照片墙
        import_homepage_photos(cur)
        conn.commit()

        # 8. 导入本地生活
        import_local_life(cur)
        conn.commit()

    except Exception:
        conn.rollback()
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

    # 验证
    try:
        verify_conn = get_conn()
        vc = verify_conn.cursor()
        for t in ['activities','activity_tags','activity_images','checkin_points',
                  'live_posts','live_post_images','community_posts','community_tags',
                  'checkin_photos','homepage_photos','local_life_items']:
            vc.execute("SELECT COUNT(*) as cnt FROM `{}`".format(t))
            vc.fetchone()
        vc.close()
        verify_conn.close()
    except Exception:
        pass

# ============ 各数据导入函数 ============

def import_activities(cur):
    acts = get_activities_data()
    for a in acts:
        tags = a.pop('tags', [])
        images = a.pop('images', [])
        fields = list(a.keys())
        ph = ','.join(['%s'] * len(fields))
        sql = "INSERT INTO activities ({}) VALUES ({})".format(','.join(fields), ph)
        cur.execute(sql, [a[f] for f in fields])
        for tag in tags:
            cur.execute("INSERT INTO activity_tags (activity_id, tag) VALUES (%s, %s)", [a['id'], tag])
        for i, img in enumerate(images):
            cur.execute("INSERT INTO activity_images (activity_id, image_url, sort_order, is_cover) VALUES (%s, %s, %s, %s)",
                       [a['id'], img, i, 1 if i == 0 else 0])

def import_checkin_points(cur):
    cps = get_checkin_points_data()
    for cp in cps:
        fields = [k for k in cp.keys()]
        ph = ','.join(['%s'] * len(fields))
        sql = "INSERT INTO checkin_points ({}) VALUES ({})".format(','.join(fields), ph)
        cur.execute(sql, [cp[f] for f in fields])

def import_live_posts(cur):
    lps = get_live_posts_data()
    for lp in lps:
        images = lp.pop('images', [])
        fields = [k for k in lp.keys()]
        ph = ','.join(['%s'] * len(fields))
        sql = "INSERT INTO live_posts ({}) VALUES ({})".format(','.join(fields), ph)
        cur.execute(sql, [lp[f] for f in fields])
        for i, img in enumerate(images):
            cur.execute("INSERT INTO live_post_images (post_id, image_url, sort_order) VALUES (%s, %s, %s)",
                       [lp['id'], img, i])

def import_community_posts(cur):
    cps = get_community_posts_data()
    for cp in cps:
        tags = cp.pop('tags', [])
        fields = [k for k in cp.keys()]
        ph = ','.join(['%s'] * len(fields))
        sql = "INSERT INTO community_posts ({}) VALUES ({})".format(','.join(fields), ph)
        cur.execute(sql, [cp[f] for f in fields])
        for tag in tags:
            cur.execute("INSERT INTO community_tags (post_id, tag) VALUES (%s, %s)", [cp['id'], tag])

def import_checkin_photos(cur):
    phs = get_checkin_photos_data()
    for ph in phs:
        fields = [k for k in ph.keys()]
        pl = ','.join(['%s'] * len(fields))
        sql = "INSERT INTO checkin_photos ({}) VALUES ({})".format(','.join(fields), pl)
        cur.execute(sql, [ph[f] for f in fields])

def import_homepage_photos(cur):
    hps = get_homepage_photos_data()
    for hp in hps:
        fields = [k for k in hp.keys()]
        pl = ','.join(['%s'] * len(fields))
        sql = "INSERT INTO homepage_photos ({}) VALUES ({})".format(','.join(fields), pl)
        cur.execute(sql, [hp[f] for f in fields])

def import_local_life(cur):
    lis = get_local_life_data()
    for li in lis:
        fields = [k for k in li.keys()]
        pl = ','.join(['%s'] * len(fields))
        sql = "INSERT INTO local_life_items ({}) VALUES ({})".format(','.join(fields), pl)
        cur.execute(sql, [li[f] for f in fields])

# ============ 数据定义（全部用转义避免中文引号问题） ============

def get_activities_data():
    return [
        {"id":"act_001","name":"白族绕三灵（预热活动）","type":"folk","type_name":"当地民俗活动",
         "cover":"/images/activities/act_001_raosanling.png","poster":"/images/activities/act_001_raosanling.png",
         "date":"2026-06-03","time":"08:00 - 18:00","time_range":"全天",
         "location":"大理古城城隍庙-崇圣寺-庆洞村圣源寺","district_code":"dali",
         "price":0,"price_text":"免费","is_free":1,"capacity":5000,"remaining":3200,"booked":1800,
         "hot_value":28600,
         "description":"白族绕三灵是国家级非物质文化遗产（2006年第一批，编号IX-41），被誉为白族的狂欢节。",
         "culture_intro":"绕三灵白语称观上览，意为逛山林，起源于南诏时期已有千年历史。",
         "organizer":"大理州文旅局","traffic":"大理古城南门集合出发",
         "notes":"可跟随队伍体验绕三灵民俗","rules":"请尊重民俗传统","status":"active",
         "date_range_start":"2026-06-01","date_range_end":"2026-06-09","duration_days":9,
         "tags":["国家级非遗","民俗","歌舞","绕三灵"],
         "images":["/images/activities/act_001_raosanling.png","/images/photos/photo_003_dance.png"]},
        {"id":"act_002","name":"巍山小吃节（最后一天）","type":"folk","type_name":"当地民俗活动",
         "cover":"/images/activities/act_002_weishan_food.png","poster":"/images/activities/act_002_weishan_food.png",
         "date":"2026-06-03","time":"09:00 - 22:00","time_range":"全天",
         "location":"巍山县古城（南诏镇）","district_code":"weishan",
         "price":0,"price_text":"免费入场","is_free":1,"capacity":10000,"remaining":3500,"booked":6500,
         "hot_value":32500,
         "description":"巍山素有中国名小吃之乡美誉，拥有350多种小吃。",
         "culture_intro":"巍山是南诏国发祥地、国家级历史文化名城。",
         "organizer":"巍山县委县政府",
         "tags":["美食","非遗","彝族文化","小吃"],
         "traffic":"大理古城乘车至巍山约1.5小时",
         "notes":"建议空腹前往品尝各类小吃","rules":"注意食品安全","status":"active",
         "date_range_start":"2026-05-28","date_range_end":"2026-06-03","duration_days":7,
         "images":["/images/activities/act_002_weishan_food.png","/images/photos/photo_004_noodle.png"]},
        {"id":"act_003","name":"栽秧会-白族农耕民俗","type":"folk","type_name":"当地民俗活动",
         "cover":"/images/activity-zaiyanghui.jpg","poster":"/images/activity-zaiyanghui.jpg",
         "date":"2026-06-03","time":"06:00 - 18:00","time_range":"全天",
         "location":"大理市湾桥镇白族村寨","district_code":"dali",
         "price":0,"price_text":"免费","is_free":1,"capacity":500,"remaining":350,"booked":150,
         "hot_value":18500,
         "description":"栽秧会是白族稻作民族将劳动与娱乐结合的传统民俗活动。",
         "culture_intro":"白族是稻作民族，栽秧会体现了白族苦中作乐的农耕文化精神。",
         "organizer":"湾桥镇村委会",
         "tags":["农耕民俗","白族文化","体验","对歌"],
         "traffic":"大理古城北门乘车至湾桥镇约20分钟",
         "notes":"穿防水鞋或拖鞋","rules":"听从秧官指挥","status":"active",
         "date_range_start":"2026-06-03","date_range_end":"2026-06-10","duration_days":8,
         "images":["/images/activity-zaiyanghui.jpg","/images/activity-zaiyanghui.jpg"]},
        {"id":"act_004","name":"天峰山歌会（预热活动）","type":"folk","type_name":"当地民俗活动",
         "cover":"/images/activities/act_004_tianfengshan.png","poster":"/images/activities/act_004_tianfengshan.png",
         "date":"2026-06-03","time":"09:00 - 17:00","time_range":"全天",
         "location":"祥云县普淜镇天峰山（老君山）","district_code":"xiangyun",
         "price":0,"price_text":"免费","is_free":1,"capacity":3000,"remaining":2100,"booked":900,
         "hot_value":15200,
         "description":"天峰山歌会是省级非物质文化遗产。",
         "culture_intro":"天峰山位于祥云、姚安、南华三县交界处。",
         "organizer":"祥云县文旅局",
         "tags":["省级非遗","彝族文化","打歌","道教文化"],
         "traffic":"大理市区乘车至祥云普淜镇约2小时",
         "notes":"天峰山海拔较高注意保暖","rules":"尊重彝族民俗和道教场所规定","status":"active",
         "images":["/images/activities/act_004_tianfengshan.png","/images/checkin/checkin_005_tianfeng.png"]},
        {"id":"act_005","name":"白族本主节-喜洲本主庙会","type":"folk","type_name":"当地民俗活动",
         "cover":"/images/activities/act_005_benzhu.png","poster":"/images/activities/act_005_benzhu.png",
         "date":"2026-06-03","time":"08:00 - 20:00","time_range":"全天",
         "location":"大理市喜洲镇本主庙","district_code":"dali",
         "price":0,"price_text":"免费","is_free":1,"capacity":2000,"remaining":1200,"booked":800,
         "hot_value":12800,
         "description":"白族本主节是白族独有的一种原始宗教崇拜形式。",
         "culture_intro":"本主崇拜是白族特有的民间信仰体系。",
         "organizer":"喜洲镇本主庙管委会",
         "tags":["本主文化","白族信仰","庙会","非遗"],
         "traffic":"大理古城北门乘喜洲专线约30分钟",
         "notes":"可品尝本主饭","rules":"请尊重民间信仰","status":"active",
         "date_range_start":"2026-06-01","date_range_end":"2026-06-05","duration_days":5,
         "images":["/images/activities/act_005_benzhu.png","/images/checkin/checkin_006_benzhu.png"]},
        {"id":"act_006","name":"鸡足山朝山祈福","type":"folk","type_name":"当地民俗活动",
         "cover":"/images/activities/act_006_jizushan.png","poster":"/images/activities/act_006_jizushan.png",
         "date":"2026-06-03","time":"06:00 - 18:00","time_range":"全天",
         "location":"宾川县鸡足山（国家4A级景区）","district_code":"binchuan",
         "price":60,"price_text":"60元/人（门票）","is_free":0,"capacity":3000,"remaining":1800,"booked":1200,
         "hot_value":9500,
         "description":"鸡足山是迦叶菩萨道场，汉传、藏传、南传佛教交汇圣地。",
         "culture_intro":"鸡足山朝山会起源于唐代南诏时期，延续千余年。",
         "organizer":"宾川县人民政府、鸡足山景区",
         "tags":["佛教圣地","朝山","自然风光","祈福"],
         "traffic":"大理市区乘车至鸡足山约1.5小时",
         "notes":"建议乘坐索道上山","rules":"请遵守寺院礼仪","status":"active",
         "date_range_start":"2026-06-01","date_range_end":"2026-06-15","duration_days":15,
         "images":["/images/activities/act_006_jizushan.png","/images/checkin/checkin_007_jinding.png"]},
        {"id":"act_007","name":"海灯会-茈碧湖放灯祈福","type":"folk","type_name":"当地民俗活动",
         "cover":"/images/activities/act_007_hailantern.png","poster":"/images/activities/act_007_hailantern.png",
         "date":"2026-06-03","time":"10:00 - 22:00","time_range":"全天",
         "location":"洱源县茈碧湖河头龙王庙","district_code":"eryuan",
         "price":0,"price_text":"免费","is_free":1,"capacity":3000,"remaining":2000,"booked":1000,
         "hot_value":11200,
         "description":"海灯会是洱源县茈碧湖传统民俗盛会，原为龙王庙会。",
         "culture_intro":"茈碧湖海灯会有一段凄美传说。",
         "organizer":"洱源县文旅局",
         "tags":["民俗","放灯","对歌","水上活动"],
         "traffic":"大理古城乘车至洱源茈碧湖约1小时",
         "notes":"夜晚放灯最为壮观","rules":"放灯时注意用火安全","status":"active",
         "images":["/images/activities/act_007_hailantern.png","/images/activities/act_007_hailantern.png"]},
        {"id":"act_008","name":"白族扎染技艺-非遗工坊体验","type":"folk","type_name":"当地民俗活动",
         "cover":"/images/activities/act_008_tiedye.png","poster":"/images/activities/act_008_tiedye.png",
         "date":"2026-06-03","time":"09:00 - 18:00","time_range":"全天",
         "location":"大理市喜洲镇周城村扎染博物馆","district_code":"dali",
         "price":88,"price_text":"88元/人","is_free":0,"capacity":120,"remaining":35,"booked":85,
         "hot_value":7200,
         "description":"白族扎染技艺是国家级非物质文化遗产（2006年第一批）。",
         "culture_intro":"白族扎染古称绞缬，已有千年历史。",
         "organizer":"喜洲扎染文化传习所",
         "tags":["国家级非遗","手工体验","亲子","文化"],
         "traffic":"大理古城北门乘喜洲/周城专线约40分钟",
         "notes":"穿着深色衣物以防染料沾染","rules":"每人限预约1次","status":"active",
         "images":["/images/activities/act_008_tiedye.png","/images/activities/act_008_tiedye.png"]},
    ]

def get_checkin_points_data():
    return [
        {"id":"checkin_001","name":"崇圣寺-佛都三塔机位","type":"activity","activity_id":"act_001",
         "cover":"/images/checkin/checkin_001_santa.png","latitude":25.7056,"longitude":100.1456,
         "description":"绕三灵第一站-佛都崇圣寺。三塔倒影池可拍到三塔完美倒影。",
         "angle":"蹲在倒影池前，手机贴近水面低角度拍摄",
         "composition":"三塔在画面上方，完整倒影在下方",
         "best_time":"08:00 - 10:00","crowd_level":"拥堵","crowd_peak":"09:00 - 12:00",
         "crowd_morning":"拥堵","crowd_noon":"较多","crowd_afternoon":"舒适","crowd_evening":"舒适",
         "tips":"无风天气倒影最完美","taboos":"请勿向池中投币或扔杂物",
         "landmark":"崇圣寺景区入口左侧倒影池","popularity":9600,"popularity_text":"9.6k人气",
         "charge_type":"charge","charge_price":"75元/人（景区门票）","charge_note":"三塔景区需购票进入","distance":1.2},
        {"id":"checkin_002","name":"圣源寺-神都祭祀机位","type":"activity","activity_id":"act_001",
         "cover":"/images/checkin/checkin_002_shengyuan.png","latitude":25.7901,"longitude":100.1203,
         "description":"绕三灵第二站-神都圣源寺（庆洞村）。",
         "angle":"站在寺庙广场边缘，手机平视广角模式",
         "composition":"前景为打霸王鞭的白族群众","best_time":"15:00 - 19:00",
         "crowd_level":"拥堵","crowd_peak":"16:00 - 20:00",
         "crowd_morning":"空旷","crowd_noon":"舒适","crowd_afternoon":"拥堵","crowd_evening":"拥堵",
         "tips":"傍晚光线最出片","taboos":"请勿打断祭祀仪式",
         "landmark":"庆洞村圣源寺大殿前广场","popularity":7200,"popularity_text":"7.2k人气",
         "charge_type":"free","charge_price":"","charge_note":"","distance":8.5},
        {"id":"checkin_003","name":"巍山古城-拱辰楼机位","type":"activity","activity_id":"act_002",
         "cover":"/images/checkin/checkin_003_gongchen.png","latitude":25.2289,"longitude":100.3089,
         "description":"巍山古城标志性建筑拱辰楼。",
         "angle":"站在拱辰楼对面街道，手机与人眼同高",
         "composition":"拱辰楼在画面上方中央","best_time":"10:00 - 12:00 或 17:00 - 19:00",
         "crowd_level":"拥堵","crowd_peak":"11:00 - 14:00",
         "crowd_morning":"较多","crowd_noon":"拥堵","crowd_afternoon":"拥堵","crowd_evening":"较多",
         "tips":"傍晚华灯初上时城楼最美","taboos":"请勿攀爬城楼",
         "landmark":"巍山古城中心拱辰楼","popularity":8500,"popularity_text":"8.5k人气",
         "charge_type":"free","charge_price":"","charge_note":"","distance":52.3},
        {"id":"checkin_004","name":"湾桥稻田-栽秧会田间机位","type":"activity","activity_id":"act_003",
         "cover":"/images/checkin/checkin_004_ricefield.png","latitude":25.7812,"longitude":100.1056,
         "description":"湾桥镇白族村寨稻田，苍山为背景的栽秧场景。",
         "angle":"站在田埂上，手机低角度拍摄",
         "composition":"前景为栽秧的白族群众","best_time":"07:00 - 10:00",
         "crowd_level":"舒适","crowd_peak":"09:00 - 11:00",
         "crowd_morning":"舒适","crowd_noon":"较多","crowd_afternoon":"舒适","crowd_evening":"空旷",
         "tips":"清晨水田如镜面倒映苍山最出片","taboos":"请勿踩踏秧苗",
         "landmark":"湾桥镇白族村寨稻田","popularity":5400,"popularity_text":"5.4k人气",
         "charge_type":"free","charge_price":"","charge_note":"","distance":6.8},
        {"id":"checkin_005","name":"天峰山-老君殿观景机位","type":"activity","activity_id":"act_004",
         "cover":"/images/checkin/checkin_005_tianfeng.png","latitude":25.3956,"longitude":100.8234,
         "description":"天峰山老君殿前观景平台。",
         "angle":"站在平台边缘，手机广角模式",
         "composition":"前景为彝族打跳人群","best_time":"10:00 - 12:00",
         "crowd_level":"较多","crowd_peak":"10:00 - 14:00",
         "crowd_morning":"舒适","crowd_noon":"较多","crowd_afternoon":"较多","crowd_evening":"舒适",
         "tips":"雨后初晴云海最壮观","taboos":"请勿进入道观禁地",
         "landmark":"天峰山老君殿前广场","popularity":3800,"popularity_text":"3.8k人气",
         "charge_type":"free","charge_price":"","charge_note":"","distance":68.7},
        {"id":"checkin_006","name":"喜洲本主庙-祭祀巡游机位","type":"activity","activity_id":"act_005",
         "cover":"/images/checkin/checkin_006_benzhu.png","latitude":25.8567,"longitude":100.1134,
         "description":"喜洲镇本主庙前，抬本主神像巡游全村的盛大场面。",
         "angle":"站在巡游路线旁，手机低角度仰拍",
         "composition":"本主神像居中","best_time":"09:00 - 11:00",
         "crowd_level":"拥堵","crowd_peak":"09:00 - 12:00",
         "crowd_morning":"拥堵","crowd_noon":"较多","crowd_afternoon":"舒适","crowd_evening":"舒适",
         "tips":"跟随巡游队伍可拍到连续动态画面","taboos":"请勿触摸本主神像",
         "landmark":"喜洲镇本主庙正门","popularity":6100,"popularity_text":"6.1k人气",
         "charge_type":"free","charge_price":"","charge_note":"","distance":18.3},
        {"id":"checkin_007","name":"鸡足山-金顶日出机位","type":"activity","activity_id":"act_006",
         "cover":"/images/checkin/checkin_007_jinding.png","latitude":25.9567,"longitude":100.3956,
         "description":"鸡足山金顶（天柱峰）海拔3248米。",
         "angle":"站在金顶平台，手机正对东方日出方向",
         "composition":"楞严塔在画面右侧三分之一处","best_time":"06:00 - 07:30",
         "crowd_level":"较多","crowd_peak":"06:30 - 07:30",
         "crowd_morning":"较多","crowd_noon":"舒适","crowd_afternoon":"舒适","crowd_evening":"空旷",
         "tips":"凌晨4:30出发乘索道可赶上日出","taboos":"金顶为佛教圣地",
         "landmark":"鸡足山金顶寺楞严塔前平台","popularity":8800,"popularity_text":"8.8k人气",
         "charge_type":"charge","charge_price":"60元/人（门票）+ 75元/人（索道）",
         "charge_note":"鸡足山景区门票及索道需购票","distance":42.5},
        {"id":"scenic_001","name":"大理古城-南城门","type":"scenic","activity_id":None,
         "cover":"/images/checkin/scenic_001_nanmen.png","latitude":25.6756,"longitude":100.1623,
         "description":"大理古城标志性建筑，始建于明洪武十五年。",
         "angle":"站在南门广场中央，手机与人眼同高",
         "composition":"人物居中，城门完整入镜","best_time":"08:00 - 10:00 或 17:00 - 19:00",
         "crowd_level":"拥堵","crowd_peak":"10:00 - 16:00",
         "crowd_morning":"舒适","crowd_noon":"拥堵","crowd_afternoon":"拥堵","crowd_evening":"较多",
         "tips":"清晨人少光影好","taboos":"请勿攀爬城墙",
         "landmark":"古城南门（文献楼）","popularity":12500,"popularity_text":"12.5k人气",
         "charge_type":"free","charge_price":"","charge_note":"","distance":0.5},
        {"id":"scenic_002","name":"崇圣寺三塔-倒影池","type":"scenic","activity_id":None,
         "cover":"/images/checkin/scenic_002_santa.png","latitude":25.7056,"longitude":100.1456,
         "description":"崇圣寺三塔是大理标志性景观。",
         "angle":"蹲在倒影池前，手机贴近水面",
         "composition":"三塔在画面上方，完整倒影在下方","best_time":"09:00 - 11:00",
         "crowd_level":"较多","crowd_peak":"10:00 - 15:00",
         "crowd_morning":"舒适","crowd_noon":"较多","crowd_afternoon":"拥堵","crowd_evening":"舒适",
         "tips":"无风天气倒影最完美","taboos":"请勿向池中投币或扔杂物",
         "landmark":"崇圣寺景区入口左侧倒影池","popularity":11000,"popularity_text":"11k人气",
         "charge_type":"charge","charge_price":"75元/人（景区门票）",
         "charge_note":"崇圣寺三塔文化旅游区需购票","distance":1.2},
        {"id":"scenic_003","name":"蝴蝶泉-情人湖畔","type":"scenic","activity_id":None,
         "cover":"/images/checkin/scenic_003_butterfly.png","latitude":25.9034,"longitude":100.0856,
         "description":"蝴蝶泉位于大理市周城村附近。",
         "angle":"站在蝴蝶泉边，手机平视","composition":"人物在泉边",
         "best_time":"09:00 - 11:00 或 15:00 - 17:00","crowd_level":"舒适","crowd_peak":"10:00 - 14:00",
         "crowd_morning":"舒适","crowd_noon":"较多","crowd_afternoon":"舒适","crowd_evening":"空旷",
         "tips":"4-5月蝴蝶最多","taboos":"请勿捕捉蝴蝶",
         "landmark":"蝴蝶泉公园内蝴蝶泉边","popularity":7800,"popularity_text":"7.8k人气",
         "charge_type":"charge","charge_price":"40元/人（景区门票）",
         "charge_note":"蝴蝶泉公园需购票进入","distance":26.8},
        {"id":"scenic_004","name":"沙溪古镇-寺登街","type":"scenic","activity_id":None,
         "cover":"/images/checkin/scenic_004_shaxi.png","latitude":26.3156,"longitude":99.8534,
         "description":"沙溪古镇是茶马古道上唯一幸存的古集市。",
         "angle":"站在寺登街古戏台对面","composition":"古戏台在画面中央",
         "best_time":"08:00 - 10:00 或 16:00 - 18:00","crowd_level":"舒适","crowd_peak":"11:00 - 15:00",
         "crowd_morning":"空旷","crowd_noon":"舒适","crowd_afternoon":"较多","crowd_evening":"舒适",
         "tips":"清晨薄雾中的寺登街最有韵味","taboos":"保护古镇风貌",
         "landmark":"沙溪古镇寺登街古戏台前","popularity":6500,"popularity_text":"6.5k人气",
         "charge_type":"free","charge_price":"","charge_note":"","distance":85.3},
    ]

def get_live_posts_data():
    return [
        {"id":"live_001","activity_id":"act_002","activity_name":"巍山小吃节",
         "user_name":"吃货小分队","user_avatar":"/images/icon-camera.png","type":"image",
         "content":"巍山小吃节最后一天赶上了！一根面现场拉太震撼了，高台社火巡游也超精彩",
         "location":"巍山古城南诏镇","post_date":"2026-05-28","post_time":"12:30",
         "like_count":456,"comment_count":78,"share_count":123,"is_verified":1,
         "images":["/images/photos/Weishan_food_festival__chef_st_2026-06-04T01-10-57.png",
                  "/images/photos/Traditional_Chinese_parade_wit_2026-06-04T01-11-38.png"]},
        {"id":"live_002","activity_id":"act_001","activity_name":"白族绕三灵",
         "user_name":"文化探索者","user_avatar":"/images/icon-camera.png","type":"image",
         "content":"绕三灵预热活动开始了！听非遗传承人赵丕鼎老师讲绕三灵千年历史",
         "location":"大理古城城隍庙","post_date":"2026-05-29","post_time":"10:15",
         "like_count":328,"comment_count":56,"share_count":89,"is_verified":1,
         "images":["/images/photos/Bai_ethnic_dance_performance___2026-06-04T01-12-10.png",
                  "/images/activities/act_001_raosanling.png",
                  "/images/checkin/checkin_002_shengyuan.png"]},
        {"id":"live_003","activity_id":"act_003","activity_name":"栽秧会",
         "user_name":"大理慢生活","user_avatar":"/images/icon-camera.png","type":"video",
         "content":"第一次参加栽秧会！白族阿姐们在田里边栽秧边对歌，苍山为背景美得像画",
         "cover":"/images/checkin/checkin_004_ricefield.png","video_url":"",
         "location":"大理市湾桥镇","post_date":"2026-05-30","post_time":"09:45",
         "like_count":267,"comment_count":45,"share_count":72,"is_verified":1,"images":[]},
        {"id":"live_004","activity_id":"act_006","activity_name":"鸡足山朝山祈福",
         "user_name":"旅行者小陈","user_avatar":"/images/icon-camera.png","type":"image",
         "content":"鸡足山金顶日出太震撼了！云海翻涌，楞严塔金光万丈，不虚此行",
         "location":"宾川鸡足山金顶","post_date":"2026-05-31","post_time":"06:45",
         "like_count":512,"comment_count":89,"share_count":156,"is_verified":1,
         "images":["/images/photos/photo_007_sunrise.png"]},
        {"id":"live_005","activity_id":"act_005","activity_name":"喜洲本主庙会",
         "user_name":"摄影师大鹏","user_avatar":"/images/icon-camera.png","type":"image",
         "content":"喜洲本主庙会巡游现场！舞龙舞狮、霸王鞭、白剧表演，白族民俗盛宴",
         "location":"喜洲古镇本主庙","post_date":"2026-06-01","post_time":"10:30",
         "like_count":389,"comment_count":67,"share_count":98,"is_verified":1,
         "images":["/images/checkin/checkin_006_benzhu.png","/images/activities/act_005_benzhu.png"]},
        {"id":"live_006","activity_id":"act_007","activity_name":"海灯会",
         "user_name":"手工爱好者","user_avatar":"/images/icon-camera.png","type":"image",
         "content":"茈碧湖海灯会太美了！万盏莲花灯漂浮湖面，白族三弦弹唱回荡夜空",
         "location":"洱源茈碧湖","post_date":"2026-06-02","post_time":"20:15",
         "like_count":445,"comment_count":72,"share_count":134,"is_verified":1,
         "images":["/images/activities/act_007_hailantern.png","/images/activities/act_007_hailantern.png"]},
    ]

def get_community_posts_data():
    return [
        {"id":"comm_001","user_name":"非遗守望者","user_avatar":"/images/icon-camera.png",
         "title":"2026白族绕三灵全攻略","cover":"/images/activities/act_001_raosanling.png",
         "content":"绕三灵是白族最盛大的狂欢节，今年会期为农历四月二十三至二十五（6月7-9日）。",
         "post_date":"2026-06-01","like_count":2356,"comment_count":412,"view_count":28900,
         "tags":["绕三灵","国家级非遗","攻略","白族"]},
        {"id":"comm_002","user_name":"吃货小分队","user_avatar":"/images/icon-camera.png",
         "title":"巍山小吃节终极指南","cover":"/images/activities/act_002_weishan_food.png",
         "content":"巍山是中国名小吃之乡，小吃节期间350多种小吃云集古城。",
         "post_date":"2026-05-29","like_count":1892,"comment_count":356,"view_count":22300,
         "tags":["巍山","美食","小吃节","探店"]},
        {"id":"comm_003","user_name":"摄影师大鹏","user_avatar":"/images/icon-camera.png",
         "title":"大理六月民俗摄影指南","cover":"/images/checkin/checkin_007_jinding.png",
         "content":"六月是大理民俗活动最密集的月份之一。",
         "post_date":"2026-05-28","like_count":3100,"comment_count":489,"view_count":35600,
         "tags":["摄影","民俗","六月","攻略"]},
    ]

def get_checkin_photos_data():
    return [
        {"id":"photo_001","checkin_id":"checkin_001","user_name":"旅行摄影师小王","user_avatar":"/images/icon-camera.png",
         "image_url":"/images/photos/photo_santa_sunrise.png","shoot_date":"2026-06-02","shoot_time":"07:15",
         "weather":"晴","temperature":"22C","device":"iPhone 15 Pro","lens":"广角",
         "description":"清晨的三塔倒影池太美了","like_count":238,"is_liked":0},
        {"id":"photo_002","checkin_id":"checkin_001","user_name":"大理慢时光","user_avatar":"/images/icon-camera.png",
         "image_url":"/images/photos/photo_santa_sunset.png","shoot_date":"2026-06-01","shoot_time":"18:45",
         "weather":"多云转晴","temperature":"25C","device":"华为 Mate 60 Pro","lens":"长焦",
         "description":"傍晚的崇圣寺在晚霞映照下金光灿烂","like_count":156,"is_liked":1},
        {"id":"photo_003","checkin_id":"checkin_002","user_name":"民俗记录者","user_avatar":"/images/icon-camera.png",
         "image_url":"/images/photos/photo_003_dance.png","shoot_date":"2026-06-02","shoot_time":"16:30",
         "weather":"晴","temperature":"27C","device":"Sony A7M4","lens":"24-70mm",
         "description":"圣源寺广场的霸王鞭表演","like_count":312,"is_liked":0},
        {"id":"photo_004","checkin_id":"checkin_003","user_name":"吃货摄影师","user_avatar":"/images/icon-camera.png",
         "image_url":"/images/photos/photo_004_noodle.png","shoot_date":"2026-06-01","shoot_time":"11:20",
         "weather":"晴间多云","temperature":"28C","device":"iPhone 14 Pro Max","lens":"广角",
         "description":"拱辰楼下的小吃摊位烟火气十足","like_count":189,"is_liked":0},
        {"id":"photo_005","checkin_id":"checkin_004","user_name":"田园漫步者","user_avatar":"/images/icon-camera.png",
         "image_url":"/images/photos/photo_005_rice.png","shoot_date":"2026-06-03","shoot_time":"07:30",
         "weather":"晴","temperature":"20C","device":"富士 X-T5","lens":"35mm定焦",
         "description":"清晨的湾桥稻田像一面镜子","like_count":276,"is_liked":1},
        {"id":"photo_006","checkin_id":"checkin_004","user_name":"人文纪实阿飞","user_avatar":"/images/icon-camera.png",
         "image_url":"/images/photos/photo_006_singing.png","shoot_date":"2026-06-02","shoot_time":"09:00",
         "weather":"晴转多云","temperature":"23C","device":"尼康 Z8","lens":"70-200mm",
         "description":"秧官吹唢呐指挥栽秧的瞬间","like_count":198,"is_liked":0},
        {"id":"photo_007","checkin_id":"checkin_007","user_name":"追光者小李","user_avatar":"/images/icon-camera.png",
         "image_url":"/images/photos/photo_007_sunrise.png","shoot_date":"2026-06-02","shoot_time":"06:12",
         "weather":"晴","temperature":"8C","device":"iPhone 15 Pro Max","lens":"超广角",
         "description":"鸡足山金顶日出，云海翻涌中楞严塔金光万丈","like_count":523,"is_liked":0},
        {"id":"photo_008","checkin_id":"checkin_007","user_name":"山间行者","user_avatar":"/images/icon-camera.png",
         "image_url":"/images/photos/photo_008_huashou.png","shoot_date":"2026-06-01","shoot_time":"10:30",
         "weather":"多云","temperature":"12C","device":"小米 14 Ultra","lens":"广角",
         "description":"华首门前朝山的信众络绎不绝","like_count":167,"is_liked":0},
        {"id":"photo_009","checkin_id":"scenic_001","user_name":"古城故事多","user_avatar":"/images/icon-camera.png",
         "image_url":"/images/photos/photo_009_nanmen.png","shoot_date":"2026-06-02","shoot_time":"08:15",
         "weather":"晴","temperature":"21C","device":"华为 P70 Pro","lens":"广角",
         "description":"清晨的古城南门几乎没有游客","like_count":345,"is_liked":1},
        {"id":"photo_010","checkin_id":"scenic_002","user_name":"倒影猎人","user_avatar":"/images/icon-camera.png",
         "image_url":"/images/photos/photo_010_reflection.png","shoot_date":"2026-06-01","shoot_time":"09:45",
         "weather":"晴","temperature":"23C","device":"OPPO Find X7 Ultra","lens":"广角",
         "description":"无风的早晨，倒影池水平如镜","like_count":289,"is_liked":0},
        {"id":"photo_011","checkin_id":"scenic_003","user_name":"蝴蝶泉边","user_avatar":"/images/icon-camera.png",
         "image_url":"/images/photos/photo_011_butterfly.png","shoot_date":"2026-06-02","shoot_time":"15:30",
         "weather":"晴转多云","temperature":"26C","device":"vivo X100 Pro","lens":"人像模式",
         "description":"蝴蝶泉边的古合欢树开花了","like_count":201,"is_liked":0},
        {"id":"photo_012","checkin_id":"scenic_004","user_name":"茶马古道行者","user_avatar":"/images/icon-camera.png",
         "image_url":"/images/photos/photo_012_shaxi.png","shoot_date":"2026-06-01","shoot_time":"07:50",
         "weather":"多云","temperature":"18C","device":"富士 X100VI","lens":"23mm定焦",
         "description":"清晨薄雾中的寺登街","like_count":178,"is_liked":0},
    ]

def get_homepage_photos_data():
    return [
        {"id":"hp_001","image_url":"/images/photos/photo_003_dance.png","user_name":"旅行摄影师小王","user_avatar":"/images/icon-camera.png","shoot_date":"2026-06-03","weather":"晴","temperature":"25C","like_count":328,"is_liked":0,"sort_order":1},
        {"id":"hp_002","image_url":"/images/photos/photo_004_noodle.png","user_name":"吃货小分队","user_avatar":"/images/icon-camera.png","shoot_date":"2026-06-02","weather":"多云","temperature":"28C","like_count":512,"is_liked":0,"sort_order":2},
        {"id":"hp_003","image_url":"/images/photos/photo_005_rice.png","user_name":"田园漫步者","user_avatar":"/images/icon-camera.png","shoot_date":"2026-06-03","weather":"晴","temperature":"20C","like_count":276,"is_liked":1,"sort_order":3},
        {"id":"hp_004","image_url":"/images/photos/photo_007_sunrise.png","user_name":"追光者小李","user_avatar":"/images/icon-camera.png","shoot_date":"2026-06-01","weather":"晴","temperature":"8C","like_count":523,"is_liked":0,"sort_order":4},
        {"id":"hp_005","image_url":"/images/checkin/checkin_006_benzhu.png","user_name":"摄影师大鹏","user_avatar":"/images/icon-camera.png","shoot_date":"2026-06-02","weather":"阴转晴","temperature":"24C","like_count":389,"is_liked":0,"sort_order":5},
        {"id":"hp_006","image_url":"/images/activities/act_007_hailantern.png","user_name":"手工爱好者","user_avatar":"/images/icon-camera.png","shoot_date":"2026-06-01","weather":"多云","temperature":"22C","like_count":445,"is_liked":1,"sort_order":6},
        {"id":"hp_007","image_url":"/images/activities/act_004_tianfengshan.png","user_name":"民俗记录者","user_avatar":"/images/icon-camera.png","shoot_date":"2026-05-28","weather":"晴","temperature":"26C","like_count":198,"is_liked":0,"sort_order":7},
        {"id":"hp_008","image_url":"/images/photos/photo_010_reflection.png","user_name":"倒影猎人","user_avatar":"/images/icon-camera.png","shoot_date":"2026-05-25","weather":"晴","temperature":"23C","like_count":289,"is_liked":0,"sort_order":8},
        {"id":"hp_009","image_url":"/images/photos/photo_012_shaxi.png","user_name":"茶马古道行者","user_avatar":"/images/icon-camera.png","shoot_date":"2026-05-20","weather":"小雨","temperature":"18C","like_count":178,"is_liked":0,"sort_order":9},
        {"id":"hp_010","image_url":"/images/activities/act_002_weishan_food.png","user_name":"大理慢生活","user_avatar":"/images/icon-camera.png","shoot_date":"2026-05-15","weather":"多云","temperature":"25C","like_count":201,"is_liked":0,"sort_order":10},
        {"id":"hp_011","image_url":"/images/activities/act_008_tiedye.png","user_name":"非遗守望者","user_avatar":"/images/icon-camera.png","shoot_date":"2026-05-10","weather":"晴","temperature":"27C","like_count":156,"is_liked":0,"sort_order":11},
        {"id":"hp_012","image_url":"/images/photos/photo_011_butterfly.png","user_name":"蝴蝶泉边","user_avatar":"/images/icon-camera.png","shoot_date":"2026-06-03","weather":"晴","temperature":"26C","like_count":201,"is_liked":0,"sort_order":12},
    ]

def get_local_life_data():
    return [
        {"id":"food_001","category":"food","name":"再回首凉鸡米线","cover":"/images/activities/act_002_weishan_food.png","item_type":"本地小吃","rating":4.7,"price":"人均15元","location":"大理古城人民路198号","description":"大理古城30年老店","sort_order":1},
        {"id":"food_002","category":"food","name":"巍山一根面","cover":"/images/photos/photo_004_noodle.png","item_type":"特色小吃","rating":4.8,"price":"人均12元","location":"巍山古城南诏镇","description":"巍山名小吃，一碗只有一根面","sort_order":2},
        {"id":"food_003","category":"food","name":"喜洲粑粑老店","cover":"/images/checkin/checkin_006_benzhu.png","item_type":"特色小吃","rating":4.8,"price":"人均10元","location":"喜洲古镇四方街口","description":"现烤现卖的喜洲粑粑","sort_order":3},
        {"id":"food_004","category":"food","name":"永平黄焖鸡","cover":"/images/checkin/checkin_003_gongchen.png","item_type":"地方名菜","rating":4.6,"price":"人均45元","location":"永平县博南镇曲硐老街","description":"永平特色美食名片","sort_order":4},
        {"id":"hotel_001","category":"hotel","name":"洱海醒来海景民宿","cover":"/images/photos/photo_011_butterfly.png","item_type":"精品民宿","rating":4.8,"price":"380元起/晚","location":"洱海生态廊道旁","description":"","sort_order":5},
        {"id":"hotel_002","category":"hotel","name":"大理古城既下山酒店","cover":"/images/photos/photo_009_nanmen.png","item_type":"设计师酒店","rating":4.6,"price":"680元起/晚","location":"大理古城叶榆路","description":"","sort_order":6},
        {"id":"hotel_003","category":"hotel","name":"沙溪古镇等风青径客栈","cover":"/images/photos/photo_012_shaxi.png","item_type":"古镇客栈","rating":4.7,"price":"280元起/晚","location":"剑川县沙溪古镇寺登街","description":"","sort_order":7},
        {"id":"shop_001","category":"shop","name":"周城扎染博物馆","cover":"/images/activities/act_008_tiedye.png","item_type":"非遗体验","rating":4.7,"price":"","location":"大理市喜洲镇周城村","description":"","sort_order":8},
        {"id":"shop_002","category":"shop","name":"剑川木雕艺术馆","cover":"/images/activities/act_008_tiedye.png","item_type":"非遗手工艺","rating":4.6,"price":"","location":"剑川县金华镇","description":"","sort_order":9},
        {"id":"shop_003","category":"shop","name":"鹤庆银器一条街","cover":"/images/checkin/checkin_005_tianfeng.png","item_type":"手工艺街区","rating":4.5,"price":"","location":"鹤庆县草海镇新华村","description":"","sort_order":10},
    ]

if __name__ == '__main__':
    main()

import json
import subprocess
import tempfile
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Danh sách 26 mã sản phẩm cũ/lỗi ảnh cần dọn sạch
OLD_PRODUCT_IDS = [
    "PROD_BRAKE_003",
    "PROD_ACC_001",
    "PROD_OIL_002",
    "PROD_DRIVE_001",
    "PROD_OIL_001",
    "PROD_OIL_003",
    "PROD_DRIVE_003",
    "PROD_TYRE_002",
    "PROD_SHOCK_002",
    "PROD_SPARK_002",
    "PROD_BRK_001",
    "PROD_BRAKE_002",
    "PROD_BRAKE_001",
    "PROD_NEW_923",
    "PROD_LIGHT_001",
    "PROD_TYRE_001",
    "PROD_FILTER_001",
    "PROD_SUSP_001",
    "PROD_DRV_002",
    "PROD_DRIVE_002",
    "PROD_NEW_961",
    "PROD_FORK_001",
    "PROD_SPARK_001",
    "PROD_EXHAUST_001",
    "PROD_SUSP_002",
    "PROD_BATT_001",
]

# Danh sách 32 sản phẩm thực tế kèm ảnh chụp studio thực tế trên S3 CloudFront (-real.jpg để bypass cache cũ)
products = [
    # --- 1. TRUYỀN ĐỘNG (5 sản phẩm) ---
    {
        "ProductID": "PROD_DRV_010",
        "name": "Bộ nhông sên dĩa DID 428HDS Vàng 10 ly",
        "category": "Truyền động",
        "price": 480000,
        "stock": 35,
        "brand": "DID",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/did-428hds-real.jpg",
        "image_urls": ["/images/did-428hds-real.jpg"],
        "description": "Sên mạ vàng 10 ly chịu lực kéo cao, êm ái khi chạy tốc độ cao, chống giãn vượt trội.",
        "compatible_models": ["Winner 150", "Winner X", "Exciter 150", "Sonic 150"],
        "created_at": "2026-10-30T10:00:00Z"
    },
    {
        "ProductID": "PROD_DRV_011",
        "name": "Bộ nhông sên dĩa Recto chính hãng Thái Lan 428",
        "category": "Truyền động",
        "price": 320000,
        "stock": 50,
        "brand": "Recto",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/nhong-sen-did-real.jpg",
        "image_urls": ["/images/nhong-sen-did-real.jpg"],
        "description": "Nhông dĩa thép carbon C45 tôi cao tần, vận hành bền bỉ cho dòng xe số phổ thông.",
        "compatible_models": ["Wave Alpha", "Wave RSX", "Future 125", "Sirius"],
        "created_at": "2026-10-29T10:00:00Z"
    },
    {
        "ProductID": "PROD_DRV_012",
        "name": "Dây curoa Bando chính hãng Nhật Bản",
        "category": "Truyền động",
        "price": 390000,
        "stock": 40,
        "brand": "Bando",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/day-curoa-bando-real.jpg",
        "image_urls": ["/images/day-curoa-bando-real.jpg"],
        "description": "Dây curoa cao su tổng hợp chịu nhiệt cao, truyền lực mượt mà, chống trượt nồi xe tay ga.",
        "compatible_models": ["Air Blade 125", "Air Blade 150", "Vario 150", "Lead 125"],
        "created_at": "2026-10-28T10:00:00Z"
    },
    {
        "ProductID": "PROD_DRV_013",
        "name": "Bộ bi nồi FCC chính hãng Honda",
        "category": "Truyền động",
        "price": 180000,
        "stock": 60,
        "brand": "FCC",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/bi-noi-fcc-real.jpg",
        "image_urls": ["/images/bi-noi-fcc-real.jpg"],
        "description": "Bộ 6 viên bi nồi chuẩn trọng lượng zin giúp xe tăng tốc mượt, tiết kiệm nhiên liệu.",
        "compatible_models": ["Vision", "Air Blade 125", "SH Mode", "Vario 125"],
        "created_at": "2026-10-27T10:00:00Z"
    },
    {
        "ProductID": "PROD_DRV_014",
        "name": "Bộ chuông nồi & bố 3 càng FCC chống rung đầu",
        "category": "Truyền động",
        "price": 750000,
        "stock": 25,
        "brand": "FCC",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/chuong-noi-bo-ba-cang-real.jpg",
        "image_urls": ["/images/chuong-noi-bo-ba-cang-real.jpg"],
        "description": "Chuông nồi sau kèm cụm bố 3 càng hợp kim carbon khắc phục dứt điểm bệnh rung ga đầu xe tay ga.",
        "compatible_models": ["Air Blade 125", "Air Blade 150", "Vario 150", "SH 150i", "Vision"],
        "created_at": "2026-10-26T10:00:00Z"
    },

    # --- 2. HỆ THỐNG PHANH (6 sản phẩm) ---
    {
        "ProductID": "PROD_BRK_010",
        "name": "Bố thắng đĩa trước Elig EM050 Ceramic",
        "category": "Hệ thống phanh",
        "price": 150000,
        "stock": 80,
        "brand": "Elig",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/elig-em050-real.jpg",
        "image_urls": ["/images/elig-em050-real.jpg"],
        "description": "Má phanh gốm Ceramic hiệu suất cao, không kêu, không ăn mòn đĩa phanh, tản nhiệt nhanh.",
        "compatible_models": ["Exciter 150", "Exciter 155", "Winner X", "Sirius FI"],
        "created_at": "2026-10-25T10:00:00Z"
    },
    {
        "ProductID": "PROD_BRK_011",
        "name": "Heo dầu Brembo 2 Pis đối xứng chính hãng",
        "category": "Hệ thống phanh",
        "price": 2850000,
        "stock": 12,
        "brand": "Brembo",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/heo-dau-brembo-real.jpg",
        "image_urls": ["/images/heo-dau-brembo-real.jpg"],
        "description": "Heo phanh Brembo 2 piston đối xứng lực bóp thắng cực nhạy, an toàn khi phanh gấp.",
        "compatible_models": ["Exciter 150", "Exciter 155", "Winner X", "Vario 150", "SH 150i"],
        "created_at": "2026-10-24T10:00:00Z"
    },
    {
        "ProductID": "PROD_BRK_012",
        "name": "Đĩa thắng RCB lòng nhôm CNC 245mm",
        "category": "Hệ thống phanh",
        "price": 650000,
        "stock": 25,
        "brand": "RCB",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/dia-thang-rcb-real.jpg",
        "image_urls": ["/images/dia-thang-rcb-real.jpg"],
        "description": "Đĩa phanh thép không gỉ kết hợp lòng nhôm CNC sắc nét, tản nhiệt nhanh, chống cong vênh.",
        "compatible_models": ["Exciter 150", "Winner 150", "Winner X"],
        "created_at": "2026-10-23T10:00:00Z"
    },
    {
        "ProductID": "PROD_BRK_013",
        "name": "Tay thắng bình dầu RCB E2 chính hãng",
        "category": "Hệ thống phanh",
        "price": 520000,
        "stock": 30,
        "brand": "RCB",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/tay-thang-rcb-real.jpg",
        "image_urls": ["/images/tay-thang-rcb-real.jpg"],
        "description": "Cùm tay thắng RCB chính hãng cho cảm giác bóp êm tay, tăng lực dầu phanh ổn định.",
        "compatible_models": ["Wave Alpha", "Exciter 150", "Winner X", "Vario 150"],
        "created_at": "2026-10-22T10:00:00Z"
    },
    {
        "ProductID": "PROD_BRK_014",
        "name": "Dây dầu phanh bấm đầu CNC chống phù HEL",
        "category": "Hệ thống phanh",
        "price": 450000,
        "stock": 35,
        "brand": "HEL",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/day-dau-hel-brembo-real.jpg",
        "image_urls": ["/images/day-dau-hel-brembo-real.jpg"],
        "description": "Dây dầu lõi lưới thép không gỉ bọc Teflon chịu áp suất dầu phanh cao, bóp thắng dứt khoát.",
        "compatible_models": ["Exciter 150", "Exciter 155", "Winner X", "Vario 150", "Sonic 150"],
        "created_at": "2026-10-21T10:00:00Z"
    },
    {
        "ProductID": "PROD_BRK_015",
        "name": "Bộ bố thắng đùm sau chính hãng kèm lò xo",
        "category": "Hệ thống phanh",
        "price": 120000,
        "stock": 70,
        "brand": "Yamaha",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/bo-thang-dum-yamaha-real.jpg",
        "image_urls": ["/images/bo-thang-dum-yamaha-real.jpg"],
        "description": "Guốc phanh đùm hợp kim nhôm đúc chuẩn đường kính tăng-bua, phanh êm không kêu rít.",
        "compatible_models": ["Sirius", "Wave Alpha", "Vision", "Future 125", "Lead 125"],
        "created_at": "2026-10-20T10:00:00Z"
    },

    # --- 3. GIẢM XÓC (4 sản phẩm) ---
    {
        "ProductID": "PROD_SUS_010",
        "name": "Phuộc sau YSS G-Series bình dầu chính hãng",
        "category": "Giảm xóc",
        "price": 2450000,
        "stock": 18,
        "brand": "YSS",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/phuoc-yss-real.jpg",
        "image_urls": ["/images/phuoc-yss-real.jpg"],
        "description": "Phuộc bình dầu YSS Thái Lan tăng chỉnh độ nén lò xo, đầm chắc khi ôm cua và chở nặng.",
        "compatible_models": ["Vario 150", "Air Blade 150", "Vision", "SH Mode"],
        "created_at": "2026-10-19T10:00:00Z"
    },
    {
        "ProductID": "PROD_SUS_011",
        "name": "Phuộc bình dầu RCB VD Series cao cấp",
        "category": "Giảm xóc",
        "price": 3600000,
        "stock": 10,
        "brand": "RCB",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/phuoc-rcb-vd-real.jpg",
        "image_urls": ["/images/phuoc-rcb-vd-real.jpg"],
        "description": "Phuộc đơn Monoshock có tăng chỉnh Rebound & Compression đầy đủ, ti mạ vàng chống trầy.",
        "compatible_models": ["Exciter 150", "Exciter 155", "Winner X"],
        "created_at": "2026-10-18T10:00:00Z"
    },
    {
        "ProductID": "PROD_SUS_012",
        "name": "Bộ chén cổ SKF chính hãng chống kêu cụp",
        "category": "Giảm xóc",
        "price": 350000,
        "stock": 45,
        "brand": "SKF",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/chen-co-skf-real.jpg",
        "image_urls": ["/images/chen-co-skf-real.jpg"],
        "description": "Chén cổ bi đũa chịu lực SKF khắc phục triệt để tiếng kêu lộc cộc khi qua ổ gà.",
        "compatible_models": ["Exciter 150", "Winner X", "Air Blade 125", "SH 150i"],
        "created_at": "2026-10-17T10:00:00Z"
    },
    {
        "ProductID": "PROD_SUS_013",
        "name": "Cặp ti phuộc trước mạ Chrome kèm phốt chắn bụi",
        "category": "Giảm xóc",
        "price": 580000,
        "stock": 22,
        "brand": "KYB",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/ti-phuoc-truoc-zin-real.jpg",
        "image_urls": ["/images/ti-phuoc-truoc-zin-real.jpg"],
        "description": "Cặp ti phuộc trước mạ Chrome cứng chống trầy xước, kèm bộ phốt dầu chống xì nhớt phuộc.",
        "compatible_models": ["Exciter 150", "Winner X", "Wave Alpha", "Sirius", "Vario 150"],
        "created_at": "2026-10-16T10:00:00Z"
    },

    # --- 4. ĐỘNG CƠ (4 sản phẩm) ---
    {
        "ProductID": "PROD_ENG_010",
        "name": "Lọc gió K&N chính hãng tăng lưu lượng khí nạp",
        "category": "Động cơ",
        "price": 1150000,
        "stock": 20,
        "brand": "K&N",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/loc-gio-k-n-real.jpg",
        "image_urls": ["/images/loc-gio-k-n-real.jpg"],
        "description": "Lọc gió vải tẩm dầu K&N vệ sinh tái sử dụng trọn đời, giúp ga đầu nhẹ và bốc hơn.",
        "compatible_models": ["Exciter 150", "Winner 150", "Winner X", "Vario 150"],
        "created_at": "2026-10-15T10:00:00Z"
    },
    {
        "ProductID": "PROD_ENG_011",
        "name": "Bộ lá côn nồi FCC chính hãng chống trượt côn",
        "category": "Động cơ",
        "price": 380000,
        "stock": 35,
        "brand": "FCC",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/la-con-fcc-real.jpg",
        "image_urls": ["/images/la-con-fcc-real.jpg"],
        "description": "Bộ 5 lá bố nồi FCC Nhật Bản độ bám cao, sang số nhẹ nhàng, chịu nhiệt dầu máy tốt.",
        "compatible_models": ["Exciter 150", "Winner 150", "Winner X", "Sonic 150"],
        "created_at": "2026-10-14T10:00:00Z"
    },
    {
        "ProductID": "PROD_ENG_012",
        "name": "Bộ lòng piston bạc STD chính hãng Yamaha",
        "category": "Động cơ",
        "price": 1450000,
        "stock": 15,
        "brand": "Yamaha",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/long-piston-yamaha-real.jpg",
        "image_urls": ["/images/long-piston-yamaha-real.jpg"],
        "description": "Xy-lanh Kiếng DiASil kèm trái piston nén, bạc, ắc, phe cài đồng bộ chính hãng.",
        "compatible_models": ["Exciter 150", "Exciter 155", "FZ150i"],
        "created_at": "2026-10-13T10:00:00Z"
    },
    {
        "ProductID": "PROD_ENG_013",
        "name": "Bộ trục cam & cò mổ con lăn chịu nhiệt UMA Racing",
        "category": "Động cơ",
        "price": 890000,
        "stock": 16,
        "brand": "UMA Racing",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/truc-cam-co-uma-real.jpg",
        "image_urls": ["/images/truc-cam-co-uma-real.jpg"],
        "description": "Trục cam thép CNC kèm cặp cò mổ bi lăn giảm ma sát, giúp động cơ êm và bốc ở tua cao.",
        "compatible_models": ["Exciter 150", "Exciter 135", "Sirius", "Wave Alpha"],
        "created_at": "2026-10-12T10:00:00Z"
    },

    # --- 5. ĐIỆN - ĐÈN (4 sản phẩm) ---
    {
        "ProductID": "PROD_ELC_010",
        "name": "Bugi NGK Iridium CPR8EAIX-9 bạch kim đánh lửa mạnh",
        "category": "Điện - Đèn",
        "price": 240000,
        "stock": 75,
        "brand": "NGK",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/bugi-ngk-iridium-real.jpg",
        "image_urls": ["/images/bugi-ngk-iridium-real.jpg"],
        "description": "Đầu điện cực Iridium siêu mảnh 0.6mm đốt sạch nhiên liệu, nhạy nổ máy, tiết kiệm xăng.",
        "compatible_models": ["Exciter 150", "Winner X", "Air Blade 150", "Vario 150", "SH 150i"],
        "created_at": "2026-10-11T10:00:00Z"
    },
    {
        "ProductID": "PROD_ELC_011",
        "name": "Bình ắc quy Globe WTZ6V 12V-6Ah khô miễn bảo dưỡng",
        "category": "Điện - Đèn",
        "price": 360000,
        "stock": 40,
        "brand": "Globe",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/ac-quy-globe-real.jpg",
        "image_urls": ["/images/ac-quy-globe-real.jpg"],
        "description": "Ắc quy khô kín khí dòng phóng ổn định, chuyên dùng cho xe có hệ thống Idling Stop.",
        "compatible_models": ["Air Blade 125", "Vision", "Lead 125", "Winner X", "Vario 150"],
        "created_at": "2026-10-10T10:00:00Z"
    },
    {
        "ProductID": "PROD_ELC_012",
        "name": "Bóng đèn pha LED Osram chân H4 tăng sáng",
        "category": "Điện - Đèn",
        "price": 390000,
        "stock": 30,
        "brand": "Osram",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/den-led-osram-real.jpg",
        "image_urls": ["/images/den-led-osram-real.jpg"],
        "description": "Bóng LED Osram gom sáng chuẩn, không gây chói mắt người đối diện, tiết kiệm điện bình.",
        "compatible_models": ["Wave RSX", "Sirius", "Future 125", "Exciter 135"],
        "created_at": "2026-10-09T10:00:00Z"
    },
    {
        "ProductID": "PROD_ELC_013",
        "name": "Đèn trợ sáng Bi-LED Mini Kenzo chống nước IP68",
        "category": "Điện - Đèn",
        "price": 680000,
        "stock": 28,
        "brand": "Kenzo",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/den-tro-sang-biled-real.jpg",
        "image_urls": ["/images/den-tro-sang-biled-real.jpg"],
        "description": "Đèn trợ sáng Bi-LED 2 chế độ Cos vàng phá sương / Pha trắng gom cắt sáng văn minh.",
        "compatible_models": ["Winner X", "Exciter 150", "Exciter 155", "ADV 150", "Vario 150"],
        "created_at": "2026-10-08T10:00:00Z"
    },

    # --- 6. NHỚT - LỌC (5 sản phẩm) ---
    {
        "ProductID": "PROD_OIL_010",
        "name": "Nhớt Motul 300V Factory Line Road Racing 10W40 1L",
        "category": "Nhớt - Lọc",
        "price": 420000,
        "stock": 65,
        "brand": "Motul",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/motul-300v-real.jpg",
        "image_urls": ["/images/motul-300v-real.jpg"],
        "description": "Nhớt tổng hợp 100% công nghệ Ester Core bảo vệ động cơ tối đa ở vòng tua cao.",
        "compatible_models": ["Winner 150", "Winner X", "Exciter 150", "Exciter 155", "Sonic 150"],
        "created_at": "2026-10-30T11:00:00Z"
    },
    {
        "ProductID": "PROD_OIL_011",
        "name": "Nhớt tay ga Liqui Moly Molygen Scooter 5W30 0.8L",
        "category": "Nhớt - Lọc",
        "price": 265000,
        "stock": 55,
        "brand": "Liqui Moly",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/liqui-moly-scooter-real.jpg",
        "image_urls": ["/images/liqui-moly-scooter-real.jpg"],
        "description": "Nhớt tổng hợp nhập khẩu Đức tích hợp phụ gia chống mài mòn, mát máy cho xe tay ga.",
        "compatible_models": ["SH 150i", "SH Mode", "Air Blade 150", "Vario 150", "Vision"],
        "created_at": "2026-10-07T10:00:00Z"
    },
    {
        "ProductID": "PROD_OIL_012",
        "name": "Lọc nhớt K&N KN-153 chính hãng lọc cặn kim loại",
        "category": "Nhớt - Lọc",
        "price": 195000,
        "stock": 50,
        "brand": "K&N",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/loc-nhot-kn-real.jpg",
        "image_urls": ["/images/loc-nhot-kn-real.jpg"],
        "description": "Lọc nhớt lưu lượng cao giữ sạch mạt kim loại trong động cơ, bảo vệ bơm nhớt và cam cò.",
        "compatible_models": ["Exciter 150", "Exciter 155", "FZ150i", "R15 V3"],
        "created_at": "2026-10-06T10:00:00Z"
    },
    {
        "ProductID": "PROD_OIL_013",
        "name": "Chai xịt dưỡng sên Motul C4 Chain Lube Factory Line",
        "category": "Nhớt - Lọc",
        "price": 255000,
        "stock": 48,
        "brand": "Motul",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/xit-sen-motul-c4-real.jpg",
        "image_urls": ["/images/xit-sen-motul-c4-real.jpg"],
        "description": "Xịt bôi trơn sên trần chuyên dụng bám dính cao, chống văng và chống nước mưa.",
        "compatible_models": ["Exciter 150", "Exciter 155", "Winner X", "Sonic 150", "R15 V3"],
        "created_at": "2026-10-05T10:00:00Z"
    },
    {
        "ProductID": "PROD_OIL_014",
        "name": "Nước làm mát két nước Motul Motocool Expert 1L",
        "category": "Nhớt - Lọc",
        "price": 175000,
        "stock": 60,
        "brand": "Motul",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/nuoc-lam-mat-motul-real.jpg",
        "image_urls": ["/images/nuoc-lam-mat-motul-real.jpg"],
        "description": "Dung dịch giải nhiệt động cơ pha sẵn nhiệt độ sôi 135 độ C, chống đóng cặn két nước.",
        "compatible_models": ["Vario 150", "Air Blade 150", "SH 150i", "Exciter 150", "Winner X"],
        "created_at": "2026-10-04T10:00:00Z"
    },

    # --- 7. LỐP - VỎ XE (2 sản phẩm) ---
    {
        "ProductID": "PROD_TYR_010",
        "name": "Lốp không ruột Michelin Pilot Street 2 120/70-17",
        "category": "Lốp - Vỏ xe",
        "price": 1180000,
        "stock": 24,
        "brand": "Michelin",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/lop-michelin-pilot-real.jpg",
        "image_urls": ["/images/lop-michelin-pilot-real.jpg"],
        "description": "Vỏ xe Michelin rãnh gai thoát nước thế hệ mới bám đường cực tốt khi ôm cua trời mưa.",
        "compatible_models": ["Exciter 150", "Exciter 155", "Winner 150", "Winner X"],
        "created_at": "2026-10-03T10:00:00Z"
    },
    {
        "ProductID": "PROD_TYR_011",
        "name": "Cặp lốp không ruột Maxxis Kim Cương 3D cho xe tay ga",
        "category": "Lốp - Vỏ xe",
        "price": 920000,
        "stock": 30,
        "brand": "Maxxis",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/lop-maxxis-khong-ruot-real.jpg",
        "image_urls": ["/images/lop-maxxis-khong-ruot-real.jpg"],
        "description": "Cặp vỏ trước 80/90-14 và sau 90/90-14 cao su dày dặn, chống ăn đinh và bền bỉ.",
        "compatible_models": ["Air Blade 125", "Air Blade 150", "Vario 125", "Vario 150", "Vision"],
        "created_at": "2026-10-02T10:00:00Z"
    },

    # --- 8. PHỤ KIỆN - PÔ XE (2 sản phẩm) ---
    {
        "ProductID": "PROD_ACC_010",
        "name": "Lon pô thể thao ốp Carbon kèm tiêu giảm thanh",
        "category": "Phụ kiện - Pô xe",
        "price": 1650000,
        "stock": 14,
        "brand": "Akrapovic",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/po-akrapovic-carbon-real.jpg",
        "image_urls": ["/images/po-akrapovic-carbon-real.jpg"],
        "description": "Lon pô inox 304 chụp đít sợi Carbon chịu nhiệt, âm thanh trầm ấm uy lực kèm ống tiêu.",
        "compatible_models": ["Exciter 150", "Exciter 155", "Winner X", "R15 V3", "Sonic 150"],
        "created_at": "2026-10-01T10:00:00Z"
    },
    {
        "ProductID": "PROD_ACC_011",
        "name": "Cặp kính chiếu hậu nhôm CNC chống chói RCB",
        "category": "Phụ kiện - Pô xe",
        "price": 420000,
        "stock": 32,
        "brand": "RCB",
        "status": "ACTIVE",
        "is_active": True,
        "image_url": "/images/kinh-hau-cnc-rcb-real.jpg",
        "image_urls": ["/images/kinh-hau-cnc-rcb-real.jpg"],
        "description": "Gương chiếu hậu thân nhôm CNC nguyên khối cứng cáp, mặt kính xanh chống chói ban đêm.",
        "compatible_models": ["SH 150i", "Vario 150", "Exciter 150", "Winner X", "Air Blade 150"],
        "created_at": "2026-09-30T10:00:00Z"
    },
]


def to_dynamodb_attr(val):
    if isinstance(val, bool):
        return {"BOOL": val}
    if isinstance(val, (int, float)):
        return {"N": str(val)}
    if isinstance(val, str):
        return {"S": val}
    if isinstance(val, list):
        return {"L": [to_dynamodb_attr(x) for x in val]}
    if isinstance(val, dict):
        return {"M": {k: to_dynamodb_attr(v) for k, v in val.items()}}
    return {"S": str(val)}


def run_batch_write(table_name, requests):
    for i in range(0, len(requests), 25):
        chunk = requests[i : i + 25]
        payload = {table_name: chunk}
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="ascii") as tmp:
            json.dump(payload, tmp, ensure_ascii=True)
            tmp_path = tmp.name
        try:
            subprocess.run(
                [
                    "aws",
                    "dynamodb",
                    "batch-write-item",
                    "--region",
                    "ap-southeast-1",
                    "--request-items",
                    f"file://{tmp_path}",
                ],
                check=True,
                shell=(os.name == "nt"),
            )
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--table", default="Products_Replica", help="Ten bang DynamoDB")
    args = parser.parse_args()
    table_name = args.table

    print(f"[*] Dang nap du lieu vao bang DynamoDB: '{table_name}'...")
    delete_requests = [
        {"DeleteRequest": {"Key": {"ProductID": {"S": pid}}}}
        for pid in OLD_PRODUCT_IDS
    ]
    run_batch_write(table_name, delete_requests)

    put_requests = [
        {"PutRequest": {"Item": {k: to_dynamodb_attr(v) for k, v in p.items()}}}
        for p in products
    ]
    run_batch_write(table_name, put_requests)
    for p in products:
        print(f"Da nap: {p['ProductID']} - {p['name']}")
    print(f"[+] Hoan tat! Bang '{table_name}' hien co {len(products)} san pham thuc te!")

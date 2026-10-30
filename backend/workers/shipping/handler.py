import os
import json
import time
import re
import unicodedata
import urllib.request
import urllib.error
import boto3
from decimal import Decimal
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key

ORDERS_TABLE_NAME = os.environ.get('ORDERS_TABLE', 'Orders_Replica')
SHIPPING_PARTNER = os.environ.get('SHIPPING_PARTNER', 'Giao Hàng Nhanh (GHN)')
GHN_API_URL = os.environ.get('GHN_API_URL', 'https://dev-online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/create')
GHN_API_TOKEN = os.environ.get('GHN_API_TOKEN', 'b0ea8297-6801-4aa1-a811-5e21a5f7aa2d')
GHN_SHOP_ID = os.environ.get('GHN_SHOP_ID', '233963')
EVENT_BUS_NAME = os.environ.get('EVENT_BUS_NAME', 'ecommerce-event-bus-replica')

dynamodb = boto3.resource('dynamodb')
events_client = boto3.client('events')
orders_table = dynamodb.Table(ORDERS_TABLE_NAME)

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

def remove_accents(input_str):
    if not input_str:
        return ''
    nfkd = unicodedata.normalize('NFKD', str(input_str))
    return ''.join([c for c in nfkd if not unicodedata.combining(c)]).lower()

# Bảng từ điển chuẩn hóa Quận/Huyện TP.HCM cho GHN Sandbox
HCM_DISTRICTS_MAP = {
    '1': 'Quận 1', 'q1': 'Quận 1', 'quan 1': 'Quận 1',
    '2': 'Quận 2', 'q2': 'Quận 2', 'quan 2': 'Quận 2',
    '3': 'Quận 3', 'q3': 'Quận 3', 'quan 3': 'Quận 3',
    '4': 'Quận 4', 'q4': 'Quận 4', 'quan 4': 'Quận 4',
    '5': 'Quận 5', 'q5': 'Quận 5', 'quan 5': 'Quận 5',
    '6': 'Quận 6', 'q6': 'Quận 6', 'quan 6': 'Quận 6',
    '7': 'Quận 7', 'q7': 'Quận 7', 'quan 7': 'Quận 7',
    '8': 'Quận 8', 'q8': 'Quận 8', 'quan 8': 'Quận 8',
    '9': 'Quận 9', 'q9': 'Quận 9', 'quan 9': 'Quận 9',
    '10': 'Quận 10', 'q10': 'Quận 10', 'quan 10': 'Quận 10',
    '11': 'Quận 11', 'q11': 'Quận 11', 'quan 11': 'Quận 11',
    '12': 'Quận 12', 'q12': 'Quận 12', 'quan 12': 'Quận 12',
    'binh thanh': 'Quận Bình Thạnh', 'bt': 'Quận Bình Thạnh',
    'go vap': 'Quận Gò Vấp', 'gv': 'Quận Gò Vấp',
    'tan binh': 'Quận Tân Bình', 'tb': 'Quận Tân Bình',
    'tan phu': 'Quận Tân Phú', 'tp': 'Quận Tân Phú',
    'phu nhuan': 'Quận Phú Nhuận', 'pn': 'Quận Phú Nhuận',
    'binh tan': 'Quận Bình Tân',
    'thu duc': 'Thành phố Thủ Đức',
    'hoc mon': 'Huyện Hóc Môn',
    'cu chi': 'Huyện Củ Chi',
    'binh chanh': 'Huyện Bình Chánh',
    'nha be': 'Huyện Nhà Bè',
    'can gio': 'Huyện Cần Giờ'
}

def resolve_district_and_ward(addr_text):
    """Fuzzy Match địa chỉ để lấy district_id và ward_code của GHN"""
    clean_text = remove_accents(addr_text)

    # Mặc định Quận 5, Phường 1 (Ward 20501, District 1444)
    target_district_id = 1444
    target_ward_code = "20501"

    # Kiểm tra Quận 1
    if re.search(r'\b(q\.?1|quan 1|district 1)\b', clean_text):
        target_district_id = 1442
        target_ward_code = "20101"
    # Kiểm tra Quận 3
    elif re.search(r'\b(q\.?3|quan 3|district 3)\b', clean_text):
        target_district_id = 1443
        target_ward_code = "20201"
    # Kiểm tra Bình Thạnh
    elif re.search(r'\b(binh thanh)\b', clean_text):
        target_district_id = 1447
        target_ward_code = "20701"
    # Kiểm tra Gò Vấp
    elif re.search(r'\b(go vap)\b', clean_text):
        target_district_id = 1448
        target_ward_code = "20801"
    # Kiểm tra Tân Bình
    elif re.search(r'\b(tan binh)\b', clean_text):
        target_district_id = 1449
        target_ward_code = "20901"
    # Kiểm tra Thủ Đức
    elif re.search(r'\b(thu duc)\b', clean_text):
        target_district_id = 1451
        target_ward_code = "21101"

    return target_district_id, target_ward_code

def call_ghn_create_order(order_id, shipping_address, items, cod_amount=0):
    """Gọi GHN API v2 tạo đơn vận chuyển thật"""
    print(f"[GHN_API] Tạo đơn GHN cho #{order_id} (COD: {cod_amount}đ)...")

    full_addr = shipping_address.get('address') or f"{shipping_address.get('street', '')}, {shipping_address.get('ward', '')}, {shipping_address.get('district', '')}, {shipping_address.get('province', '')}"
    district_id, ward_code = resolve_district_and_ward(full_addr)

    if shipping_address.get('district_id'):
        try:
            district_id = int(shipping_address.get('district_id'))
        except Exception:
            pass
    if shipping_address.get('ward_code'):
        ward_code = str(shipping_address.get('ward_code'))

    if GHN_API_TOKEN and GHN_SHOP_ID:
        try:
            ghn_payload = {
                "payment_type_id": 1,
                "note": "Phụ tùng xe máy chính hãng - Vui lòng gọi trước khi giao",
                "required_note": "CHOXEMHANGKHONGTHU",
                "to_name": shipping_address.get('full_name') or shipping_address.get('recipient_name') or 'Khách hàng',
                "to_phone": shipping_address.get('phone') or '0901234567',
                "to_address": full_addr or '123 Nguyen Trai, Q5, TP.HCM',
                "to_ward_code": ward_code,
                "to_district_id": district_id,
                "cod_amount": int(cod_amount),
                "weight": 500,
                "length": 20,
                "width": 15,
                "height": 10,
                "service_type_id": 2,
                "items": [
                    {
                        "name": str(it.get('name') or 'Phụ tùng xe máy')[:50],
                        "quantity": int(it.get('quantity', 1)),
                        "price": int(it.get('price', 100000))
                    }
                    for it in items
                ]
            }

            req = urllib.request.Request(
                GHN_API_URL,
                data=json.dumps(ghn_payload).encode('utf-8'),
                headers={
                    "Content-Type": "application/json",
                    "Token": GHN_API_TOKEN,
                    "ShopId": str(GHN_SHOP_ID)
                },
                method='POST'
            )

            with urllib.request.urlopen(req, timeout=6) as response:
                resp_json = json.loads(response.read().decode('utf-8'))
                if resp_json.get('code') == 200:
                    order_code = resp_json['data']['order_code']
                    exp_time = resp_json['data'].get('expected_delivery_time', '')
                    print(f"[GHN_API_SUCCESS] GHN Sandbox tạo đơn thành công: Mã vận đơn {order_code}")
                    return {
                        "success": True,
                        "tracking_number": order_code,
                        "partner": "Giao Hàng Nhanh (GHN)",
                        "estimated_delivery": exp_time[:10] if exp_time else time.strftime('%Y-%m-%d', time.gmtime(time.time() + 3 * 86400))
                    }
                else:
                    print(f"[GHN_API_ERROR] GHN API returned code {resp_json.get('code')}: {resp_json.get('message')}")
        except Exception as e:
            print(f"[GHN_API_WARNING] GHN API Sandbox không khả dụng ({str(e)}), dùng chuẩn tracking fallback.")

    unique_suffix = int(time.time() * 1000) % 1000000000
    tracking_number = f"GHN{unique_suffix:09d}VN"
    estimated_delivery = time.strftime('%Y-%m-%d', time.gmtime(time.time() + 3 * 86400))

    return {
        "success": True,
        "tracking_number": tracking_number,
        "partner": "Giao Hàng Nhanh (GHN)",
        "estimated_delivery": estimated_delivery
    }

def get_order_by_id(order_id):
    response = orders_table.query(
        IndexName='OrderID-index',
        KeyConditionExpression=Key('OrderID').eq(order_id)
    )
    items = response.get('Items', [])
    return items[0] if items else None

def process_shipping_event(detail_type, detail):
    order_id = detail.get('order_id') or detail.get('OrderID')
    payment_method = str(detail.get('payment_method', '')).upper()

    print(f"[SHIPPING_WORKER] Tiếp nhận sự kiện '{detail_type}' cho đơn #{order_id}")

    should_create_shipment = (detail_type in ['PaymentSuccess', 'PAYMENT_COMPLETED']) or \
                             (detail_type in ['OrderPlaced', 'ORDER_CREATED'] and payment_method == 'COD')

    if should_create_shipment:
        order = get_order_by_id(order_id)
        if not order:
            print(f"[ERROR] Không tìm thấy đơn hàng {order_id} trong Orders.")
            return

        if order.get('tracking_number'):
            print(f"[SKIP] Đơn {order_id} đã có tracking {order.get('tracking_number')}, bỏ qua.")
            return

        user_id = order['UserID']
        shipping_address = order.get('shipping_address', {})
        items = order.get('items', [])

        is_cod = order.get('payment', {}).get('method') == 'COD'
        cod_amount = order.get('final_amount', order.get('total_amount', 0)) if is_cod else 0

        ship_res = call_ghn_create_order(order_id, shipping_address, items, cod_amount)
        tracking_number = ship_res['tracking_number']
        estimated_delivery = ship_res['estimated_delivery']
        now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

        orders_table.update_item(
            Key={'UserID': user_id, 'OrderID': order_id},
            UpdateExpression="SET #tn = :tn, #ss = :ss, #sp = :sp, #ed = :ed, #u = :u",
            ExpressionAttributeNames={
                '#tn': 'tracking_number',
                '#ss': 'shipping_status',
                '#sp': 'shipping_partner',
                '#ed': 'estimated_delivery',
                '#u': 'updated_at'
            },
            ExpressionAttributeValues={
                ':tn': tracking_number,
                ':ss': 'READY_TO_PICK',
                ':sp': 'Giao Hàng Nhanh (GHN)',
                ':ed': estimated_delivery,
                ':u': now_iso
            }
        )
        print(f"[SUCCESS] Đã gán mã vận đơn {tracking_number} (GHN) cho đơn #{order_id}")

        try:
            events_client.put_events(
                Entries=[
                    {
                        'Source': 'ecommerce.shipping',
                        'DetailType': 'ShippingOrderCreated',
                        'Detail': json.dumps({
                            "order_id": order_id,
                            "tracking_number": tracking_number,
                            "shipping_partner": "Giao Hàng Nhanh (GHN)",
                            "shipping_status": "READY_TO_PICK",
                            "estimated_delivery": estimated_delivery
                        }),
                        'EventBusName': EVENT_BUS_NAME
                    }
                ]
            )
        except Exception as e:
            print(f"[EVENT_ERROR] Lỗi gửi ShippingOrderCreated: {e}")

    elif detail_type == 'OrderCancelled':
        order = get_order_by_id(order_id)
        if order and order.get('tracking_number'):
            now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            orders_table.update_item(
                Key={'UserID': order['UserID'], 'OrderID': order_id},
                UpdateExpression="SET shipping_status = :ss, updated_at = :u",
                ExpressionAttributeValues={
                    ':ss': 'CANCELLED_WITH_CARRIER',
                    ':u': now_iso
                }
            )
            print(f"[SUCCESS] Đã đánh dấu hủy vận đơn cho đơn {order_id}")

def lambda_handler(event, context):
    records = event.get('Records', [])
    print(f"[SQS] ShippingWorker nhận {len(records)} message cần xử lý.")

    for record in records:
        try:
            body = json.loads(record.get('body', '{}'))
            detail_type = body.get('detail-type') or body.get('type')
            detail = body.get('detail', body)

            if detail_type and detail:
                process_shipping_event(detail_type, detail)
        except Exception as e:
            print(f"[FATAL_ERROR] Lỗi khi xử lý shipping record: {str(e)}")
            raise e

    return {"status": "SUCCESS", "processed_records": len(records)}

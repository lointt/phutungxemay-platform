import os
import json
import time
import uuid
import hmac
import hashlib
import urllib.parse
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key

ORDERS_TABLE_NAME = os.environ.get('ORDERS_TABLE', 'Orders_Replica')
CARTS_TABLE_NAME = os.environ.get('CARTS_TABLE', 'Carts_Replica')
PRODUCTS_TABLE_NAME = os.environ.get('PRODUCTS_TABLE', 'Products_Replica')
EVENT_BUS_NAME = os.environ.get('EVENT_BUS_NAME', 'ecommerce-event-bus-replica')

VNPAY_URL = os.environ.get('VNPAY_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html')
VNPAY_TMN_CODE = os.environ.get('VNPAY_TMN_CODE', '2QXUI4J4')
VNPAY_HASH_SECRET = os.environ.get('VNPAY_HASH_SECRET', 'RAHQKBUFUIZLMTMDIPOSYMPS')
VNPAY_RETURN_URL = os.environ.get('VNPAY_RETURN_URL', 'https://d1yvm1htsd670r.cloudfront.net/order-success')

dynamodb = boto3.resource('dynamodb')
events_client = boto3.client('events')

orders_table = dynamodb.Table(ORDERS_TABLE_NAME)
carts_table = dynamodb.Table(CARTS_TABLE_NAME)
products_table = dynamodb.Table(PRODUCTS_TABLE_NAME)

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

def build_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization"
        },
        "body": json.dumps(body, cls=DecimalEncoder, ensure_ascii=False)
    }

def get_auth_context(event):
    """Lấy user_id và kiểm tra quyền Admin từ context Cognito hoặc Headers/Query"""
    claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
    user_id = claims.get('sub') or event.get('headers', {}).get('x-user-id') or (event.get('queryStringParameters') or {}).get('userId')
    
    groups = claims.get('cognito:groups', [])
    if isinstance(groups, str):
        is_admin = 'Admins' in groups
    elif isinstance(groups, list):
        is_admin = 'Admins' in groups
    else:
        is_admin = False
        
    return user_id, is_admin

def publish_event(detail_type, detail_payload):
    """Phát sự kiện lên Amazon EventBridge"""
    try:
        events_client.put_events(
            Entries=[
                {
                    'Source': 'ecommerce.orders',
                    'DetailType': detail_type,
                    'Detail': json.dumps(detail_payload, cls=DecimalEncoder),
                    'EventBusName': EVENT_BUS_NAME
                }
            ]
        )
    except Exception as e:
        print(f"[ERROR] Không thể gửi event {detail_type} tới EventBridge: {str(e)}")

def create_vnpay_payment_url(order_id, amount, ip_addr, order_desc=""):
    """
    Tạo VNPay Payment URL với thuật toán mã hóa chuẩn HMAC-SHA512.
    VNPay yêu cầu số tiền nhân 100 và múi giờ GMT+7.
    """
    vnp_amount = int(Decimal(str(amount)) * 100)
    
    tz_gmt7 = timezone(timedelta(hours=7))
    create_date = datetime.now(tz_gmt7).strftime('%Y%m%d%H%M%S')
    
    vnp_params = {
        'vnp_Version': '2.1.0',
        'vnp_Command': 'pay',
        'vnp_TmnCode': VNPAY_TMN_CODE,
        'vnp_Amount': str(vnp_amount),
        'vnp_CurrCode': 'VND',
        'vnp_TxnRef': str(order_id),
        'vnp_OrderInfo': order_desc or f"Thanh toan don hang {order_id}",
        'vnp_OrderType': 'other',
        'vnp_Locale': 'vn',
        'vnp_ReturnUrl': VNPAY_RETURN_URL,
        'vnp_IpAddr': ip_addr or '127.0.0.1',
        'vnp_CreateDate': create_date
    }
    
    sorted_params = sorted(vnp_params.items())
    hash_data = '&'.join([f"{k}={urllib.parse.quote_plus(str(v))}" for k, v in sorted_params])
    
    secure_hash = hmac.new(
        VNPAY_HASH_SECRET.encode('utf-8'),
        hash_data.encode('utf-8'),
        hashlib.sha512
    ).hexdigest()
    
    payment_url = f"{VNPAY_URL}?{hash_data}&vnp_SecureHash={secure_hash}"
    return payment_url

def lambda_handler(event, context):
    http_method = event.get('httpMethod', '')
    path_parameters = event.get('pathParameters') or {}
    order_id = path_parameters.get('id')
    user_id, is_admin = get_auth_context(event)

    try:
        # 1. POST /orders: TẠO ĐƠN HÀNG
        if http_method == 'POST':
            if not user_id:
                return build_response(401, {"message": "Yêu cầu đăng nhập hoặc cung cấp UserID để đặt hàng."})

            body = json.loads(event.get('body', '{}'))
            shipping_address = body.get('shipping_address')
            payment_method = body.get('payment_method', 'COD').upper()

            if not shipping_address:
                return build_response(400, {"message": "Thông tin shipping_address là bắt buộc."})

            claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
            customer_email = (
                body.get('customer_email')
                or shipping_address.get('email')
                or claims.get('email')
                or ''
            )
            if customer_email and not shipping_address.get('email'):
                shipping_address['email'] = customer_email

            # Lấy giỏ hàng của user
            cart_resp = carts_table.get_item(Key={'CartID': user_id})
            cart = cart_resp.get('Item')
            
            # Hỗ trợ nhận trực tiếp items từ request body (checkout tức thì) hoặc từ giỏ
            items = body.get('items') or (cart.get('items') if cart else [])
            if not items:
                return build_response(400, {"message": "Giỏ hàng đang trống, không thể tạo đơn hàng."})

            total_amount = Decimal(str(sum(Decimal(str(it.get('price', 0))) * Decimal(str(it.get('quantity', 1))) for it in items)))
            
            # Chính sách phí ship: Miễn phí nếu >= 500k, ngược lại 30.000 VNĐ
            shipping_fee = Decimal('0') if total_amount >= Decimal('500000') else Decimal('30000')
            final_amount = total_amount + shipping_fee

            new_order_id = f"ORD_{int(time.time())}_{str(uuid.uuid4())[:6].upper()}"
            created_at = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

            new_order = {
                "OrderID": new_order_id,
                "order_id": new_order_id,
                "UserID": user_id,
                "user_id": user_id,
                "customer_email": customer_email,
                "items": items,
                "total_amount": total_amount,
                "shipping_fee": shipping_fee,
                "final_amount": final_amount,
                "shipping_address": shipping_address,
                "payment": {
                    "method": payment_method,
                    "status": "PENDING"
                },
                "order_status": "PLACED",
                "created_at": created_at,
                "updated_at": created_at
            }

            # Lưu đơn hàng vào DynamoDB
            orders_table.put_item(Item=new_order)

            # Xóa giỏ hàng tạm sau khi đã tạo đơn
            try:
                carts_table.delete_item(Key={'CartID': user_id})
            except Exception:
                pass

            # Tạo link thanh toán VNPay nếu chọn VNPAY
            payment_url = None
            if payment_method == 'VNPAY':
                client_ip = (
                    event.get('headers', {}).get('X-Forwarded-For', '').split(',')[0].strip()
                    or event.get('requestContext', {}).get('identity', {}).get('sourceIp')
                    or '127.0.0.1'
                )
                payment_url = create_vnpay_payment_url(
                    order_id=new_order_id,
                    amount=final_amount,
                    ip_addr=client_ip,
                    order_desc=f"Thanh toan don hang {new_order_id}"
                )

            # Phát sự kiện OrderPlaced lên EventBridge
            publish_event('OrderPlaced', {
                "order_id": new_order_id,
                "OrderID": new_order_id,
                "user_id": user_id,
                "customer_email": customer_email,
                "items": items,
                "total_amount": total_amount,
                "shipping_fee": shipping_fee,
                "final_amount": final_amount,
                "payment_method": payment_method,
                "shipping_address": shipping_address,
                "created_at": created_at
            })

            resp_payload = {
                "message": "Đặt hàng thành công!",
                "order": new_order,
                "order_id": new_order_id,
                "OrderID": new_order_id
            }
            if payment_url:
                resp_payload["payment_url"] = payment_url

            return build_response(201, resp_payload)

        # 2. GET /orders: XEM DANH SÁCH ĐƠN HÀNG
        elif http_method == 'GET' and not order_id:
            if is_admin:
                response = orders_table.scan(Limit=50)
                return build_response(200, {
                    "role": "Admin",
                    "orders": response.get('Items', []),
                    "count": response.get('Count', 0)
                })

            if not user_id:
                return build_response(401, {"message": "Yêu cầu đăng nhập để xem đơn hàng."})

            response = orders_table.query(
                KeyConditionExpression=Key('UserID').eq(user_id),
                ScanIndexForward=False
            )
            return build_response(200, {
                "role": "Customer",
                "orders": response.get('Items', []),
                "count": response.get('Count', 0)
            })

        # 3. GET /orders/{id}: XEM CHI TIẾT ĐƠN (Tra cứu qua GSI)
        elif http_method == 'GET' and order_id:
            response = orders_table.query(
                IndexName='OrderID-index',
                KeyConditionExpression=Key('OrderID').eq(order_id)
            )
            items = response.get('Items', [])
            if not items:
                return build_response(404, {"message": f"Không tìm thấy đơn hàng {order_id}"})

            order = items[0]
            # Public order tracking cho phép xem chi tiết đơn hàng nếu có order_id
            return build_response(200, order)

        # 4. PUT /orders/{id}: ADMIN CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG
        elif http_method == 'PUT' and order_id:
            if not is_admin:
                return build_response(403, {"message": "Chỉ có Admin mới có quyền cập nhật trạng thái đơn."})

            body = json.loads(event.get('body', '{}'))
            new_status = body.get('order_status')
            tracking_number = body.get('tracking_number')

            query_resp = orders_table.query(
                IndexName='OrderID-index',
                KeyConditionExpression=Key('OrderID').eq(order_id)
            )
            items = query_resp.get('Items', [])
            if not items:
                return build_response(404, {"message": f"Không tìm thấy đơn hàng {order_id}"})

            order_owner_id = items[0]['UserID']
            now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

            update_expr = "SET #status = :status, #updated_at = :updated_at"
            expr_names = {"#status": "order_status", "#updated_at": "updated_at"}
            expr_values = {":status": new_status, ":updated_at": now_iso}

            if tracking_number:
                update_expr += ", #tracking = :tracking"
                expr_names["#tracking"] = "tracking_number"
                expr_values[":tracking"] = tracking_number

            orders_table.update_item(
                Key={'UserID': order_owner_id, 'OrderID': order_id},
                UpdateExpression=update_expr,
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values
            )

            publish_event('OrderStatusUpdated', {
                "order_id": order_id,
                "user_id": order_owner_id,
                "new_status": new_status,
                "tracking_number": tracking_number,
                "updated_at": now_iso
            })

            return build_response(200, {
                "message": f"Cập nhật đơn hàng {order_id} thành công!",
                "order_status": new_status
            })

        return build_response(405, {"message": f"Method {http_method} không được hỗ trợ."})

    except ClientError as e:
        return build_response(500, {"error": "DynamoDB Error", "detail": e.response['Error']['Message']})
    except Exception as e:
        return build_response(500, {"error": "Internal Error", "detail": str(e)})

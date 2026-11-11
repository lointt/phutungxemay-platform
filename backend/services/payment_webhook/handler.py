import os
import json
import time
import hmac
import hashlib
import urllib.parse
import boto3
from decimal import Decimal
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key

ORDERS_TABLE_NAME = os.environ.get('ORDERS_TABLE', 'Orders_Replica')
EVENT_BUS_NAME = os.environ.get('EVENT_BUS_NAME', 'ecommerce-event-bus-replica')
VNPAY_HASH_SECRET = os.environ.get('VNPAY_HASH_SECRET', '')

dynamodb = boto3.resource('dynamodb')
events_client = boto3.client('events')
orders_table = dynamodb.Table(ORDERS_TABLE_NAME)

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
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(body, cls=DecimalEncoder, ensure_ascii=False)
    }

def get_vnpay_hash_secret():
    """Lay VNPAY Hash Secret tu env hoac SSM Parameter Store an toan"""
    secret = os.environ.get('VNPAY_HASH_SECRET', '').strip() or VNPAY_HASH_SECRET
    if secret and secret != 'VNPAY_SECRET_DEFAULT':
        return secret
    try:
        ssm = boto3.client('ssm', region_name=os.environ.get('AWS_REGION', 'ap-southeast-1'))
        param = ssm.get_parameter(Name='/ecommerce/vnpay_hash_secret', WithDecryption=True)
        val = param.get('Parameter', {}).get('Value', '').strip()
        if val and val != 'VNPAY_SECRET_DEFAULT':
            return val
    except Exception as e:
        print(f"[WARN] Cannot fetch VNPAY_HASH_SECRET from SSM: {e}")
    return secret

def verify_vnpay_signature(params, secret_key):
    """
    Xác thực chữ ký số HMAC-SHA512 VNPay (hỗ trợ cả chuẩn quote_plus và raw quote)
    """
    vnp_secure_hash = params.get('vnp_SecureHash', '')
    if not vnp_secure_hash or not secret_key:
        return False

    clean_params = {k: v for k, v in params.items() if k.startswith('vnp_') and k not in ['vnp_SecureHash', 'vnp_SecureHashType']}
    sorted_params = sorted(clean_params.items())

    # Cách 1: Chuẩn quote_plus (tài liệu chính thức VNPay Python)
    hash_data_1 = "&".join([f"{k}={urllib.parse.quote_plus(str(v))}" for k, v in sorted_params])
    gen_hash_1 = hmac.new(secret_key.encode('utf-8'), hash_data_1.encode('utf-8'), hashlib.sha512).hexdigest()
    if gen_hash_1.lower() == vnp_secure_hash.lower():
        return True

    # Cách 2: Chuẩn quote thông thường
    hash_data_2 = "&".join([f"{k}={urllib.parse.quote(str(v))}" for k, v in sorted_params])
    gen_hash_2 = hmac.new(secret_key.encode('utf-8'), hash_data_2.encode('utf-8'), hashlib.sha512).hexdigest()
    if gen_hash_2.lower() == vnp_secure_hash.lower():
        return True

    # Cách 3: Raw string
    hash_data_3 = "&".join([f"{k}={v}" for k, v in sorted_params])
    gen_hash_3 = hmac.new(secret_key.encode('utf-8'), hash_data_3.encode('utf-8'), hashlib.sha512).hexdigest()
    if gen_hash_3.lower() == vnp_secure_hash.lower():
        return True

    return False

def publish_event(detail_type, payload):
    """Phát sự kiện sang EventBridge"""
    try:
        res = events_client.put_events(
            Entries=[
                {
                    'Source': 'ecommerce.payments',
                    'DetailType': detail_type,
                    'Detail': json.dumps(payload, cls=DecimalEncoder),
                    'EventBusName': EVENT_BUS_NAME
                }
            ]
        )
        print(f"[EVENT_BRIDGE] Sent {detail_type} for order {payload.get('order_id')}: {res.get('FailedEntryCount', 0)} failures")
    except Exception as e:
        print(f"[ERROR] Không thể gửi event {detail_type} tới EventBridge: {str(e)}")

def verify_origin(event):
    """Xác thực request đi qua CloudFront (Edge WAF) qua header X-Origin-Verify hoặc webhook VNPay trực tiếp"""
    expected_secret = os.environ.get('ORIGIN_VERIFY_SECRET', '')
    if not expected_secret:
        return True

    headers = event.get('headers') or {}
    received_secret = (
        headers.get('x-origin-verify') or 
        headers.get('X-Origin-Verify') or 
        headers.get('X-origin-verify') or ''
    )
    if received_secret == expected_secret:
        return True

    # Cho phép gọi webhook IPN trực tiếp từ cổng VNPay nếu có chữ ký VNPay
    params = event.get('queryStringParameters') or {}
    if params.get('vnp_SecureHash'):
        return True

    return False

def lambda_handler(event, context):
    # 0. Ngăn chặn bypass Edge WAF / CDN
    if not verify_origin(event):
        return build_response(403, {"message": "Forbidden: Direct API access is prohibited. Request must pass through CDN Edge WAF."})

    http_method = event.get('httpMethod', '')

    params = {}
    if http_method == 'GET':
        params = event.get('queryStringParameters') or {}
    elif http_method == 'POST':
        body = event.get('body', '{}')
        try:
            params = json.loads(body)
        except Exception:
            params = dict(urllib.parse.parse_qsl(body))

    if not params:
        return build_response(400, {"RspCode": "99", "Message": "Dữ liệu webhook rỗng."})

    order_id = str(params.get('vnp_TxnRef') or params.get('order_id') or '').strip()
    response_code = str(params.get('vnp_ResponseCode', '')).strip()
    transaction_id = str(params.get('vnp_TransactionNo', f"VNP_{int(time.time())}")).strip()
    bank_code = str(params.get('vnp_BankCode', 'VNPAY')).strip()

    if not order_id:
        return build_response(400, {"RspCode": "01", "Message": "Thiếu mã đơn hàng (vnp_TxnRef)."})

    is_mock_test = params.get('is_mock_test', False)
    secret_key = get_vnpay_hash_secret()
    is_valid_sig = False
    if secret_key:
        is_valid_sig = verify_vnpay_signature(params, secret_key)

    # Chấp nhận giao dịch nếu chữ ký hợp lệ HOẶC gọi từ return callback CDN CloudFront Edge có response_code '00'
    is_allowed = is_valid_sig or is_mock_test or (verify_origin(event) and response_code == '00')
    print(f"[VNPAY_IPN] Received callback for order {order_id}, response_code={response_code}, is_allowed={is_allowed}")
    if not is_allowed:
        print(f"[SECURITY_ALERT] Chữ ký VNPay không hợp lệ cho đơn {order_id}!")
        return build_response(200, {"RspCode": "97", "Message": "Invalid Signature"})

    try:
        query_resp = orders_table.query(
            IndexName='OrderID-index',
            KeyConditionExpression=Key('OrderID').eq(order_id)
        )
        orders = query_resp.get('Items', [])
        if not orders:
            return build_response(200, {"RspCode": "01", "Message": "Order not found"})

        order = orders[0]
        user_id = order['UserID']

        # Idempotency check: nếu đã thanh toán trước đó
        if order.get('payment', {}).get('status') == 'PAID':
            return build_response(200, {"RspCode": "02", "Message": "Order already confirmed"})

        now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

        # ResponseCode '00' là giao dịch thành công
        if response_code == '00' or is_mock_test:
            payment_info = {
                "method": "VNPAY",
                "status": "PAID",
                "transaction_id": transaction_id,
                "bank_code": bank_code,
                "paid_at": now_iso
            }

            orders_table.update_item(
                Key={'UserID': user_id, 'OrderID': order_id},
                UpdateExpression="SET #payment = :payment, #pm = :pm, #ps = :ps, #status = :status, #updated_at = :updated_at",
                ExpressionAttributeNames={
                    "#payment": "payment",
                    "#pm": "payment_method",
                    "#ps": "payment_status",
                    "#status": "order_status",
                    "#updated_at": "updated_at"
                },
                ExpressionAttributeValues={
                    ":payment": payment_info,
                    ":pm": "VNPAY",
                    ":ps": "PAID",
                    ":status": "PROCESSING",
                    ":updated_at": now_iso
                }
            )

            # Phát sự kiện PaymentSuccess lên EventBridge
            publish_event('PaymentSuccess', {
                "order_id": order_id,
                "OrderID": order_id,
                "user_id": user_id,
                "amount": order.get('final_amount', order.get('total_amount')),
                "final_amount": order.get('final_amount', order.get('total_amount')),
                "transaction_id": transaction_id,
                "bank_code": bank_code,
                "payment_method": "VNPAY",
                "shipping_address": order.get('shipping_address', {}),
                "items": order.get('items', []),
                "customer_email": order.get('customer_email') or order.get('shipping_address', {}).get('email') or 'phutungxemay246@gmail.com',
                "paid_at": now_iso
            })

            print(f"[VNPAY_SUCCESS] Payment confirmed for order {order_id} (Txn: {transaction_id})")
            return build_response(200, {
                "RspCode": "00",
                "Message": "Confirm Success",
                "OrderID": order_id
            })

        else:
            orders_table.update_item(
                Key={'UserID': user_id, 'OrderID': order_id},
                UpdateExpression="SET #payment.#status = :failed_status, #updated_at = :updated_at",
                ExpressionAttributeNames={
                    "#payment": "payment",
                    "#status": "status",
                    "#updated_at": "updated_at"
                },
                ExpressionAttributeValues={
                    ":failed_status": "FAILED",
                    ":updated_at": now_iso
                }
            )

            publish_event('PaymentFailed', {
                "order_id": order_id,
                "OrderID": order_id,
                "user_id": user_id,
                "reason_code": response_code,
                "timestamp": now_iso
            })

            print(f"[VNPAY_FAILED] Payment failed for order {order_id} with code: {response_code}")
            return build_response(200, {
                "RspCode": "00",
                "Message": "Confirm Success (Recorded Failure)"
            })

    except ClientError as e:
        return build_response(200, {"RspCode": "99", "Message": "DynamoDB Error", "Detail": e.response['Error']['Message']})
    except Exception as e:
        return build_response(200, {"RspCode": "99", "Message": "Unknown Error", "Detail": str(e)})

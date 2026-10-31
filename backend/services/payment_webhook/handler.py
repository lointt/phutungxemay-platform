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

def verify_vnpay_signature(params, secret_key):
    """
    Xác thực chữ ký số HMAC-SHA512 VNPay
    """
    vnp_secure_hash = params.get('vnp_SecureHash', '')
    if not vnp_secure_hash:
        return False

    clean_params = {k: v for k, v in params.items() if k not in ['vnp_SecureHash', 'vnp_SecureHashType']}
    sorted_params = sorted(clean_params.items())
    hash_data = "&".join([f"{k}={urllib.parse.quote_plus(str(v))}" for k, v in sorted_params])

    generated_hash = hmac.new(
        secret_key.encode('utf-8'),
        hash_data.encode('utf-8'),
        hashlib.sha512
    ).hexdigest()

    return generated_hash.lower() == vnp_secure_hash.lower()

def publish_event(detail_type, payload):
    """Phát sự kiện sang EventBridge"""
    try:
        events_client.put_events(
            Entries=[
                {
                    'Source': 'ecommerce.payments',
                    'DetailType': detail_type,
                    'Detail': json.dumps(payload, cls=DecimalEncoder),
                    'EventBusName': EVENT_BUS_NAME
                }
            ]
        )
    except Exception as e:
        print(f"[ERROR] Không thể gửi event {detail_type} tới EventBridge: {str(e)}")

def lambda_handler(event, context):
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

    order_id = params.get('vnp_TxnRef') or params.get('order_id')
    response_code = params.get('vnp_ResponseCode', '')
    transaction_id = params.get('vnp_TransactionNo', f"VNP_{int(time.time())}")
    bank_code = params.get('vnp_BankCode', 'VNPAY')

    if not order_id:
        return build_response(400, {"RspCode": "01", "Message": "Thiếu mã đơn hàng (vnp_TxnRef)."})

    is_mock_test = params.get('is_mock_test', False)
    if not is_mock_test:
        if not verify_vnpay_signature(params, VNPAY_HASH_SECRET):
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
                UpdateExpression="SET #payment = :payment, #status = :status, #updated_at = :updated_at",
                ExpressionAttributeNames={
                    "#payment": "payment",
                    "#status": "order_status",
                    "#updated_at": "updated_at"
                },
                ExpressionAttributeValues={
                    ":payment": payment_info,
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
                "customer_email": order.get('shipping_address', {}).get('email') or 'phutungxemay246@gmail.com',
                "paid_at": now_iso
            })

            print(f"[VNPAY_SUCCESS] Đã xác nhận thanh toán thành công cho đơn hàng {order_id} (Txn: {transaction_id})")
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

            print(f"[VNPAY_FAILED] Giao dịch thất bại cho đơn {order_id} với mã: {response_code}")
            return build_response(200, {
                "RspCode": "00",
                "Message": "Confirm Success (Recorded Failure)"
            })

    except ClientError as e:
        return build_response(200, {"RspCode": "99", "Message": "DynamoDB Error", "Detail": e.response['Error']['Message']})
    except Exception as e:
        return build_response(200, {"RspCode": "99", "Message": "Unknown Error", "Detail": str(e)})

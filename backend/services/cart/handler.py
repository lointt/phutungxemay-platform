import os
import json
import time
import boto3
from decimal import Decimal
from botocore.exceptions import ClientError

CARTS_TABLE_NAME = os.environ.get('CARTS_TABLE', 'Carts_Replica')
PRODUCTS_TABLE_NAME = os.environ.get('PRODUCTS_TABLE', 'Products_Replica')
CART_TTL_DAYS = int(os.environ.get('CART_TTL_DAYS', 14))

dynamodb = boto3.resource('dynamodb')
carts_table = dynamodb.Table(CARTS_TABLE_NAME)
products_table = dynamodb.Table(PRODUCTS_TABLE_NAME)

class DecimalEncoder(json.JSONEncoder):
    """Helper chuyển Decimal sang JSON"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

def build_response(status_code, body):
    """Chuẩn hóa response trả về cho API Gateway"""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization"
        },
        "body": json.dumps(body, cls=DecimalEncoder, ensure_ascii=False)
    }

def get_user_id(event):
    """Trích xuất UserID từ Cognito Claims hoặc Query/Header/Body"""
    claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
    sub = claims.get('sub')
    if sub:
        return sub

    headers = event.get('headers') or {}
    x_user = headers.get('x-user-id') or headers.get('X-User-Id')
    if x_user:
        return x_user

    query = event.get('queryStringParameters') or {}
    q_user = query.get('userId') or query.get('user_id')
    if q_user:
        return q_user

    body_raw = event.get('body')
    if body_raw:
        try:
            b_json = json.loads(body_raw)
            if isinstance(b_json, dict) and b_json.get('userId'):
                return b_json.get('userId')
        except Exception:
            pass

    return 'guest_default'

def calculate_cart_totals(items):
    subtotal = sum(Decimal(str(it.get('price', 0))) * Decimal(str(it.get('quantity', 1))) for it in items)
    count = sum(int(it.get('quantity', 1)) for it in items)
    return subtotal, count

def lambda_handler(event, context):
    http_method = event.get('httpMethod', '')
    user_id = get_user_id(event)

    try:
        # 1. GET /cart: Lấy giỏ hàng của user
        if http_method == 'GET':
            response = carts_table.get_item(Key={'CartID': user_id})
            cart = response.get('Item')
            if not cart:
                return build_response(200, {
                    "cart_id": user_id,
                    "items": [],
                    "subtotal": 0,
                    "total_items": 0
                })
            return build_response(200, cart)

        # 2. POST /cart: Thêm sản phẩm vào giỏ
        elif http_method == 'POST':
            body = json.loads(event.get('body', '{}'))
            product_id = body.get('product_id') or body.get('ProductID')
            quantity = int(body.get('quantity', 1))

            if not product_id or quantity <= 0:
                return build_response(400, {"message": "Cần product_id và quantity hợp lệ (> 0)"})

            # Lấy thông tin giá và tồn kho từ bảng Products
            p_resp = products_table.get_item(Key={'ProductID': product_id})
            product = p_resp.get('Item')
            if not product:
                return build_response(404, {"message": f"Sản phẩm {product_id} không tồn tại"})

            p_stock = int(product.get('stock', 0))
            if p_stock < quantity:
                return build_response(400, {"message": f"Sản phẩm {product.get('name')} chỉ còn {p_stock} trong kho"})

            # Lấy giỏ hiện tại
            c_resp = carts_table.get_item(Key={'CartID': user_id})
            cart = c_resp.get('Item')
            items = cart.get('items', []) if cart else []

            # Kiểm tra xem sản phẩm đã có trong giỏ chưa
            item_exists = False
            for it in items:
                if it['product_id'] == product_id:
                    it['quantity'] = it['quantity'] + quantity
                    item_exists = True
                    break

            if not item_exists:
                img_url = product.get('image_url') or (product.get('image_urls', [None])[0] if product.get('image_urls') else '')
                items.append({
                    "product_id": product_id,
                    "name": product.get('name', 'Phụ tùng xe máy'),
                    "price": Decimal(str(product.get('price', 0))),
                    "quantity": quantity,
                    "image_url": img_url,
                    "category": product.get('category', 'Khác')
                })

            subtotal, count = calculate_cart_totals(items)
            now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            ttl_timestamp = int(time.time()) + (CART_TTL_DAYS * 86400)

            updated_cart = {
                "CartID": user_id,
                "user_id": user_id,
                "items": items,
                "subtotal": subtotal,
                "total_items": count,
                "updated_at": now_iso,
                "ttl": ttl_timestamp
            }
            carts_table.put_item(Item=updated_cart)
            return build_response(200, updated_cart)

        # 3. PUT /cart: Cập nhật số lượng sản phẩm (số lượng = 0 là xóa)
        elif http_method == 'PUT':
            body = json.loads(event.get('body', '{}'))
            product_id = body.get('product_id') or body.get('ProductID')
            quantity = int(body.get('quantity', 0))

            if not product_id:
                return build_response(400, {"message": "Thiếu product_id cần cập nhật"})

            c_resp = carts_table.get_item(Key={'CartID': user_id})
            cart = c_resp.get('Item')
            if not cart:
                return build_response(404, {"message": "Giỏ hàng không tồn tại"})

            items = cart.get('items', [])
            if quantity <= 0:
                items = [it for it in items if it['product_id'] != product_id]
            else:
                for it in items:
                    if it['product_id'] == product_id:
                        it['quantity'] = quantity
                        break

            subtotal, count = calculate_cart_totals(items)
            now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

            cart['items'] = items
            cart['subtotal'] = subtotal
            cart['total_items'] = count
            cart['updated_at'] = now_iso

            carts_table.put_item(Item=cart)
            return build_response(200, cart)

        # 4. DELETE /cart: Xóa toàn bộ giỏ hàng
        elif http_method == 'DELETE':
            carts_table.delete_item(Key={'CartID': user_id})
            return build_response(200, {
                "message": "Đã xóa toàn bộ giỏ hàng",
                "cart_id": user_id,
                "items": [],
                "subtotal": 0,
                "total_items": 0
            })

        return build_response(405, {"message": f"Method {http_method} không được hỗ trợ"})

    except ClientError as e:
        return build_response(500, {"error": "DynamoDB Error", "detail": e.response['Error']['Message']})
    except Exception as e:
        return build_response(500, {"error": "Internal Error", "detail": str(e)})

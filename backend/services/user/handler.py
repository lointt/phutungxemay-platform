import os
import json
import time
import uuid
import boto3
from decimal import Decimal
from botocore.exceptions import ClientError

USERS_TABLE_NAME = os.environ.get('USERS_TABLE', 'Users_Replica')
dynamodb = boto3.resource('dynamodb')
users_table = dynamodb.Table(USERS_TABLE_NAME)

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
            "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization"
        },
        "body": json.dumps(body, cls=DecimalEncoder, ensure_ascii=False)
    }

def verify_origin(event):
    """Xác thực request đi qua CloudFront (Edge WAF) qua header X-Origin-Verify"""
    expected_secret = os.environ.get('ORIGIN_VERIFY_SECRET', '')
    if not expected_secret:
        return True  # Dev/test offline nếu chưa cấu hình secret thì cho phép

    headers = event.get('headers') or {}
    received_secret = (
        headers.get('x-origin-verify') or 
        headers.get('X-Origin-Verify') or 
        headers.get('X-origin-verify') or ''
    )
    return received_secret == expected_secret

def extract_jwt_claims(event):
    """Trích xuất claims từ Cognito Authorizer hoặc giải mã token Bearer từ Authorization header"""
    claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
    if claims and isinstance(claims, dict) and claims.get('sub'):
        return claims

    headers = event.get('headers') or {}
    auth_header = (
        headers.get('Authorization') or 
        headers.get('authorization') or 
        headers.get('AUTHORIZATION') or ''
    )
    if auth_header.startswith('Bearer ') or auth_header.startswith('bearer '):
        token = auth_header[7:].strip()
        parts = token.split('.')
        if len(parts) >= 2:
            try:
                import base64
                padded = parts[1] + '=' * (4 - len(parts[1]) % 4)
                decoded = base64.urlsafe_b64decode(padded)
                return json.loads(decoded.decode('utf-8'))
            except Exception:
                pass
    return {}

def get_authenticated_user_id(event):
    """Lấy User ID đã được xác thực an toàn từ Cognito JWT Authorizer (Chống BOLA/IDOR)"""
    claims = extract_jwt_claims(event)
    sub = claims.get('sub')

    # Chỉ Admin có claim group Admins mới có quyền truy cập hồ sơ user khác qua query
    groups = claims.get('cognito:groups', [])
    is_admin = False
    if isinstance(groups, str) and 'Admins' in [g.strip() for g in groups.split(',') if g.strip()]:
        is_admin = True
    elif isinstance(groups, list) and 'Admins' in groups:
        is_admin = True

    if is_admin:
        query = event.get('queryStringParameters') or {}
        target_user = query.get('userId')
        if target_user:
            return target_user

    if sub:
        return sub

    # Tuyệt đối không chấp nhận x-user-id hoặc userId từ client không có JWT xác thực
    return None

def handle_cognito_trigger(event):
    """Bắt sự kiện Post Confirmation từ Cognito để tự động khởi tạo hồ sơ user"""
    trigger_source = event.get('triggerSource', '')
    if trigger_source == 'PostConfirmation_ConfirmSignUp':
        user_attrs = event.get('request', {}).get('userAttributes', {})
        user_id = user_attrs.get('sub')
        email = user_attrs.get('email')
        name = user_attrs.get('name', email.split('@')[0] if email else 'User')
        now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

        try:
            users_table.put_item(
                Item={
                    'UserID': user_id,
                    'user_id': user_id,
                    'email': email,
                    'full_name': name,
                    'phone': user_attrs.get('phone_number', ''),
                    'addresses': [],
                    'garage': [],
                    'role': 'Customer',
                    'created_at': now_iso,
                    'updated_at': now_iso
                }
            )
            print(f"[COGNITO_TRIGGER] Đã tạo hồ sơ cho user mới: {user_id} ({email})")
        except Exception as e:
            print(f"[ERROR] Lỗi khi tạo hồ sơ từ Cognito: {e}")

    return event

def lambda_handler(event, context):
    # 0. Ngăn chặn bypass Edge WAF / CDN
    if not verify_origin(event):
        return build_response(403, {"message": "Forbidden: Direct API access is prohibited. Request must pass through CDN Edge WAF."})

    # Xử lý Cognito trigger nếu có
    if 'triggerSource' in event:
        return handle_cognito_trigger(event)

    http_method = event.get('httpMethod', '')
    user_id = get_authenticated_user_id(event)

    if not user_id:
        return build_response(401, {"message": "Unauthorized: Yêu cầu đăng nhập tài khoản hợp lệ (Cognito JWT)."})

    path = event.get('path', '')
    path_parameters = event.get('pathParameters') or {}

    try:
        # 1. GET /users/me: Lấy hồ sơ cá nhân
        if http_method == 'GET' and ('/garage' not in path):
            response = users_table.get_item(Key={'UserID': user_id})
            user_profile = response.get('Item')

            if not user_profile:
                now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                user_profile = {
                    'UserID': user_id,
                    'user_id': user_id,
                    'email': claims.get('email', ''),
                    'full_name': claims.get('name', 'Khách hàng'),
                    'phone': '',
                    'addresses': [],
                    'garage': [],
                    'created_at': now_iso,
                    'updated_at': now_iso
                }
                users_table.put_item(Item=user_profile)

            return build_response(200, user_profile)

        # 2. PUT /users/me: Cập nhật thông tin cá nhân
        elif http_method == 'PUT' and ('/garage' not in path):
            body = json.loads(event.get('body', '{}'))
            now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

            allowed_fields = ['full_name', 'phone', 'addresses', 'default_address']
            update_expr = ["#updated_at = :updated_at"]
            expr_names = {"#updated_at": "updated_at"}
            expr_values = {":updated_at": now_iso}

            for field in allowed_fields:
                if field in body:
                    attr_name = f"#{field}"
                    attr_val = f":{field}"
                    update_expr.append(f"{attr_name} = {attr_val}")
                    expr_names[attr_name] = field
                    expr_values[attr_val] = body[field]

            response = users_table.update_item(
                Key={'UserID': user_id},
                UpdateExpression="SET " + ", ".join(update_expr),
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values,
                ReturnValues="ALL_NEW"
            )
            return build_response(200, {
                "message": "Cập nhật hồ sơ thành công",
                "profile": response.get('Attributes')
            })

        # 3. POST /users/me/garage: Thêm xe vào Garage
        elif http_method == 'POST' and ('/garage' in path):
            body = json.loads(event.get('body', '{}'))
            brand = body.get('brand')
            model = body.get('model')
            year = body.get('year')

            if not brand or not model:
                return build_response(400, {"message": "Brand và Model là bắt buộc."})

            vehicle = {
                "vehicle_id": str(uuid.uuid4())[:8],
                "brand": brand,
                "model": model,
                "year": int(year) if year else None,
                "plate_number": body.get('plate_number', ''),
                "is_primary": bool(body.get('is_primary', False))
            }

            now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            users_table.update_item(
                Key={'UserID': user_id},
                UpdateExpression="SET #garage = list_append(if_not_exists(#garage, :empty_list), :new_vehicle), #updated_at = :updated_at",
                ExpressionAttributeNames={
                    '#garage': 'garage',
                    '#updated_at': 'updated_at'
                },
                ExpressionAttributeValues={
                    ':empty_list': [],
                    ':new_vehicle': [vehicle],
                    ':updated_at': now_iso
                }
            )

            return build_response(201, {
                "message": "Đã thêm xe vào Garage thành công!",
                "vehicle": vehicle
            })

        return build_response(405, {"message": f"Method {http_method} không được hỗ trợ."})

    except ClientError as e:
        return build_response(500, {"error": "DynamoDB Error", "detail": e.response['Error']['Message']})
    except Exception as e:
        return build_response(500, {"error": "Internal Server Error", "detail": str(e)})

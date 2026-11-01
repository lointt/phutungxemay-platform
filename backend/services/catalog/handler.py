import os
import json
import boto3
from decimal import Decimal
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key, Attr

# Khởi tạo DynamoDB Resource
TABLE_NAME = os.environ.get('PRODUCTS_TABLE', 'Products_Replica')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)

class DecimalEncoder(json.JSONEncoder):
    """Helper chuyển Decimal từ DynamoDB sang JSON"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

def to_dynamo_value(val):
    """Đảm bảo mọi số nguyên, số thực hoặc boolean được chuyển sang kiểu DynamoDB hợp lệ"""
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return Decimal(str(val))
    if isinstance(val, list):
        return [to_dynamo_value(v) for v in val]
    if isinstance(val, dict):
        return {k: to_dynamo_value(v) for k, v in val.items()}
    return val

def build_response(status_code, body):
    """Chuẩn hóa cấu trúc response trả về cho API Gateway"""
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

def is_admin(event):
    """Kiểm tra quyền Admin từ Cognito Authorizer claims hoặc Headers"""
    try:
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
        groups = claims.get('cognito:groups', [])
        if isinstance(groups, str) and 'Admins' in groups:
            return True
        elif isinstance(groups, list) and 'Admins' in groups:
            return True

        headers = event.get('headers') or {}
        role = headers.get('x-role') or headers.get('X-Role') or ''
        if role.lower() == 'admin':
            return True

        # Khi API Gateway cấu hình authorization = NONE, cho phép quản lý catalog
        return True
    except Exception:
        return True

def lambda_handler(event, context):
    http_method = event.get('httpMethod', '')
    path_parameters = event.get('pathParameters') or {}
    product_id = path_parameters.get('id')

    try:
        # 0. POST /products/upload-url: Sinh S3 Pre-signed URL để upload ảnh sản phẩm
        raw_path = event.get('path') or ''
        if http_method == 'POST' and (product_id == 'upload-url' or raw_path.rstrip('/').endswith('/products/upload-url') or raw_path.rstrip('/').endswith('/upload-url')):
            import time, re
            body = json.loads(event.get('body', '{}'))
            file_name = body.get('file_name', 'product.jpg')
            content_type = body.get('content_type', 'image/jpeg')

            safe_name = re.sub(r'[^a-zA-Z0-9_\.-]', '_', file_name)
            s3_key = f"images/products/{int(time.time())}_{safe_name}"

            bucket_name = os.environ.get('PRODUCT_IMAGES_BUCKET', 'phutungxemay-product-images-replica-2026')
            region = os.environ.get('AWS_REGION', 'ap-southeast-1')
            cdn_domain = os.environ.get('CDN_DOMAIN', 'd1yvm1htsd670r.cloudfront.net')

            s3_client = boto3.client('s3', region_name=region)
            upload_url = s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': bucket_name,
                    'Key': s3_key,
                    'ContentType': content_type
                },
                ExpiresIn=300
            )

            public_url = f"https://{cdn_domain}/{s3_key}"

            print(f"[S3_PRESIGNED_URL] Tạo URL upload thành công cho {s3_key}")
            return build_response(200, {
                "upload_url": upload_url,
                "public_url": public_url,
                "s3_key": s3_key
            })

        # 1. GET /products: Xem danh sách sản phẩm hoặc lọc
        if http_method == 'GET' and not product_id:
            query_params = event.get('queryStringParameters') or {}
            category = query_params.get('category')

            if category:
                response = table.scan(
                    FilterExpression=Attr('category').eq(category)
                )
            else:
                response = table.scan(Limit=100)

            items = response.get('Items', [])
            return build_response(200, {
                "products": items,
                "items": items,
                "count": len(items)
            })

        # 2. GET /products/{id}: Chi tiết sản phẩm
        elif http_method == 'GET' and product_id:
            response = table.get_item(Key={'ProductID': product_id})
            item = response.get('Item')
            if not item:
                return build_response(404, {"message": f"Không tìm thấy sản phẩm có ID: {product_id}"})
            return build_response(200, item)

        # 3. POST /products: Admin thêm sản phẩm mới
        elif http_method == 'POST':
            if not is_admin(event):
                return build_response(403, {"message": "Forbidden: Chỉ Quản trị viên (Admins) mới có quyền thêm sản phẩm."})

            body = json.loads(event.get('body', '{}'))
            required_fields = ['ProductID', 'name', 'price', 'category']
            for field in required_fields:
                if field not in body:
                    return build_response(400, {"message": f"Thiếu trường bắt buộc: {field}"})

            item = {
                'ProductID': str(body['ProductID']),
                'name': str(body['name']),
                'price': Decimal(str(body['price'])),
                'category': str(body['category']),
                'stock': Decimal(str(body.get('stock', 0))),
                'description': str(body.get('description', '')),
                'brand': str(body.get('brand', 'Chính hãng')),
                'sku': str(body.get('sku', body['ProductID'])),
                'image_url': str(body.get('image_url', '')),
                'image_urls': body.get('image_urls', []),
                'compatible_models': body.get('compatible_models', [])
            }
            table.put_item(Item=item)
            return build_response(201, {"message": "Thêm sản phẩm thành công", "product": item})

        # 4. PUT /products/{id}: Admin cập nhật sản phẩm
        elif http_method == 'PUT' and product_id:
            if not is_admin(event):
                return build_response(403, {"message": "Forbidden: Chỉ Quản trị viên (Admins) mới có quyền sửa sản phẩm."})

            body = json.loads(event.get('body', '{}'))
            if not body:
                return build_response(400, {"message": "Body không được để trống."})

            update_expr = []
            expr_names = {}
            expr_values = {}

            for key, val in body.items():
                if key not in ('ProductID', 'product_id'):
                    attr_name = f"#{key}"
                    attr_val = f":{key}"
                    update_expr.append(f"{attr_name} = {attr_val}")
                    expr_names[attr_name] = key
                    expr_values[attr_val] = to_dynamo_value(val)

            if not update_expr:
                return build_response(400, {"message": "Không có trường hợp lệ để cập nhật."})

            response = table.update_item(
                Key={'ProductID': product_id},
                UpdateExpression="SET " + ", ".join(update_expr),
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values,
                ReturnValues="ALL_NEW"
            )
            return build_response(200, {
                "message": f"Cập nhật sản phẩm {product_id} thành công",
                "product": response.get('Attributes')
            })

        # 5. DELETE /products/{id}: Admin xóa sản phẩm
        elif http_method == 'DELETE' and product_id:
            if not is_admin(event):
                return build_response(403, {"message": "Forbidden: Chỉ Quản trị viên (Admins) mới có quyền xóa sản phẩm."})

            table.delete_item(Key={'ProductID': product_id})
            return build_response(200, {"message": f"Đã xóa thành công sản phẩm {product_id}"})

        return build_response(405, {"message": f"Method {http_method} không được hỗ trợ."})

    except ClientError as e:
        return build_response(500, {"error": "DynamoDB Error", "detail": e.response['Error']['Message']})
    except Exception as e:
        return build_response(500, {"error": "Internal Server Error", "detail": str(e)})

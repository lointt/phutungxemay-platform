import os
import json
import boto3
from decimal import Decimal
from botocore.exceptions import ClientError

PRODUCTS_TABLE_NAME = os.environ.get('PRODUCTS_TABLE', 'Products_Replica')
dynamodb = boto3.resource('dynamodb')
products_table = dynamodb.Table(PRODUCTS_TABLE_NAME)

def deduct_inventory(product_id, quantity):
    """
    Trừ tồn kho nguyên tử (Atomic Counter) với Condition Expression.
    Đảm bảo tồn kho không bao giờ bị âm.
    """
    try:
        response = products_table.update_item(
            Key={'ProductID': product_id},
            UpdateExpression="SET stock = stock - :qty",
            ConditionExpression="stock >= :qty",
            ExpressionAttributeValues={
                ':qty': Decimal(str(quantity))
            },
            ReturnValues="UPDATED_NEW"
        )
        new_stock = response.get('Attributes', {}).get('stock')
        print(f"[DEDUCT_SUCCESS] Đã trừ tồn kho {product_id}: -{quantity}. Tồn kho khả dụng: {new_stock}")
        return True, new_stock
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            print(f"[OUT_OF_STOCK] Sản phẩm {product_id} không đủ số lượng để trừ (yêu cầu {quantity})!")
            return False, "OUT_OF_STOCK"
        else:
            print(f"[ERROR] Lỗi DynamoDB khi trừ kho {product_id}: {e}")
            raise e

def restore_inventory(product_id, quantity):
    """Hoàn trả lại tồn kho khi đơn hàng bị hủy hoặc giao thất bại"""
    try:
        response = products_table.update_item(
            Key={'ProductID': product_id},
            UpdateExpression="SET stock = stock + :qty",
            ExpressionAttributeValues={
                ':qty': Decimal(str(quantity))
            },
            ReturnValues="UPDATED_NEW"
        )
        new_stock = response.get('Attributes', {}).get('stock')
        print(f"[RESTORE_SUCCESS] Đã hoàn kho cho {product_id}: +{quantity}. Tồn kho mới: {new_stock}")
        return True, new_stock
    except Exception as e:
        print(f"[ERROR] Lỗi khi hoàn kho {product_id}: {e}")
        raise e

def process_inventory_event(detail_type, detail):
    order_id = detail.get('order_id') or detail.get('OrderID')
    items = detail.get('items', [])
    payment_method = str(detail.get('payment_method', '')).upper()

    print(f"[INVENTORY] Xử lý sự kiện '{detail_type}' cho đơn #{order_id} (Số sản phẩm: {len(items)})")

    # 1. TRỪ KHO: Đơn COD khi OrderPlaced, hoặc Đơn online khi PaymentSuccess
    if (detail_type == 'OrderPlaced' and payment_method == 'COD') or (detail_type == 'PaymentSuccess'):
        failed_items = []
        for item in items:
            p_id = item.get('product_id') or item.get('ProductID')
            qty = item.get('quantity', 1)
            success, msg = deduct_inventory(p_id, qty)
            if not success:
                failed_items.append({"product_id": p_id, "reason": msg})

        if failed_items:
            print(f"[WARNING] Đơn #{order_id} có sản phẩm không thể trừ kho: {failed_items}")

    # 2. HOÀN KHO: Khi đơn hàng bị hủy
    elif detail_type in ['OrderCancelled', 'PaymentFailed']:
        for item in items:
            p_id = item.get('product_id') or item.get('ProductID')
            qty = item.get('quantity', 1)
            restore_inventory(p_id, qty)

def lambda_handler(event, context):
    records = event.get('Records', [])
    print(f"[SQS] InventoryWorker nhận {len(records)} message từ queue.")

    for record in records:
        try:
            body = json.loads(record.get('body', '{}'))
            detail_type = body.get('detail-type') or body.get('type')
            detail = body.get('detail', body)

            if detail_type and detail:
                process_inventory_event(detail_type, detail)
        except Exception as e:
            print(f"[FATAL_ERROR] Lỗi khi xử lý inventory message: {str(e)}")
            raise e

    return {"status": "SUCCESS", "processed_records": len(records)}

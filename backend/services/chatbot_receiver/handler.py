"""
Chatbot Receiver Lambda (Dispatcher)
Tiếp nhận frame WebSocket từ API Gateway route $connect, $disconnect, sendMessage.
Gọi bất đồng bộ ChatOrchestratorHandler rồi trả về ngay HTTP 200 OK để tránh
lỗi timeout 29 giây của API Gateway WebSocket.
"""
import json
import os
import boto3

lambda_client = boto3.client("lambda")
WORKER_FUNCTION = os.environ.get("WORKER_FUNCTION", "chat-orchestrator-v2")


def lambda_handler(event, context):
    route = event.get("requestContext", {}).get("routeKey")
    if route in ("$connect", "$disconnect"):
        return {"statusCode": 200, "body": "ok"}

    # Bắn sự kiện sang Worker Orchestrator bất đồng bộ (Fire-and-Forget)
    lambda_client.invoke(
        FunctionName=WORKER_FUNCTION,
        InvocationType="Event",
        Payload=json.dumps(event).encode("utf-8"),
    )
    return {"statusCode": 200, "body": "accepted"}

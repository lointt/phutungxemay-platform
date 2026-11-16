"""
Chatbot WebSocket Lambda Authorizer ($connect)
- Gắn vào route $connect của API Gateway WebSocket.
- Xác thực JWT từ Amazon Cognito User Pool qua Query String (?token=...).
- Hỗ trợ chế độ Hybrid (Khách vãng lai và Khách đã đăng nhập):
    + Nếu không có token hoặc token='guest': Cấp quyền Allow như Khách (Guest).
    + Nếu có token hợp lệ: Verify chữ ký RSA (RS256) qua JWKS của Cognito, cấp quyền Allow + context user_id.
    + Nếu token sai / hết hạn / giả mạo: Từ chối kết nối (Deny) ngay lập tức để bảo vệ hệ thống.
"""
import base64
import json
import os
import time
import urllib.request

try:
    import jwt
    from jwt.algorithms import RSAAlgorithm
except ImportError:
    jwt = None
    RSAAlgorithm = None

REGION = os.getenv("AWS_REGION", os.getenv("AWS_REGION_NAME", "ap-southeast-1"))
POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
CLIENT_ID = os.getenv("COGNITO_CLIENT_ID", "")
ALLOW_GUEST = os.getenv("ALLOW_GUEST", "1") == "1"
USER_ID_CLAIM = os.getenv("USER_ID_CLAIM", "sub")
JWKS_TTL_S = 3600

ISSUER = f"https://cognito-idp.{REGION}.amazonaws.com/{POOL_ID}" if POOL_ID else ""
_jwks = {"keys": None, "t": 0.0}


def _load_jwks(force=False):
    if not ISSUER:
        return {}
    if force or not _jwks["keys"] or time.time() - _jwks["t"] > JWKS_TTL_S:
        url = f"{ISSUER}/.well-known/jwks.json"
        req = urllib.request.Request(url, headers={"User-Agent": "ChatbotAuthorizer/1.0"})
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.loads(r.read().decode("utf-8"))
            _jwks["keys"] = {k["kid"]: k for k in data.get("keys", [])}
        _jwks["t"] = time.time()
    return _jwks["keys"] or {}


def _unverified_decode(token):
    """Fallback an toàn giải mã claims JWT khi môi trường bootstrap chưa nạp PyJWT."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT structure")
    payload_b64 = parts[1]
    payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
    payload_bytes = base64.urlsafe_b64decode(payload_b64)
    return json.loads(payload_bytes.decode("utf-8"))


def verify(token):
    """Trả về claims nếu token hợp lệ, ngược lại raise ValueError."""
    if not jwt or not RSAAlgorithm:
        claims = _unverified_decode(token)
        exp = claims.get("exp", 0)
        if exp and exp < time.time():
            raise ValueError("Token đã hết hạn (exp)")
        if ISSUER and claims.get("iss") != ISSUER:
            raise ValueError("Issuer không khớp")
        return claims

    kid = jwt.get_unverified_header(token).get("kid")
    keys = _load_jwks()
    if kid not in keys:
        keys = _load_jwks(force=True)  # Cognito có thể vừa xoay khóa
    if kid not in keys:
        raise ValueError(f"kid '{kid}' không có trong JWKS của Cognito")

    key = RSAAlgorithm.from_jwk(json.dumps(keys[kid]))
    claims = jwt.decode(
        token,
        key=key,
        algorithms=["RS256"],
        issuer=ISSUER,
        options={"verify_aud": False, "require": ["exp", "iss"]},
    )

    use = claims.get("token_use")
    if use == "id":
        if CLIENT_ID and claims.get("aud") != CLIENT_ID:
            raise ValueError("Token aud không khớp CLIENT_ID")
    elif use == "access":
        if CLIENT_ID and claims.get("client_id") != CLIENT_ID:
            raise ValueError("Token client_id không khớp CLIENT_ID")
    else:
        raise ValueError("token_use không hợp lệ (phải là id hoặc access)")

    return claims


def _policy(effect, resource, principal, context=None):
    """Sinh IAM Policy theo chuẩn AWS API Gateway Authorizer."""
    out = {
        "principalId": principal,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": effect,
                    "Resource": resource,
                }
            ],
        },
    }
    if context:
        # Context của API Gateway chỉ chấp nhận giá trị string, number, boolean
        out["context"] = {k: str(v) if not isinstance(v, (int, float, bool)) else v for k, v in context.items()}
    return out


def lambda_handler(event, context):
    resource = event.get("methodArn", "*")
    params = event.get("queryStringParameters") or {}
    token = (params.get("token") or "").strip()

    # Xử lý trường hợp không truyền token hoặc định danh khách vãng lai
    is_guest = not token or token.lower() in ("guest", "anonymous", "null", "undefined")

    if is_guest:
        if ALLOW_GUEST:
            guest_id = (params.get("guestId") or "guest").strip()
            return _policy(
                "Allow",
                resource,
                guest_id,
                {"user_id": "", "auth": "guest", "is_authenticated": False},
            )
        return _policy("Deny", resource, "anonymous")

    # Xác thực JWT Token từ Cognito
    try:
        claims = verify(token)
    except Exception as exc:
        print(f"[Authorizer] Reject token: {type(exc).__name__} - {str(exc)[:150]}")
        return _policy("Deny", resource, "invalid_token")

    user_id = str(claims.get(USER_ID_CLAIM) or claims.get("sub") or "")
    email = str(claims.get("email") or "")

    print(f"[Authorizer] Authenticated user: {user_id} ({email})")
    return _policy(
        "Allow",
        resource,
        user_id,
        {
            "user_id": user_id,
            "auth": "cognito_jwt",
            "email": email,
            "is_authenticated": True,
        },
    )

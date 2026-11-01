# ws_authorizer.py - Lambda authorizer cho route $connect của API Gateway WebSocket.
# Kiểm tra JWT của Cognito (chữ ký RS256, issuer, hạn, token_use, client_id) rồi trả về user_id cho orchestrator.
# Token gửi qua query string: wss://.../dev/?token=<id_token hoặc access_token>
# ALLOW_GUEST=1 (mặc định): không có token vẫn cho kết nối như khách (khách chat được nhưng không thao tác giỏ hàng);
# có token mà sai thì từ chối. Đặt ALLOW_GUEST=0 để bắt buộc đăng nhập.
# Thư viện cần: PyJWT, cryptography (có trong requirements.v2.txt).
import json, os, time, urllib.request

import jwt   # PyJWT

REGION = os.getenv("AWS_REGION", "ap-southeast-1")
POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
CLIENT_ID = os.getenv("COGNITO_CLIENT_ID", "")
ALLOW_GUEST = os.getenv("ALLOW_GUEST", "1") == "1"
USER_ID_CLAIM = os.getenv("USER_ID_CLAIM", "custom:user_id")   # claim chứa mã người dùng khớp bảng Users; thiếu thì dùng sub
JWKS_TTL_S = 3600

ISSUER = f"https://cognito-idp.{REGION}.amazonaws.com/{POOL_ID}"
_jwks = {"keys": None, "t": 0.0}


def _load_jwks(force=False):
    if force or not _jwks["keys"] or time.time() - _jwks["t"] > JWKS_TTL_S:
        with urllib.request.urlopen(ISSUER + "/.well-known/jwks.json", timeout=3) as r:
            _jwks["keys"] = {k["kid"]: k for k in json.loads(r.read())["keys"]}
        _jwks["t"] = time.time()
    return _jwks["keys"]


def verify(token):
    """Trả về claims nếu token hợp lệ, ngược lại raise."""
    kid = jwt.get_unverified_header(token).get("kid")
    keys = _load_jwks()
    if kid not in keys:
        keys = _load_jwks(force=True)    # Cognito có thể vừa xoay khóa
    if kid not in keys:
        raise ValueError("kid không có trong JWKS")
    key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(keys[kid]))
    claims = jwt.decode(token, key=key, algorithms=["RS256"], issuer=ISSUER,
                        options={"verify_aud": False, "require": ["exp", "iss"]})
    use = claims.get("token_use")
    if use == "id":
        if claims.get("aud") != CLIENT_ID:
            raise ValueError("aud không khớp")
    elif use == "access":
        if claims.get("client_id") != CLIENT_ID:
            raise ValueError("client_id không khớp")
    else:
        raise ValueError("token_use không hợp lệ")
    return claims


def _policy(effect, resource, principal, context=None):
    out = {"principalId": principal,
           "policyDocument": {"Version": "2012-10-17", "Statement": [
               {"Action": "execute-api:Invoke", "Effect": effect, "Resource": resource}]}}
    if context:
        out["context"] = context      # chỉ nhận chuỗi, số, boolean
    return out


def lambda_handler(event, context):
    resource = event.get("methodArn", "*")
    token = ((event.get("queryStringParameters") or {}).get("token") or "").strip()
    if not token:
        if ALLOW_GUEST:
            return _policy("Allow", resource, "guest", {"user_id": "", "auth": "guest"})
        return _policy("Deny", resource, "anonymous")
    try:
        claims = verify(token)
    except Exception as exc:
        print("Từ chối token:", type(exc).__name__, str(exc)[:120])
        return _policy("Deny", resource, "invalid")
    user_id = str(claims.get(USER_ID_CLAIM) or claims.get("sub"))
    return _policy("Allow", resource, user_id, {"user_id": user_id, "auth": "jwt"})

import json
import time
import unittest
from unittest.mock import patch
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

import handler


class TestChatbotAuthorizer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Tạo cặp khóa RSA tạm để test JWT
        cls.private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        cls.kid = "test-key-id"
        public_key = cls.private_key.public_key()
        jwk_dict = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(public_key))
        jwk_dict["kid"] = cls.kid

        handler.POOL_ID = "ap-southeast-1_testPool"
        handler.CLIENT_ID = "test-client-id"
        handler.ISSUER = f"https://cognito-idp.ap-southeast-1.amazonaws.com/{handler.POOL_ID}"
        handler.ALLOW_GUEST = True
        handler._jwks = {"keys": {cls.kid: jwk_dict}, "t": time.time()}

    def _create_token(self, payload, kid=None):
        headers = {"kid": kid or self.kid}
        return jwt.encode(payload, self.private_key, algorithm="RS256", headers=headers)

    def test_guest_without_token_allowed(self):
        event = {"methodArn": "arn:aws:execute-api:...", "queryStringParameters": {}}
        res = handler.lambda_handler(event, None)
        self.assertEqual(res["policyDocument"]["Statement"][0]["Effect"], "Allow")
        self.assertEqual(res["context"]["auth"], "guest")
        self.assertEqual(res["context"]["user_id"], "")

    def test_guest_explicit_token_allowed(self):
        event = {"methodArn": "arn:aws:execute-api:...", "queryStringParameters": {"token": "guest"}}
        res = handler.lambda_handler(event, None)
        self.assertEqual(res["policyDocument"]["Statement"][0]["Effect"], "Allow")
        self.assertEqual(res["context"]["auth"], "guest")

    def test_valid_cognito_id_token(self):
        payload = {
            "sub": "user-uuid-12345",
            "email": "customer@example.com",
            "token_use": "id",
            "aud": "test-client-id",
            "iss": handler.ISSUER,
            "exp": int(time.time()) + 3600,
        }
        token = self._create_token(payload)
        event = {"methodArn": "arn:aws:execute-api:...", "queryStringParameters": {"token": token}}
        res = handler.lambda_handler(event, None)
        self.assertEqual(res["policyDocument"]["Statement"][0]["Effect"], "Allow")
        self.assertEqual(res["context"]["user_id"], "user-uuid-12345")
        self.assertEqual(res["context"]["auth"], "cognito_jwt")
        self.assertEqual(res["context"]["email"], "customer@example.com")

    def test_expired_token_denied(self):
        payload = {
            "sub": "user-uuid-12345",
            "token_use": "id",
            "aud": "test-client-id",
            "iss": handler.ISSUER,
            "exp": int(time.time()) - 100,  # Hết hạn
        }
        token = self._create_token(payload)
        event = {"methodArn": "arn:aws:execute-api:...", "queryStringParameters": {"token": token}}
        res = handler.lambda_handler(event, None)
        self.assertEqual(res["policyDocument"]["Statement"][0]["Effect"], "Deny")

    def test_wrong_client_id_denied(self):
        payload = {
            "sub": "user-uuid-12345",
            "token_use": "id",
            "aud": "wrong-client-id",
            "iss": handler.ISSUER,
            "exp": int(time.time()) + 3600,
        }
        token = self._create_token(payload)
        event = {"methodArn": "arn:aws:execute-api:...", "queryStringParameters": {"token": token}}
        res = handler.lambda_handler(event, None)
        self.assertEqual(res["policyDocument"]["Statement"][0]["Effect"], "Deny")


if __name__ == "__main__":
    unittest.main()

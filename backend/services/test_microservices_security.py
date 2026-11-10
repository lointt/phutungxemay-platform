import os
os.environ.setdefault('AWS_DEFAULT_REGION', 'ap-southeast-1')
import unittest
from unittest.mock import patch, MagicMock

from backend.services.user.handler import get_authenticated_user_id, verify_origin as user_verify_origin
from backend.services.order.handler import get_auth_context, verify_origin as order_verify_origin
from backend.services.cart.handler import get_user_id as cart_get_user_id, verify_origin as cart_verify_origin
from backend.services.payment_webhook.handler import verify_origin as payment_verify_origin
from backend.workers.notification.handler import get_smtp_password

class TestMicroservicesSecurity(unittest.TestCase):

    # 1. USER SERVICE TESTS
    def test_user_service_strictly_uses_cognito_sub(self):
        # User đã đăng nhập với sub 'user-real-123'
        event = {
            'requestContext': {
                'authorizer': {
                    'claims': {
                        'sub': 'user-real-123',
                        'email': 'real@example.com'
                    }
                }
            },
            # Kẻ tấn công cố tình truyền userId của người khác qua query hoặc header
            'queryStringParameters': {'userId': 'victim-456'},
            'headers': {'x-user-id': 'victim-456'}
        }
        user_id = get_authenticated_user_id(event)
        self.assertEqual(user_id, 'user-real-123')

    def test_user_service_rejects_unauthenticated_idor_attempt(self):
        # Không có token JWT nhưng cố gắng truyền userId qua query/header
        event = {
            'requestContext': {},
            'queryStringParameters': {'userId': 'victim-456'},
            'headers': {'x-user-id': 'victim-456'}
        }
        user_id = get_authenticated_user_id(event)
        self.assertIsNone(user_id)

    def test_user_service_allows_admin_to_view_target_user(self):
        event = {
            'requestContext': {
                'authorizer': {
                    'claims': {
                        'sub': 'admin-001',
                        'cognito:groups': ['Admins']
                    }
                }
            },
            'queryStringParameters': {'userId': 'customer-999'}
        }
        user_id = get_authenticated_user_id(event)
        self.assertEqual(user_id, 'customer-999')

    # 2. ORDER SERVICE TESTS
    def test_order_service_strictly_uses_cognito_sub_for_customer(self):
        event = {
            'requestContext': {
                'authorizer': {
                    'claims': {
                        'sub': 'customer-sub-111',
                        'cognito:groups': ['Customers']
                    }
                }
            },
            'queryStringParameters': {'userId': 'victim-222'}
        }
        user_id, is_admin = get_auth_context(event)
        self.assertEqual(user_id, 'customer-sub-111')
        self.assertFalse(is_admin)

    def test_order_service_allows_admin_query_any_user(self):
        event = {
            'requestContext': {
                'authorizer': {
                    'claims': {
                        'sub': 'admin-sub-999',
                        'cognito:groups': 'Admins'
                    }
                }
            },
            'queryStringParameters': {'userId': 'customer-111'}
        }
        user_id, is_admin = get_auth_context(event)
        self.assertEqual(user_id, 'customer-111')
        self.assertTrue(is_admin)

    def test_order_service_extracts_sub_from_bearer_token(self):
        import base64
        import json
        payload = {'sub': 'customer-bearer-888', 'email': 'bearer@test.com'}
        b64_payload = base64.urlsafe_b64encode(json.dumps(payload).encode('utf-8')).decode('utf-8').rstrip('=')
        mock_jwt = f'eyJhbGciOiJIUzI1NiJ9.{b64_payload}.signature'
        event = {
            'headers': {'Authorization': f'Bearer {mock_jwt}'}
        }
        user_id, is_admin = get_auth_context(event)
        self.assertEqual(user_id, 'customer-bearer-888')
        self.assertFalse(is_admin)

    def test_order_service_rejects_unauthenticated_guest(self):
        # Guest không có token JWT bị từ chối (Phương án 2)
        event = {
            'headers': {'x-guest-id': 'some-guest-id'}
        }
        user_id, is_admin = get_auth_context(event)
        self.assertIsNone(user_id)

    # 3. CART SERVICE TESTS
    def test_cart_service_strictly_uses_sub_when_authenticated(self):
        event = {
            'requestContext': {
                'authorizer': {
                    'claims': {
                        'sub': 'cart-owner-555'
                    }
                }
            },
            'queryStringParameters': {'userId': 'victim-cart-777'},
            'headers': {'x-user-id': 'victim-cart-777'}
        }
        cart_user_id = cart_get_user_id(event)
        self.assertEqual(cart_user_id, 'cart-owner-555')

    def test_cart_service_guest_session_isolation(self):
        # Guest hợp lệ có session id
        event = {
            'headers': {'x-guest-session': 'guest_abcdef1234567890'}
        }
        cart_user_id = cart_get_user_id(event)
        self.assertEqual(cart_user_id, 'guest_abcdef1234567890')

    # 4. ORIGIN VERIFY TESTS ACROSS SERVICES
    def test_verify_origin_enforcement(self):
        os.environ['ORIGIN_VERIFY_SECRET'] = 'secret-waf-origin-token'
        try:
            valid_event = {'headers': {'x-origin-verify': 'secret-waf-origin-token'}}
            invalid_event = {'headers': {'x-origin-verify': 'hacker-token'}}
            missing_event = {'headers': {}}

            for verify_fn in [user_verify_origin, order_verify_origin, cart_verify_origin, payment_verify_origin]:
                self.assertTrue(verify_fn(valid_event))
                self.assertFalse(verify_fn(invalid_event))
                self.assertFalse(verify_fn(missing_event))
        finally:
            del os.environ['ORIGIN_VERIFY_SECRET']

    # 5. NOTIFICATION WORKER SSM SECURESTRING TEST
    @patch('boto3.client')
    def test_notification_worker_reads_ssm_securestring(self, mock_boto):
        # Reset cache
        import backend.workers.notification.handler as notif_handler
        notif_handler._cached_smtp_password = None

        mock_ssm = MagicMock()
        mock_ssm.get_parameter.return_value = {
            'Parameter': {
                'Value': 'ssm_decrypted_app_password'
            }
        }
        mock_boto.return_value = mock_ssm

        if 'SMTP_PASSWORD' in os.environ:
            del os.environ['SMTP_PASSWORD']
        os.environ['SMTP_PASSWORD_PARAM'] = '/ecommerce/smtp_password'

        pwd = get_smtp_password()
        self.assertEqual(pwd, 'ssm_decrypted_app_password')
        mock_ssm.get_parameter.assert_called_with(
            Name='/ecommerce/smtp_password',
            WithDecryption=True
        )

if __name__ == '__main__':
    unittest.main()

import os
os.environ.setdefault('AWS_DEFAULT_REGION', 'ap-southeast-1')
import unittest
from backend.services.catalog.handler import is_admin, verify_origin

class TestCatalogSecurity(unittest.TestCase):
    def test_is_admin_with_cognito_admins_group_list(self):
        event = {
            'requestContext': {
                'authorizer': {
                    'claims': {
                        'cognito:groups': ['Admins', 'Staff']
                    }
                }
            }
        }
        self.assertTrue(is_admin(event))

    def test_is_admin_with_cognito_admins_group_string(self):
        event = {
            'requestContext': {
                'authorizer': {
                    'claims': {
                        'cognito:groups': 'Admins, Customers'
                    }
                }
            }
        }
        self.assertTrue(is_admin(event))

    def test_is_admin_rejects_unauthorized_user(self):
        event = {
            'requestContext': {
                'authorizer': {
                    'claims': {
                        'cognito:groups': ['Customers']
                    }
                }
            }
        }
        self.assertFalse(is_admin(event))

    def test_is_admin_rejects_empty_claims(self):
        event = {'requestContext': {}}
        self.assertFalse(is_admin(event))

    def test_is_admin_rejects_forged_x_role_header_without_secret(self):
        # Hacker gửi header x-role: admin nhưng không có admin secret key
        event = {
            'headers': {
                'x-role': 'admin'
            }
        }
        self.assertFalse(is_admin(event))

    def test_is_admin_allows_with_valid_internal_key(self):
        os.environ['ADMIN_SECRET_KEY'] = 'super-secret-admin-key'
        try:
            event = {
                'headers': {
                    'x-role': 'admin',
                    'x-admin-key': 'super-secret-admin-key'
                }
            }
            self.assertTrue(is_admin(event))
        finally:
            del os.environ['ADMIN_SECRET_KEY']

    def test_verify_origin_when_not_configured(self):
        # Mặc định chưa set biến môi trường (dev local) -> cho phép
        if 'ORIGIN_VERIFY_SECRET' in os.environ:
            del os.environ['ORIGIN_VERIFY_SECRET']
        self.assertTrue(verify_origin({}))

    def test_verify_origin_valid_secret(self):
        os.environ['ORIGIN_VERIFY_SECRET'] = 'test-token-123'
        try:
            event = {
                'headers': {
                    'x-origin-verify': 'test-token-123'
                }
            }
            self.assertTrue(verify_origin(event))
        finally:
            del os.environ['ORIGIN_VERIFY_SECRET']

    def test_verify_origin_invalid_or_missing_secret(self):
        os.environ['ORIGIN_VERIFY_SECRET'] = 'test-token-123'
        try:
            # Thiếu header
            self.assertFalse(verify_origin({'headers': {}}))
            # Sai secret
            self.assertFalse(verify_origin({'headers': {'x-origin-verify': 'wrong-token'}}))
        finally:
            del os.environ['ORIGIN_VERIFY_SECRET']

if __name__ == '__main__':
    unittest.main()

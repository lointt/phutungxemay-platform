import os
import sys
import json
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(__file__))
import handler


class TestNotificationWorker(unittest.TestCase):
    def setUp(self):
        handler.SMTP_USER = "test_store@gmail.com"
        handler.STAFF_EMAIL = "staff_support@gmail.com"

    def test_build_handover_template(self):
        detail = {
            "ticket_id": "HO_20261103_ABCD",
            "session_id": "sess_12345",
            "user_id": "user_customer_99",
            "reason": "Khách hàng cần tư vấn phụ tùng SH 150i 2024",
            "question": "Bên mình còn bố thắng Brembo cho SH 2024 không?",
            "history_text": "User: Xin chào | Bot: Dạ chào bạn | User: Hỏi bố thắng SH",
        }
        html = handler.build_handover_requested_template(detail)
        self.assertIn("sess_12345", html)
        self.assertIn("user_customer_99", html)
        self.assertIn("Khách hàng cần tư vấn phụ tùng SH 150i 2024", html)
        self.assertIn("Hỏi bố thắng SH", html)

    @patch("handler.send_email_smtp")
    def test_process_handover_requested_event(self, mock_send_email):
        detail = {
            "ticket_id": "HO_TEST_9999",
            "session_id": "sess_abc",
            "user_id": "user_xyz",
            "customer_name": "Lợi Nguyễn",
            "phone": "0813072077",
            "reason": "Yêu cầu gặp nhân viên",
            "question": "Tư vấn giúp em đơn hàng chưa giao",
            "history_text": "User: Cần gặp nhân viên",
        }
        handler.process_notification_event("HumanHandoverRequested", detail)
        mock_send_email.assert_called_once()
        args, kwargs = mock_send_email.call_args
        # recipient_email, subject, html
        self.assertEqual(args[0], "staff_support@gmail.com")
        self.assertIn("Lợi Nguyễn", args[1])
        self.assertIn("0813072077", args[1])

    @patch("handler.send_email_smtp")
    def test_lambda_handler_sqs_handover_record(self, mock_send_email):
        sqs_event = {
            "Records": [
                {
                    "body": json.dumps({
                        "source": "chatbot.orchestrator",
                        "detail-type": "HumanHandoverRequested",
                        "detail": {
                            "ticket_id": "HO_SQS_111",
                            "session_id": "sess_sqs",
                            "user_id": "user_sqs",
                            "reason": "Chatbot không trả lời được",
                            "question": "Xe bị kêu lụp bụp ở nồi",
                            "history_text": "User: Xe bị kêu nồi",
                        }
                    })
                }
            ]
        }
        result = handler.lambda_handler(sqs_event, None)
        self.assertEqual(result["status"], "SUCCESS")
        self.assertEqual(result["processed_records"], 1)
        mock_send_email.assert_called_once()


if __name__ == "__main__":
    unittest.main()

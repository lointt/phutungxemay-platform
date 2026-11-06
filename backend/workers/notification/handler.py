import os
import json
import smtplib
import boto3
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone

SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 465))
SMTP_USER = os.environ.get("SMTP_USER", "")
STAFF_EMAIL = os.environ.get("STAFF_EMAIL", "").strip() or SMTP_USER or "phutungxemay246@gmail.com"

_cached_smtp_password = None

def get_smtp_password():
    """Lấy SMTP Password an toàn từ cache, biến môi trường hoặc AWS SSM Parameter Store SecureString"""
    global _cached_smtp_password
    if _cached_smtp_password:
        return _cached_smtp_password

    # 1. Thử đọc từ env var trực tiếp (nếu có)
    pwd = os.environ.get("SMTP_PASSWORD", "").replace(" ", "")
    if pwd:
        _cached_smtp_password = pwd
        return pwd

    # 2. Đọc an toàn từ AWS Systems Manager (SSM) Parameter Store SecureString
    param_name = os.environ.get("SMTP_PASSWORD_PARAM", "/ecommerce/smtp_password")
    try:
        region = os.environ.get("AWS_REGION", "ap-southeast-1")
        ssm = boto3.client("ssm", region_name=region)
        resp = ssm.get_parameter(Name=param_name, WithDecryption=True)
        val = resp.get("Parameter", {}).get("Value", "").replace(" ", "")
        if val and val != "GMAIL_APP_PASSWORD_DEFAULT":
            _cached_smtp_password = val
            return val
    except Exception as e:
        print(f"[WARN] Không thể đọc SMTP_PASSWORD từ SSM: {e}")

    return ""

def format_currency(amount):
    """Format số tiền sang định dạng VND"""
    try:
        return f"{int(amount):,}".replace(",", ".") + " VNĐ"
    except Exception:
        return f"{amount} VNĐ"

def send_email_smtp(recipient_email, subject, html_content, plain_text=""):
    """Gửi email HTML qua Gmail SMTP (hỗ trợ cả SSL 465 và TLS 587)"""
    smtp_password = get_smtp_password()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Cửa Hàng Phụ Tùng Xe Máy <{SMTP_USER}>"
    msg["To"] = recipient_email

    msg.attach(MIMEText(plain_text, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    sent = False
    last_err = None

    # 1. Thử qua SSL cổng 465
    try:
        with smtplib.SMTP_SSL(SMTP_SERVER, 465, timeout=10) as server:
            server.login(SMTP_USER, smtp_password)
            server.sendmail(SMTP_USER, recipient_email, msg.as_string())
            sent = True
    except Exception as e:
        last_err = e

    # 2. Nếu 465 bị mạng chặn, thử tiếp qua STARTTLS cổng 587
    if not sent:
        try:
            with smtplib.SMTP(SMTP_SERVER, 587, timeout=10) as server:
                server.starttls()
                server.login(SMTP_USER, smtp_password)
                server.sendmail(SMTP_USER, recipient_email, msg.as_string())
                sent = True
        except Exception as e:
            last_err = e

    if sent:
        print(f"[SMTP_SUCCESS] Đã gửi email thành công từ {SMTP_USER} tới {recipient_email}")
        return True
    else:
        print(f"[SMTP_ERROR] Không thể gửi email qua Gmail SMTP: {str(last_err)}")
        raise last_err

def build_order_placed_template(detail):
    order_id = detail.get("order_id", "N/A")
    items = detail.get("items", [])
    total_amount = format_currency(detail.get("total_amount", 0))
    shipping_fee = format_currency(detail.get("shipping_fee", 0))
    final_amount = format_currency(detail.get("final_amount", 0))
    payment_method = detail.get("payment_method", "COD")
    shipping_address = detail.get("shipping_address", {})
    recipient_name = shipping_address.get("full_name") or shipping_address.get("recipient_name") or "Quý khách"
    address_str = shipping_address.get("address") or f"{shipping_address.get('street', '')}, {shipping_address.get('ward', '')}, {shipping_address.get('district', '')}, {shipping_address.get('province', '')}"
    phone = shipping_address.get("phone", "N/A")

    items_html = ""
    for it in items:
        name = it.get("name", "Phụ tùng xe máy")
        qty = it.get("quantity", 1)
        price = format_currency(it.get("price", 0))
        subtotal = format_currency(float(it.get("price", 0)) * int(qty))
        items_html += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">{name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">{qty}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">{price}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">{subtotal}</td>
        </tr>
        """

    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; background-color: #f7f9fa; padding: 20px; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <div style="background: #ea580c; padding: 20px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 22px;">XÁC NHẬN ĐƠN HÀNG THÀNH CÔNG</h1>
                <p style="margin: 5px 0 0 0; font-size: 14px;">Mã đơn hàng: #{order_id}</p>
            </div>
            <div style="padding: 24px;">
                <p>Xin chào <strong>{recipient_name}</strong>,</p>
                <p>Cảm ơn bạn đã mua sắm tại <strong>Cửa Hàng Phụ Tùng Xe Máy</strong>. Đơn hàng của bạn đã được ghi nhận và đang chuẩn bị xuất kho.</p>

                <h3 style="color: #ea580c; border-bottom: 2px solid #ea580c; padding-bottom: 5px;">Thông Tin Giao Hàng</h3>
                <p style="margin: 4px 0;"><strong>Người nhận:</strong> {recipient_name} ({phone})</p>
                <p style="margin: 4px 0;"><strong>Địa chỉ:</strong> {address_str}</p>
                <p style="margin: 4px 0;"><strong>Hình thức thanh toán:</strong> {payment_method}</p>

                <h3 style="color: #ea580c; border-bottom: 2px solid #ea580c; padding-bottom: 5px; margin-top: 20px;">Chi Tiết Đơn Hàng</h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                        <tr style="background: #f1f5f9; color: #475569; font-size: 13px;">
                            <th style="padding: 10px; text-align: left;">Sản phẩm</th>
                            <th style="padding: 10px; text-align: center;">SL</th>
                            <th style="padding: 10px; text-align: right;">Đơn giá</th>
                            <th style="padding: 10px; text-align: right;">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items_html}
                    </tbody>
                </table>

                <div style="margin-top: 20px; text-align: right;">
                    <p style="margin: 4px 0;">Tạm tính: <strong>{total_amount}</strong></p>
                    <p style="margin: 4px 0;">Phí vận chuyển: <strong>{shipping_fee}</strong></p>
                    <p style="margin: 8px 0; font-size: 18px; color: #ea580c;">Tổng thanh toán: <strong>{final_amount}</strong></p>
                </div>

                <div style="margin-top: 30px; padding: 15px; background: #fff7ed; border-left: 4px solid #ea580c; font-size: 13px;">
                    Hotline hỗ trợ kỹ thuật và kiểm tra lộ trình: <strong>1900 6868</strong>
                </div>
            </div>
            <div style="background: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
                © 2026 Cửa Hàng Phụ Tùng Xe Máy Chính Hãng. Toàn quyền bảo lưu.
            </div>
        </div>
    </body>
    </html>
    """
    return html

def build_payment_success_template(detail):
    order_id = detail.get("order_id", "N/A")
    amount = format_currency(detail.get("amount") or detail.get("final_amount", 0))
    txn_id = detail.get("transaction_id", "N/A")
    bank_code = detail.get("bank_code", detail.get("vnp_BankCode", "NCB"))
    now_str = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M:%S UTC")

    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f8fafc;margin:0;padding:24px;">
        <div style="max-width:620px;margin:auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
            <div style="background:linear-gradient(135deg, #16a34a 0%, #15803d 100%);padding:28px 24px;text-align:center;color:#ffffff;">
                <h1 style="margin:0;font-size:22px;">THANH TOÁN THÀNH CÔNG</h1>
                <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Hệ thống đã nhận được tiền của bạn</p>
            </div>
            <div style="padding:28px 24px;">
                <p style="font-size:15px;color:#1e293b;line-height:1.6;">
                    Giao dịch thanh toán trực tuyến cho đơn hàng <strong>#{order_id}</strong> đã hoàn tất thành công.
                </p>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:18px 20px;margin:20px 0;">
                    <table style="width:100%;font-size:14px;border-collapse:collapse;">
                        <tr><td style="padding:6px 0;color:#475569;">Mã đơn hàng:</td><td style="padding:6px 0;font-weight:700;color:#15803d;text-align:right;">#{order_id}</td></tr>
                        <tr><td style="padding:6px 0;color:#475569;">Số tiền thanh toán:</td><td style="padding:6px 0;font-weight:800;color:#15803d;text-align:right;font-size:16px;">{amount}</td></tr>
                        <tr><td style="padding:6px 0;color:#475569;">Mã giao dịch (Txn ID):</td><td style="padding:6px 0;color:#0f172a;text-align:right;font-family:monospace;">{txn_id}</td></tr>
                        <tr><td style="padding:6px 0;color:#475569;">Cổng thanh toán:</td><td style="padding:6px 0;color:#0f172a;text-align:right;">{bank_code}</td></tr>
                        <tr><td style="padding:6px 0;color:#475569;">Thời gian ghi nhận:</td><td style="padding:6px 0;color:#0f172a;text-align:right;">{now_str}</td></tr>
                    </table>
                </div>
                <p style="font-size:14px;color:#475569;line-height:1.5;">
                    Trạng thái đơn hàng đã được tự động cập nhật sang <strong>ĐÃ THANH TOÁN (PAID)</strong>. Đơn hàng đang được bộ phận kho ưu tiên bàn giao cho đơn vị chuyển phát.
                </p>
            </div>
            <div style="background:#f8fafc;padding:18px 24px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
                <p style="margin:0;">Cửa Hàng Phụ Tùng Xe Máy | Email: {SMTP_USER} | Hotline: 0909 246 246</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html

def build_handover_requested_template(detail):
    ticket_id = detail.get("ticket_id", "N/A")
    session_id = detail.get("session_id", "N/A")
    user_id = detail.get("user_id", "Khách chưa đăng nhập")
    reason = detail.get("reason", "Khách hàng yêu cầu gặp nhân viên tư vấn")
    question = detail.get("question", "N/A")
    history_text = detail.get("history_text", "")
    now_str = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M:%S UTC")

    history_html = ""
    if history_text:
        snippets = history_text.split(" | ")
        for snip in snippets[-8:]:
            if snip.strip():
                history_html += f"<li style='margin-bottom: 6px; padding: 8px 12px; background: #f8fafc; border-radius: 4px; border-left: 3px solid #64748b; font-size: 13px;'>{snip.strip()}</li>"
    else:
        history_html = "<li style='color: #94a3b8; font-style: italic;'>Không có lịch sử hội thoại trước đó.</li>"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f8fafc;margin:0;padding:24px;">
        <div style="max-width:650px;margin:auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
            <div style="background:linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);padding:24px;text-align:center;color:#ffffff;">
                <h1 style="margin:0;font-size:22px;letter-spacing:0.5px;">🚨 YÊU CẦU HỖ TRỢ KHÁCH HÀNG (HUMAN HANDOVER)</h1>
                <p style="margin:6px 0 0;font-size:14px;opacity:0.95;">Ticket ID: #{ticket_id}</p>
            </div>
            <div style="padding:24px;">
                <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:20px;">
                    <p style="margin:0;color:#991b1b;font-weight:600;font-size:15px;">
                        ⚠️ Khách hàng đang cần nhân viên hỗ trợ trực tiếp trên Chatbot!
                    </p>
                    <p style="margin:6px 0 0;color:#7f1d1d;font-size:13px;">
                        Lý do chuyển tiếp: <strong>{reason}</strong>
                    </p>
                </div>

                <h3 style="color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-top:0;">Thông Tin Khách Hàng & Phiên Chat</h3>
                <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:16px;">
                    <tr><td style="padding:6px 0;color:#64748b;width:150px;">Mã Ticket:</td><td style="padding:6px 0;font-weight:700;color:#dc2626;">#{ticket_id}</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;">Mã Khách Hàng:</td><td style="padding:6px 0;font-weight:600;color:#0f172a;">{user_id}</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;">Session ID:</td><td style="padding:6px 0;font-family:monospace;font-size:13px;color:#334155;">{session_id}</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;">Thời Gian Ghi Nhận:</td><td style="padding:6px 0;color:#0f172a;">{now_str}</td></tr>
                </table>

                <h3 style="color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">Câu Hỏi / Thắc Mắc Khách Vừa Hỏi</h3>
                <div style="background:#f1f5f9;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 6px 6px 0;font-size:14px;color:#1e293b;font-weight:500;margin-bottom:20px;">
                    "{question}"
                </div>

                <h3 style="color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">Lịch Sử Hội Thoại Gần Nhất (Chat Context)</h3>
                <ul style="list-style:none;padding:0;margin:0 0 20px 0;line-height:1.5;">
                    {history_html}
                </ul>

                <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;text-align:center;">
                    <p style="margin:0;font-size:13px;color:#1e40af;">
                        Vui lòng mở giao diện quản trị hoặc kết nối với khách qua phiên chat trên để hỗ trợ kịp thời.
                    </p>
                </div>
            </div>
            <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
                Notification Worker (Customer & Staff) | Cửa Hàng Phụ Tùng Xe Máy
            </div>
        </div>
    </body>
    </html>
    """
    return html

def process_notification_event(detail_type, detail):
    # Xử lý sự kiện Chuyển nhân viên tư vấn (Human Handover) từ Chatbot
    if detail_type == "HumanHandoverRequested":
        ticket_id = detail.get("ticket_id", "N/A")
        recipient_email = STAFF_EMAIL
        print(f"[NOTIFICATION] Bắt sự kiện 'HumanHandoverRequested' (Ticket #{ticket_id}) -> Gửi cảnh báo tới Staff Email: {recipient_email}")
        subject = f"[HỖ TRỢ KHÁCH HÀNG KHẨN] Ticket #{ticket_id} - Yêu cầu nhân viên tư vấn"
        html = build_handover_requested_template(detail)
        send_email_smtp(recipient_email, subject, html)
        return

    order_id = detail.get("order_id", "N/A")
    payment_method = str(detail.get("payment_method", "")).upper()
    shipping_addr = detail.get("shipping_address", {})
    recipient_email = shipping_addr.get("email") or detail.get("customer_email") or "phutungxemay246@gmail.com"

    print(f"[NOTIFICATION] Bắt sự kiện '{detail_type}' cho đơn #{order_id} (PTTT: {payment_method}) -> Email: {recipient_email}")

    if detail_type == "OrderPlaced":
        # Đối với đơn hàng Online (VNPAY): KHÔNG gửi email xác nhận đặt hàng sớm khi khách chưa thanh toán!
        # Chỉ khi khách hoàn tất nhập thẻ & OTP trên cổng VNPay, sự kiện 'PaymentSuccess' mới kích hoạt gửi email thanh toán thành công.
        if payment_method == "VNPAY":
            print(f"[NOTIFICATION] Đơn #{order_id} chọn thanh toán qua VNPAY. Tạm thời không gửi email để chờ khách nhập OTP và hoàn tất thanh toán.")
            return

        subject = f"[PhuTungXeMay] Xác nhận đơn hàng #{order_id} thành công"
        html = build_order_placed_template(detail)
        send_email_smtp(recipient_email, subject, html)

    elif detail_type == "PaymentSuccess":
        subject = f"[PhuTungXeMay] Xác nhận thanh toán thành công đơn hàng #{order_id}"
        html = build_payment_success_template(detail)
        send_email_smtp(recipient_email, subject, html)

    elif detail_type == "OrderCancelled":
        subject = f"[PhuTungXeMay] Thông báo hủy đơn hàng #{order_id}"
        html = f"<p>Đơn hàng #{order_id} đã được hủy theo yêu cầu. Số tiền (nếu đã thanh toán) sẽ được hoàn trả lại ví/tài khoản.</p>"
        send_email_smtp(recipient_email, subject, html)

def lambda_handler(event, context):
    records = event.get('Records', [])
    print(f"[SQS] NotificationWorker nhận {len(records)} message cần gửi email.")

    for record in records:
        try:
            body = json.loads(record.get('body', '{}'))
            detail_type = body.get('detail-type') or body.get('type')
            detail = body.get('detail', body)

            if detail_type and detail:
                process_notification_event(detail_type, detail)
        except Exception as e:
            print(f"[FATAL_ERROR] Lỗi khi xử lý notification message: {str(e)}")
            raise e

    return {"status": "SUCCESS", "processed_records": len(records)}

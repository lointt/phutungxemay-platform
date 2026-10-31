import os
import json
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone

SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 465))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "").replace(" ", "")

def format_currency(amount):
    """Format số tiền sang định dạng VND"""
    try:
        return f"{int(amount):,}".replace(",", ".") + " VNĐ"
    except Exception:
        return f"{amount} VNĐ"

def send_email_smtp(recipient_email, subject, html_content, plain_text=""):
    """Gửi email HTML qua Gmail SMTP (hỗ trợ cả SSL 465 và TLS 587)"""
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
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, recipient_email, msg.as_string())
            sent = True
    except Exception as e:
        last_err = e

    # 2. Nếu 465 bị mạng chặn, thử tiếp qua STARTTLS cổng 587
    if not sent:
        try:
            with smtplib.SMTP(SMTP_SERVER, 587, timeout=10) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
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
    bank_code = detail.get("bank_code", "VNPAY")

    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; background-color: #f7f9fa; padding: 20px; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <div style="background: #16a34a; padding: 20px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 22px;">THANH TOÁN THÀNH CÔNG</h1>
                <p style="margin: 5px 0 0 0; font-size: 14px;">Mã đơn hàng: #{order_id}</p>
            </div>
            <div style="padding: 24px;">
                <p>Hệ thống đã nhận được khoản thanh toán <strong>{amount}</strong> cho đơn hàng <strong>#{order_id}</strong>.</p>
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 15px; margin: 15px 0;">
                    <p style="margin: 4px 0;"><strong>Cổng thanh toán:</strong> {bank_code}</p>
                    <p style="margin: 4px 0;"><strong>Mã giao dịch:</strong> {txn_id}</p>
                    <p style="margin: 4px 0;"><strong>Trạng thái:</strong> ĐÃ THANH TOÁN (PROCESSING)</p>
                </div>
                <p>Đơn hàng đang được bộ phận kho đóng gói và bàn giao cho bưu tá Giao Hàng Nhanh (GHN).</p>
            </div>
            <div style="background: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
                © 2026 Cửa Hàng Phụ Tùng Xe Máy Chính Hãng. Toàn quyền bảo lưu.
            </div>
        </div>
    </body>
    </html>
    """
    return html

def process_notification_event(detail_type, detail):
    order_id = detail.get("order_id", "N/A")
    shipping_addr = detail.get("shipping_address", {})
    recipient_email = shipping_addr.get("email") or detail.get("customer_email") or "phutungxemay246@gmail.com"

    print(f"[NOTIFICATION] Bắt sự kiện '{detail_type}' cho đơn #{order_id} -> Email: {recipient_email}")

    if detail_type == "OrderPlaced":
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

import { NextResponse } from 'next/server';
import tls from 'node:tls';

// ============================================================
// app/api/handover/route.ts
// Gửi email thông báo liên hệ khách hàng trực tiếp qua Gmail SMTP
// Đảm bảo hoạt động 100% độc lập, không phụ thuộc vào trạng thái Gemini AI
// ============================================================

const SMTP_USER = process.env.SMTP_USER || 'phutungxemay246@gmail.com';
const SMTP_PASS = (process.env.SMTP_PASSWORD || 'vzjlptdpcbkdmjyv').replace(/\s+/g, '');
const STAFF_EMAIL = process.env.STAFF_EMAIL || 'lointt1199@gmail.com';

function sendSmtpEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(465, 'smtp.gmail.com', () => {
      // Connected
    });

    socket.setEncoding('utf-8');

    let step = 0;
    const userB64 = Buffer.from(SMTP_USER).toString('base64');
    const passB64 = Buffer.from(SMTP_PASS).toString('base64');

    const timeout = setTimeout(() => {
      try {
        socket.destroy();
      } catch {}
      reject(new Error('SMTP timeout sau 12 giây'));
    }, 12000);

    socket.on('data', (data) => {
      const resp = data.toString();

      if (resp.startsWith('220') && step === 0) {
        step = 1;
        socket.write('EHLO localhost\r\n');
      } else if (resp.startsWith('250') && step === 1) {
        step = 2;
        socket.write('AUTH LOGIN\r\n');
      } else if (resp.startsWith('334') && step === 2) {
        step = 3;
        socket.write(userB64 + '\r\n');
      } else if (resp.startsWith('334') && step === 3) {
        step = 4;
        socket.write(passB64 + '\r\n');
      } else if (resp.startsWith('235') && step === 4) {
        step = 5;
        socket.write(`MAIL FROM:<${SMTP_USER}>\r\n`);
      } else if (resp.startsWith('250') && step === 5) {
        step = 6;
        socket.write(`RCPT TO:<${to}>\r\n`);
      } else if (resp.startsWith('250') && step === 6) {
        step = 7;
        socket.write('DATA\r\n');
      } else if (resp.startsWith('354') && step === 7) {
        step = 8;
        const boundary = '----=_Part_' + Date.now();
        const subjectB64 = '=?UTF-8?B?' + Buffer.from(subject).toString('base64') + '?=';
        const rawMsg = [
          `From: "Cửa Hàng Phụ Tùng Xe Máy" <${SMTP_USER}>`,
          `To: <${to}>`,
          `Subject: ${subjectB64}`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          'Content-Type: text/plain; charset=UTF-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          text,
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          html,
          '',
          `--${boundary}--`,
          '\r\n.\r\n',
        ].join('\r\n');
        socket.write(rawMsg);
      } else if (resp.startsWith('250') && step === 8) {
        clearTimeout(timeout);
        socket.write('QUIT\r\n');
        resolve(true);
      } else if (resp.startsWith('5') || resp.startsWith('4')) {
        clearTimeout(timeout);
        socket.destroy();
        reject(new Error(`SMTP error: ${resp.trim()}`));
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = (body.name || body.customer_name || 'Khách hàng').trim();
    const phone = (body.phone || 'Chưa cung cấp').trim();
    const reason = (body.reason || 'Yêu cầu nhân viên hỗ trợ').trim();
    const sessionId = body.session_id || 'guest';
    const userId = body.user_id || 'khach-vang-lai';

    const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    const subject = `[LIÊN HỆ LẠI KHÁCH HÀNG] ${name} - SĐT: ${phone}`;

    const text = `
CÓ KHÁCH HÀNG YÊU CẦU NHÂN VIÊN LIÊN HỆ LẠI TRONG 24H:
Họ và tên: ${name}
Số điện thoại: ${phone}
Mã User: ${userId}
Nguyên nhân: ${reason}
Thời gian: ${nowStr}
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:650px;margin:auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
    <div style="background:linear-gradient(135deg, #ea580c 0%, #c2410c 100%);padding:24px;text-align:center;color:#ffffff;">
      <h1 style="margin:0;font-size:22px;letter-spacing:0.5px;">📞 YÊU CẦU LIÊN HỆ LẠI KHÁCH HÀNG</h1>
    </div>
    <div style="padding:24px;">
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;color:#9a3412;font-weight:700;font-size:16px;">
          Khách hàng đang yêu cầu nhân viên liên hệ tư vấn trong 24h!
        </p>
        <p style="margin:8px 0 0;color:#c2410c;font-size:14px;">
          Nguyên nhân / Vấn đề: <strong>${reason}</strong>
        </p>
      </div>

      <h3 style="color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-top:0;">Thông Tin Khách Hàng</h3>
      <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:16px;">
        <tr><td style="padding:6px 0;color:#64748b;width:150px;">Họ và Tên:</td><td style="padding:6px 0;font-weight:700;color:#0f172a;font-size:15px;">${name}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Số Điện Thoại:</td><td style="padding:6px 0;">
          <a href="tel:${phone}" style="display:inline-block;background:#ea580c;color:#ffffff;font-weight:800;font-size:15px;padding:6px 14px;border-radius:6px;text-decoration:none;">
            📞 ${phone} (Bấm để gọi ngay)
          </a>
        </td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Mã Khách Hàng:</td><td style="padding:6px 0;font-weight:600;color:#0f172a;">${userId}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Phiên Chat:</td><td style="padding:6px 0;font-family:monospace;font-size:13px;color:#334155;">${sessionId}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Thời Gian Ghi Nhận:</td><td style="padding:6px 0;color:#0f172a;">${nowStr}</td></tr>
      </table>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;text-align:center;margin-top:20px;">
        <p style="margin:0;font-size:13px;color:#166534;font-weight:600;">
          ⚠️ Cam kết dịch vụ: Vui lòng liên hệ lại khách hàng qua số ${phone} trong vòng 24 giờ.
        </p>
      </div>
    </div>
    <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
      Hệ Thống Hỗ Trợ Khách Hàng | Cửa Hàng Phụ Tùng Xe Máy | Tiếp nhận: ${STAFF_EMAIL}
    </div>
  </div>
</body>
</html>
    `.trim();

    await sendSmtpEmail({
      to: STAFF_EMAIL,
      subject,
      html,
      text,
    });

    console.log(`[HANDOVER_API] Đã gửi thành công email tới ${STAFF_EMAIL}`);

    return NextResponse.json({
      ok: true,
      message: 'vấn đề của anh/chị đã được gửi đến nhân viên, nhân viên sẽ sớm liên hệ lại trong 24h ạ!',
    });
  } catch (error: unknown) {
    console.error('[HANDOVER_API] Lỗi gửi email handover:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Lỗi nội bộ khi gửi email',
      },
      { status: 500 },
    );
  }
}

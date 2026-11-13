import { NextResponse } from 'next/server';
import tls from 'node:tls';

// ============================================================
// app/handover-submit/route.ts
// Gửi email thông báo liên hệ khách hàng trực tiếp qua Gmail SMTP
// Route này KHÔNG bắt đầu bằng /api/ nên CloudFront sẽ chuyển thẳng tới Next.js SSR Lambda
// ============================================================

const SMTP_USER = 'phutungxemay246@gmail.com';
const SMTP_PASS = 'vzjlptdpcbkdmjyv';
const STAFF_EMAIL = 'lointt1199@gmail.com';

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
    const socket = tls.connect({ host: 'smtp.gmail.com', port: 465 }, () => {
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

    const subject = `[LIÊN HỆ LẠI KHÁCH HÀNG] ${name} - SĐT: ${phone}`;

    const text = `CÓ KHÁCH HÀNG YÊU CẦU NHÂN VIÊN LIÊN HỆ LẠI TRONG 24H:

Họ và tên     : ${name}
Số điện thoại : ${phone}
Nguyên nhân   : ${reason}

Lịch sử hội thoại gần nhất:
- Khách: Cần hỗ trợ bảo hành
- Bot: Đã tiếp nhận`;

    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #111827; background-color: #ffffff; margin: 0; padding: 16px;">
<pre style="font-family: inherit; font-size: inherit; white-space: pre-wrap; line-height: inherit; color: inherit; margin: 0;">${escaped}</pre>
</body>
</html>`;

    await sendSmtpEmail({
      to: STAFF_EMAIL,
      subject,
      html,
      text,
    });

    console.log(`[HANDOVER_SUBMIT] Đã gửi thành công email tới ${STAFF_EMAIL}`);

    return NextResponse.json({
      ok: true,
      message: 'vấn đề của anh/chị đã được gửi đến nhân viên, nhân viên sẽ sớm liên hệ lại trong 24h ạ!',
    });
  } catch (error: unknown) {
    console.error('[HANDOVER_SUBMIT] Lỗi gửi email handover:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Lỗi nội bộ khi gửi email',
      },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { to, subject, text, html } = body;

    if (!to || !to.trim()) {
      return NextResponse.json({ error: '수신자 이메일 주소를 입력해주세요.' }, { status: 400 });
    }

    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: '이메일 제목을 입력해주세요.' }, { status: 400 });
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user || 'no-reply@safety-inspection.local';

    if (!host || !user || !pass) {
      return NextResponse.json(
        {
          ok: false,
          code: 'SMTP_NOT_CONFIGURED',
          message: '서버 SMTP 설정이 없습니다. 기본 메일 앱(mailto:) 또는 본문 복사를 이용해 전송할 수 있습니다.',
        },
        { status: 200 }
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from,
      to: to.trim(),
      subject: subject.trim(),
      text: text || '',
      html: html || undefined,
    });

    return NextResponse.json({ ok: true, message: '이메일이 성공적으로 발송되었습니다.' });
  } catch (error: any) {
    console.error('이메일 발송 에러:', error);
    return NextResponse.json(
      { error: error.message || '이메일 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

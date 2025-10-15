import crypto from "crypto";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const hash = crypto
      .createHmac("sha512", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      console.error("❌ Invalid Paystack Signature");
      return res.status(401).send("Invalid signature");
    }

    const event = req.body;

    if (event.event === "charge.success") {
      const { email, name, nights, total } = event.data.metadata;

      // ✅ Configure Zoho Mail transporter
      const transporter = nodemailer.createTransport({
        host: "smtp.zoho.com",
        port: 465,
        secure: true, // use SSL
        auth: {
          user: process.env.ADMIN_EMAIL, // your Zoho Mail address
          pass: process.env.EMAIL_PASS,  // your Zoho app password
        },
      });

      // ✅ Send confirmation email to client
      await transporter.sendMail({
        from: `"Chez Nous Chez Vous Apartments" <${process.env.ADMIN_EMAIL}>`,
        to: email,
        subject: "Payment Successful - Booking Confirmed",
        html: `
          <h2>Hello ${name},</h2>
          <p>Your booking for <b>${nights}</b> night(s) has been confirmed successfully.</p>
          <p><b>Total Paid:</b> ₦${Number(total).toLocaleString()}</p>
          <p>We look forward to hosting you soon!</p>
          <br/>
          <p style="font-size:14px;color:#666;">— Chez Nous Chez Vous Apartments</p>
        `,
      });

      // ✅ Send alert to owner/admin
      await transporter.sendMail({
        from: `"Booking System" <${process.env.ADMIN_EMAIL}>`,
        to: process.env.ADMIN_EMAIL,
        subject: "New Booking Payment Received",
        html: `
          <h2>New Booking Payment</h2>
          <p><b>Name:</b> ${name}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Nights:</b> ${nights}</p>
          <p><b>Amount Paid:</b> ₦${Number(total).toLocaleString()}</p>
        `,
      });

      console.log(`✅ Payment email sent successfully for ${email}`);
    }

    res.status(200).send("Webhook received successfully");
  } catch (error) {
    console.error("🔥 Webhook Error:", error);
    res.status(500).send("Internal Server Error");
  }
}

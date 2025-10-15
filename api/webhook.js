import crypto from "crypto";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Verify Paystack signature
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const hash = crypto
    .createHmac("sha512", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"]) {
    return res.status(401).send("Invalid signature");
  }

  const event = req.body;

  if (event.event === "charge.success") {
    const { email, name, nights, total } = event.data.metadata;

    // ✅ Configure Zoho Mail SMTP
    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER, // e.g. info@yourdomain.com
        pass: process.env.EMAIL_PASS, // Zoho App Password
      },
    });

    try {
      // Email to client
      await transporter.sendMail({
        from: `"Chez Nous Chez Vous Apartments" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Payment Successful - Booking Confirmed",
        html: `
          <h2>Hello ${name},</h2>
          <p>Your booking for <b>${nights}</b> night(s) has been confirmed.</p>
          <p>Total Paid: <b>₦${Number(total).toLocaleString()}</b></p>
          <p>We look forward to hosting you!</p>
          <br/>
          <p style="color:gray;">Thank you for choosing Chez Nous Chez Vous Apartments.</p>
        `,
      });

      // Email to owner
      await transporter.sendMail({
        from: `"Chez Nous Chez Vous Booking System" <${process.env.EMAIL_USER}>`,
        to: process.env.OWNER_EMAIL,
        subject: "New Booking Payment Received",
        html: `
          <h2>New Booking Payment</h2>
          <p><b>Name:</b> ${name}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Nights:</b> ${nights}</p>
          <p><b>Amount Paid:</b> ₦${Number(total).toLocaleString()}</p>
        `,
      });

      console.log("✅ Emails sent successfully via Zoho");
    } catch (err) {
      console.error("❌ Error sending emails:", err);
    }
  }

  res.status(200).send("Webhook received");
}

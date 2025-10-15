import nodemailer from "nodemailer";

export default async function handler(req, res) {
  // ✅ Allow CORS for frontend integration
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { name, email, checkIn, checkOut, amount } = req.body;
  if (!name || !email || !checkIn || !checkOut || !amount)
    return res.status(400).json({ message: "Missing required fields" });

  try {
    // ✅ Initialize Paystack transaction
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100), // Paystack requires amount in kobo
        callback_url: "https://peswes.github.io/pay/success.html",
        metadata: { name, checkIn, checkOut, total: amount },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      console.error("❌ Paystack initialization failed:", paystackData);
      return res.status(400).json({ message: "Paystack initialization failed", details: paystackData });
    }

    // ✅ Configure Zoho Mail SMTP
    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.com",
      port: 465, // SSL port
      secure: true,
      auth: {
        user: process.env.ZOHO_USER, // your Zoho email (e.g., contact@yourdomain.com)
        pass: process.env.ZOHO_PASS, // your Zoho app password
      },
    });

    const ownerMail = process.env.OWNER_EMAIL || "owner@example.com";
    const paymentLink = paystackData.data.authorization_url;

    // ✅ Send confirmation email to the client
    await transporter.sendMail({
      from: `"Chez Nous Chez Vous Apartments" <${process.env.ZOHO_USER}>`,
      to: email,
      subject: "Payment Initialization Successful",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>Dear ${name},</h2>
          <p>Your booking from <b>${checkIn}</b> to <b>${checkOut}</b> has been initialized successfully.</p>
          <p><b>Total Amount:</b> ₦${amount.toLocaleString()}</p>
          <p>Click below to complete your payment:</p>
          <p>
            <a href="${paymentLink}" 
              style="background:#ff7f00;color:#fff;padding:12px 24px;
              border-radius:8px;text-decoration:none;display:inline-block;">
              Complete Payment
            </a>
          </p>
          <p>Thank you for choosing <b>Chez Nous Chez Vous Apartments</b>.</p>
        </div>
      `,
    });

    // ✅ Send booking notification email to the owner
    await transporter.sendMail({
      from: `"Chez Nous Chez Vous Website" <${process.env.ZOHO_USER}>`,
      to: ownerMail,
      subject: "New Booking Payment Started",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h3>New Booking Details:</h3>
          <p><b>Name:</b> ${name}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Check-in:</b> ${checkIn}</p>
          <p><b>Check-out:</b> ${checkOut}</p>
          <p><b>Amount:</b> ₦${amount.toLocaleString()}</p>
          <p><b>Payment Link:</b> <a href="${paymentLink}">${paymentLink}</a></p>
        </div>
      `,
    });

    // ✅ Respond with success and Paystack public key
    res.status(200).json({
      status: "success",
      authorization_url: paymentLink,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY,
    });
  } catch (error) {
    console.error("🔥 Server Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
}

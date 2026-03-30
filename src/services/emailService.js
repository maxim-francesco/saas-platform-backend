const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const sendContactNotification = async ({ toEmail, name, email, phone, message }) => {
  const mailOptions = {
    from: `"Platformă SaaS" <${process.env.GMAIL_USER}>`,
    to: toEmail || process.env.SEVENCENTER_EMAIL,
    subject: `Mesaj nou de la ${name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Mesaj nou primit pe site</h2>
        <hr/>
        <p><strong>Nume:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Telefon:</strong> ${phone || "Nespecificat"}</p>
        <hr/>
        <p><strong>Mesaj:</strong></p>
        <p style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${message}</p>
        <hr/>
        <small style="color: #999;">Mesaj trimis automat de platforma SaaS</small>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendContactNotification };